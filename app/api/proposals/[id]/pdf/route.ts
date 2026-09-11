import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";
import { generateProposalPdf, buildProposalPdfInput } from "@/lib/pdf";
import { logActivity } from "@/lib/activity";
import type { ProposalStatus } from "@prisma/client";

// Available any time after approval — the salesperson can export a PDF
// anytime, revised 2026-09-11 to generate fresh on each request instead of
// serving a cached Vercel Blob file (see design.md decisions #4/#6/#14).
const EXPORTABLE_STATUSES: ProposalStatus[] = [
  "APPROVED",
  "SENDING",
  "SENT",
  "REJECTED",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const proposal = await prisma.proposal.findUniqueOrThrow({
      where: { id },
      include: { sections: true, owner: { select: { name: true } } },
    });
    if (
      proposal.ownerId !== session.user.id &&
      session.user.role !== "MANAGER"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!EXPORTABLE_STATUSES.includes(proposal.status)) {
      return NextResponse.json(
        { error: "PDF not available yet." },
        { status: 404 },
      );
    }

    let buffer: Buffer;
    try {
      buffer = await generateProposalPdf(
        buildProposalPdfInput(proposal, proposal.sections),
      );
    } catch (error) {
      await logActivity(id, "PDF_GENERATION_FAILED", {
        actorId: session.user.id,
        detail: String(error),
      });
      return NextResponse.json(
        { error: "Couldn't generate the PDF. Please try again." },
        { status: 502 },
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="proposal-${proposal.companyName}.pdf"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
