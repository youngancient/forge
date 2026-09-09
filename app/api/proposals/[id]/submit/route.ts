import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

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

    // atomic conditional update (design.md decision #17)
    const result = await prisma.proposal.updateMany({
      where: { id, status: "DRAFT" },
      data: { status: "PENDING_APPROVAL" },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Proposal is not in a submittable state." },
        { status: 409 },
      );
    }

    await logActivity(id, "SUBMITTED_FOR_APPROVAL", { actorId: session.user.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
