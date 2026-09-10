import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { sendProposalEmail } from "@/lib/email";
import { sendProposalSchema } from "@/lib/validations";

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

    const proposal = await prisma.proposal.findUniqueOrThrow({ where: { id } });
    if (proposal.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const staleCutoff = new Date(Date.now() - SENDING_STALE_MS);
    const isStaleSending =
      proposal.status === "SENDING" && proposal.updatedAt < staleCutoff;

    // atomic conditional update: approved -> sending (design.md decision #17).
    // also reclaimable from a stale "sending" (crash mid-send left it stuck —
    // there is no other route back out of "sending"), not just from "approved".
    const claimed = await prisma.proposal.updateMany({
      where: {
        id,
        OR: [
          { status: "APPROVED" },
          { status: "SENDING", updatedAt: { lt: staleCutoff } },
        ],
      },
      data: { status: "SENDING" },
    });

    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "This proposal has already been sent or is in progress." },
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

    let pdfAttachment: { filename: string; content: Buffer } | undefined;
    if (attachPdf && proposal.pdfUrl) {
      const pdfResponse = await fetch(proposal.pdfUrl);
      pdfAttachment = {
        filename: `proposal-${proposal.companyName}.pdf`,
        content: Buffer.from(await pdfResponse.arrayBuffer()),
      };
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
      await prisma.proposal.update({ where: { id }, data: { status: "APPROVED" } });
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
