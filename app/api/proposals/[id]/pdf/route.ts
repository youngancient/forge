import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";
import { generateProposalPdf, buildProposalPdfInput } from "@/lib/pdf";
import { logActivity } from "@/lib/activity";
import type { ProposalStatus } from "@prisma/client";

// Downloadable (attachment) any time after approval — the salesperson can
// export a PDF anytime, revised 2026-09-11 to generate fresh on each request
// instead of serving a cached Vercel Blob file (see design.md decisions
// #4/#6/#14). PENDING_APPROVAL is included too so a manager can preview
// (?inline=1) exactly what the client would see before deciding whether to
// approve — the owner-facing "Export PDF" download link stays hidden at that
// stage in the UI, but this route is the actual authority either way.
const PDF_AVAILABLE_STATUSES: ProposalStatus[] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "SENDING",
  "SENT",
  "REJECTED",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    // ?inline=1 renders in-browser (preview) instead of forcing a download —
    // used by the manager/owner "Preview PDF" dialog on the detail page.
    const inline = new URL(request.url).searchParams.get("inline") === "1";

    const proposal = await prisma.proposal.findUniqueOrThrow({
      where: { id },
      include: { sections: true, owner: { select: { name: true, email: true } } },
    });
    if (
      proposal.ownerId !== session.user.id &&
      session.user.role !== "MANAGER"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!PDF_AVAILABLE_STATUSES.includes(proposal.status)) {
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
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="proposal-${proposal.companyName}.pdf"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
