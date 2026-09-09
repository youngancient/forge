import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runGeneration } from "@/lib/generate-proposal";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";

// Retry path for when initial generation failed — only valid while the
// proposal is still a draft (design.md: nothing overwrites a reviewed or
// locked proposal).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const proposal = await prisma.proposal.findUniqueOrThrow({ where: { id } });
    if (proposal.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (proposal.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only generate for a draft proposal." },
        { status: 409 },
      );
    }

    await runGeneration(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
