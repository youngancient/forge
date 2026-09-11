import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager, apiErrorResponse } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireManager();
    const { id } = await params;

    // atomic conditional update — two managers can't both win (decision #17)
    const result = await prisma.proposal.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedById: session.user.id, approvedAt: new Date() },
    });

    if (result.count === 0) {
      await logActivity(id, "ALREADY_PROCESSED", { actorId: session.user.id });
      return NextResponse.json(
        { error: "Already processed by someone else." },
        { status: 409 },
      );
    }

    await logActivity(id, "APPROVED", { actorId: session.user.id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
