import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";
import { generatePublicToken } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";

// design.md decision #5: the only way to change an approved/sent/rejected
// proposal — clone into a fresh draft, never edit or revert the original.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const original = await prisma.proposal.findUniqueOrThrow({
      where: { id },
      include: { sections: true },
    });

    if (original.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (original.status === "DRAFT" || original.status === "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "Only approved, sent, or rejected proposals can be cloned." },
        { status: 409 },
      );
    }

    const clone = await prisma.proposal.create({
      data: {
        ownerId: original.ownerId,
        publicToken: generatePublicToken(),
        clonedFromId: original.id,
        title: original.title,
        clientName: original.clientName,
        clientEmail: original.clientEmail,
        companyName: original.companyName,
        dateOfCall: original.dateOfCall,
        salespersonName: original.salespersonName,
        clientNeedsSummary: original.clientNeedsSummary,
        projectScope: original.projectScope,
        goalsAndObjectives: original.goalsAndObjectives,
        recommendedServices: original.recommendedServices,
        proposedTimeline: original.proposedTimeline,
        estimatedPricing: original.estimatedPricing,
        supportingText: original.supportingText,
        supportingFileUrl: original.supportingFileUrl,
        supportingFileExtractedText: original.supportingFileExtractedText,
        sections: {
          create: original.sections.map((s) => ({
            sectionKey: s.sectionKey,
            content: s.content,
            position: s.position,
          })),
        },
      },
    });

    await logActivity(clone.id, "CLONED", {
      actorId: session.user.id,
      detail: `cloned from ${original.id}`,
    });

    return NextResponse.json({ id: clone.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
