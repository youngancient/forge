import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";

// Self-serve export (design.md decision #6) — just serves the file generated
// once at approval time, never regenerates.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const proposal = await prisma.proposal.findUniqueOrThrow({ where: { id } });
    if (
      proposal.ownerId !== session.user.id &&
      session.user.role !== "MANAGER"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!proposal.pdfUrl) {
      return NextResponse.json(
        { error: "PDF not available yet." },
        { status: 404 },
      );
    }

    return NextResponse.redirect(proposal.pdfUrl);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
