import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { sendProposalEmail } from "@/lib/email";
import { generateProposalPdf, buildProposalPdfInput } from "@/lib/pdf";
import { sendProposalSchema } from "@/lib/validations";
import type { ProposalStatus } from "@prisma/client";

// how long a proposal can sit in SENDING before it's treated as an
// abandoned attempt (e.g. the process crashed mid-send) rather than one
// still genuinely in flight, and becomes reclaimable by a retry.
const SENDING_STALE_MS = 5 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const { attachPdf } = sendProposalSchema.parse(body);

    const proposal = await prisma.proposal.findUniqueOrThrow({
      where: { id },
      include: { sections: true },
    });
    if (proposal.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // A proposal in "sent" reverts back to "sent" (not "approved") if
    // anything below fails — a resend that fails shouldn't downgrade a
    // proposal that was already successfully delivered once before.
    const revertStatus: ProposalStatus =
      proposal.status === "SENT" ? "SENT" : "APPROVED";

    // Generated before claiming "sending" — a PDF failure here means nothing
    // has changed yet, so there's no status to revert (unlike the email-send
    // failure below). An explicitly requested attachment is never silently
    // dropped if it fails; the whole send fails instead.
    let pdfAttachment: { filename: string; content: Buffer } | undefined;
    if (attachPdf) {
      try {
        const buffer = await generateProposalPdf(
          buildProposalPdfInput(proposal, proposal.sections),
        );
        pdfAttachment = {
          filename: `proposal-${proposal.companyName}.pdf`,
          content: buffer,
        };
      } catch (error) {
        await logActivity(id, "PDF_GENERATION_FAILED", {
          actorId: session.user.id,
          detail: String(error),
        });
        return NextResponse.json(
          { error: "Couldn't generate the PDF attachment. Please try again." },
          { status: 502 },
        );
      }
    }

    const staleCutoff = new Date(Date.now() - SENDING_STALE_MS);
    const isStaleSending =
      proposal.status === "SENDING" && proposal.updatedAt < staleCutoff;

    // atomic conditional update: approved|sent -> sending (design.md decision
    // #17 originally only allowed this from "approved" — revised to also
    // allow a deliberate resend from "sent", since that's an intentional
    // re-delivery, not the accidental double-send #17 was guarding against.
    // Still reclaimable from a stale "sending" (crash mid-send left it stuck
    // — there is no other route back out of "sending").
    const claimed = await prisma.proposal.updateMany({
      where: {
        id,
        OR: [
          { status: "APPROVED" },
          { status: "SENT" },
          { status: "SENDING", updatedAt: { lt: staleCutoff } },
        ],
      },
      data: { status: "SENDING" },
    });

    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "This proposal is currently being sent — please wait." },
        { status: 409 },
      );
    }

    if (isStaleSending) {
      await logActivity(id, "SEND_RECLAIMED_AFTER_STALL", {
        actorId: session.user.id,
        detail: `Reclaimed after being stuck in SENDING for ${Math.round(
          (Date.now() - proposal.updatedAt.getTime()) / 1000,
        )}s`,
      });
    }

    try {
      await sendProposalEmail({
        clientEmail: proposal.clientEmail,
        clientName: proposal.clientName,
        companyName: proposal.companyName,
        salespersonName: proposal.salespersonName,
        proposalLink: `${process.env.NEXT_PUBLIC_APP_URL}/p/${proposal.publicToken}`,
        pdfAttachment,
      });
    } catch (error) {
      // revert so the salesperson can safely retry (design.md decision #17)
      await prisma.proposal.update({
        where: { id },
        data: { status: revertStatus },
      });
      await logActivity(id, "SEND_FAILED", {
        actorId: session.user.id,
        detail: String(error),
      });
      return NextResponse.json(
        { error: "Failed to send email. Please try again." },
        { status: 502 },
      );
    }

    await prisma.proposal.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
    await logActivity(id, "SENT", { actorId: session.user.id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
