import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-auth";
import { generateProposalPdf, buildProposalPdfInput } from "@/lib/pdf";
import { logActivity } from "@/lib/activity";

// Mirrors app/p/[token]/page.tsx's visibility rule (design.md decision #19):
// a leaked token before approval must not expose unreviewed content.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const proposal = await prisma.proposal.findUnique({
      where: { publicToken: token },
      include: { sections: true, owner: { select: { name: true, email: true } } },
    });
    if (!proposal || (proposal.status !== "APPROVED" && proposal.status !== "SENT")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let buffer: Buffer;
    try {
      buffer = await generateProposalPdf(
        buildProposalPdfInput(proposal, proposal.sections),
      );
    } catch (error) {
      await logActivity(proposal.id, "PDF_GENERATION_FAILED", {
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
