import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";

const bodySchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
});

// Salesperson-editable after AI generation, same rule as manual section
// edits — only while the proposal is still a draft.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const { title } = bodySchema.parse(await request.json());

    const proposal = await prisma.proposal.findUniqueOrThrow({ where: { id } });
    if (proposal.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (proposal.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Proposal is no longer editable." },
        { status: 409 },
      );
    }

    await prisma.proposal.update({ where: { id }, data: { title } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

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
