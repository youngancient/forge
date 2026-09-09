import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager, apiErrorResponse } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { rejectProposalSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireManager();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = rejectProposalSchema.safeParse(body);
    if (!parsed.success) {
      // design.md: rejection note is required, never optional
      return NextResponse.json(
        { error: "A rejection note is required." },
        { status: 400 },
      );
    }

    const result = await prisma.proposal.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: {
        status: "REJECTED",
        rejectedById: session.user.id,
        rejectedAt: new Date(),
        rejectionNote: parsed.data.note,
      },
    });

    if (result.count === 0) {
      await logActivity(id, "ALREADY_PROCESSED", { actorId: session.user.id });
      return NextResponse.json(
        { error: "Already processed by someone else." },
        { status: 409 },
      );
    }

    await logActivity(id, "REJECTED", {
      actorId: session.user.id,
      detail: parsed.data.note,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
