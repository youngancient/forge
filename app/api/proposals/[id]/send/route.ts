import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { sendProposalEmail } from "@/lib/email";
import { sendProposalSchema } from "@/lib/validations";

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

    // atomic conditional update: approved -> sending (design.md decision #17)
    const claimed = await prisma.proposal.updateMany({
      where: { id, status: "APPROVED" },
      data: { status: "SENDING" },
    });

    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "This proposal has already been sent or is in progress." },
        { status: 409 },
      );
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
