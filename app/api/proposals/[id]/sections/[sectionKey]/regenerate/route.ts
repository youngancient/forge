import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { regenerateSection, type ProposalSections } from "@/lib/claude";
import { regenerateSectionSchema } from "@/lib/validations";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import type { SectionKey } from "@prisma/client";

const KEY_TO_CAMEL: Record<SectionKey, keyof ProposalSections> = {
  INTRODUCTION: "introduction",
  PROPOSED_SOLUTION: "proposedSolution",
  DELIVERABLES: "deliverables",
  TIMELINE: "timeline",
  PRICING: "pricing",
  NEXT_STEPS: "nextSteps",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionKey: string }> },
) {
  try {
    const session = await requireSession();
    const { id, sectionKey } = await params;

    const key = sectionKey.toUpperCase() as SectionKey;
    if (!(key in KEY_TO_CAMEL)) {
      return NextResponse.json({ error: "Unknown section" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = regenerateSectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid instruction" }, { status: 400 });
    }

    const proposal = await prisma.proposal.findUniqueOrThrow({ where: { id } });
    if (proposal.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // decision #5: locked once out of draft.
    if (proposal.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Proposal is no longer editable." },
        { status: 409 },
      );
    }

    const section = await prisma.proposalSection.findUniqueOrThrow({
      where: { proposalId_sectionKey: { proposalId: id, sectionKey: key } },
    });

    try {
      const newContent = await regenerateSection(
        KEY_TO_CAMEL[key],
        {
          clientName: proposal.clientName,
          companyName: proposal.companyName,
          clientNeedsSummary: proposal.clientNeedsSummary,
          projectScope: proposal.projectScope,
          goalsAndObjectives: proposal.goalsAndObjectives,
          recommendedServices: proposal.recommendedServices,
          proposedTimeline: proposal.proposedTimeline,
          estimatedPricing: proposal.estimatedPricing,
          supportingMaterial:
            [proposal.supportingText, proposal.supportingFileExtractedText]
              .filter(Boolean)
              .join("\n\n---\n\n") || undefined,
        },
        section.content,
        parsed.data.instruction || undefined,
      );

      await prisma.proposalSection.update({
        where: { id: section.id },
        data: { content: newContent },
      });
      await logActivity(id, "SECTION_REGENERATED", {
        actorId: session.user.id,
        detail: key,
      });

      return NextResponse.json({ content: newContent });
    } catch (error) {
      await logActivity(id, "SECTION_REGENERATION_FAILED", {
        actorId: session.user.id,
        detail: `${key}: ${String(error)}`,
      });
      throw error;
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
