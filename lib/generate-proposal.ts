import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateProposalSections, type GenerationInput } from "@/lib/claude";
import { logActivity } from "@/lib/activity";
import { withRetry } from "@/lib/retry";
import type { Proposal } from "@prisma/client";

// Transient Neon/Postgres connection hiccups (e.g. a cold-started compute not
// answering in time) surface as these Prisma error codes — worth a retry,
// same as the Claude call above (design.md decision #16).
const RETRYABLE_PRISMA_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2028",
]);

function isRetryablePrismaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    RETRYABLE_PRISMA_CODES.has(error.code)
  );
}

const SECTION_ORDER = [
  "INTRODUCTION",
  "PROPOSED_SOLUTION",
  "DELIVERABLES",
  "TIMELINE",
  "PRICING",
  "NEXT_STEPS",
] as const;

function toGenerationInput(proposal: Proposal): GenerationInput {
  const supportingMaterial = [
    proposal.supportingText,
    proposal.supportingFileExtractedText,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return {
    clientName: proposal.clientName,
    companyName: proposal.companyName,
    clientNeedsSummary: proposal.clientNeedsSummary,
    projectScope: proposal.projectScope,
    goalsAndObjectives: proposal.goalsAndObjectives,
    recommendedServices: proposal.recommendedServices,
    proposedTimeline: proposal.proposedTimeline,
    estimatedPricing: proposal.estimatedPricing,
    supportingMaterial: supportingMaterial || undefined,
  };
}

// Shared by proposal creation and the "retry generation" path — only ever
// runs against a proposal that has no sections yet (design.md: an approved
// proposal is immutable; a drafted-but-ungenerated one is safe to (re)run).
export async function runGeneration(proposalId: string): Promise<void> {
  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: proposalId },
  });

  try {
    const sections = await generateProposalSections(
      toGenerationInput(proposal),
    );

    await withRetry(
      () =>
        prisma.$transaction([
          ...SECTION_ORDER.map((sectionKey, position) =>
            prisma.proposalSection.upsert({
              where: { proposalId_sectionKey: { proposalId, sectionKey } },
              create: {
                proposalId,
                sectionKey,
                position,
                content: sectionValue(sections, sectionKey),
              },
              update: { content: sectionValue(sections, sectionKey) },
            }),
          ),
        ]),
      isRetryablePrismaError,
    );

    await logActivity(proposalId, "GENERATED");
  } catch (error) {
    await logActivity(proposalId, "GENERATION_FAILED", {
      detail: String(error),
    });
    throw error;
  }
}

function sectionValue(
  sections: Awaited<ReturnType<typeof generateProposalSections>>,
  key: (typeof SECTION_ORDER)[number],
): string {
  const map: Record<(typeof SECTION_ORDER)[number], string> = {
    INTRODUCTION: sections.introduction,
    PROPOSED_SOLUTION: sections.proposedSolution,
    DELIVERABLES: sections.deliverables,
    TIMELINE: sections.timeline,
    PRICING: sections.pricing,
    NEXT_STEPS: sections.nextSteps,
  };
  return map[key];
}
