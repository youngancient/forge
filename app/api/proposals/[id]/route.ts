import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";

// Only draft proposals can be deleted — anything submitted/approved/sent is
// part of the permanent record (design.md: clone-and-redo, never delete).
export async function DELETE(
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
        { error: "Only draft proposals can be deleted." },
        { status: 409 },
      );
    }

    await prisma.proposal.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
