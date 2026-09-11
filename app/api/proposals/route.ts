import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  proposalIntakeSchema,
  SUPPORTING_FILE_ACCEPT,
  SUPPORTING_FILE_MAX_BYTES,
} from "@/lib/validations";
import { extractTextFromFile, ExtractionError } from "@/lib/extract-text";
import { generatePublicToken } from "@/lib/tokens";
import { runGeneration } from "@/lib/generate-proposal";
import { logActivity } from "@/lib/activity";
import { apiErrorResponse } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function handlePost(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const proceedWithoutFile = formData.get("proceedWithoutFile") === "true";
  const file = formData.get("supportingFile");

  const parsed = proposalIntakeSchema.safeParse({
    clientName: formData.get("clientName"),
    clientEmail: formData.get("clientEmail"),
    companyName: formData.get("companyName"),
    dateOfCall: formData.get("dateOfCall"),
    salespersonName: formData.get("salespersonName"),
    clientNeedsSummary: formData.get("clientNeedsSummary"),
    projectScope: formData.get("projectScope"),
    goalsAndObjectives: formData.get("goalsAndObjectives"),
    recommendedServices: formData.get("recommendedServices"),
    proposedTimeline: formData.get("proposedTimeline"),
    estimatedPricing: formData.get("estimatedPricing"),
    supportingText: formData.get("supportingText") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let supportingFileExtractedText: string | undefined;
  let extractionFailed = false;

  if (file instanceof File && file.size > 0) {
    if (file.size > SUPPORTING_FILE_MAX_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 2MB limit." },
        { status: 400 },
      );
    }
    if (!SUPPORTING_FILE_ACCEPT.includes(file.type as never)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 },
      );
    }

    try {
      supportingFileExtractedText = await extractTextFromFile(file);
    } catch (error) {
      if (!(error instanceof ExtractionError)) throw error;

      if (!proceedWithoutFile) {
        // design.md decision #18: never silently drop or silently proceed —
        // the client must show the explicit re-upload/proceed choice.
        return NextResponse.json(
          { error: "EXTRACTION_FAILED", message: error.message },
          { status: 422 },
        );
      }
      extractionFailed = true;
    }
  }

  const proposal = await prisma.proposal.create({
    data: {
      ownerId: session.user.id,
      publicToken: generatePublicToken(),
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail,
      companyName: parsed.data.companyName,
      dateOfCall: new Date(parsed.data.dateOfCall),
      salespersonName: parsed.data.salespersonName,
      clientNeedsSummary: parsed.data.clientNeedsSummary,
      projectScope: parsed.data.projectScope,
      goalsAndObjectives: parsed.data.goalsAndObjectives,
      recommendedServices: parsed.data.recommendedServices,
      proposedTimeline: parsed.data.proposedTimeline,
      estimatedPricing: parsed.data.estimatedPricing,
      supportingText: parsed.data.supportingText || undefined,
      supportingFileExtractedText,
    },
  });

  if (extractionFailed) {
    await logActivity(proposal.id, "USER_CONFIRMED_PROCEED_WITHOUT_FILE");
  }

  try {
    await runGeneration(proposal.id);
  } catch (error) {
    // Full detail is already captured server-side via logActivity/Discord
    // inside runGeneration — never forward raw error internals to the client.
    console.error(error);
    return NextResponse.json(
      {
        error: "GENERATION_FAILED",
        proposalId: proposal.id,
        message:
          "The proposal was created, but generating its content failed. You can retry generation from the proposal page.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ id: proposal.id }, { status: 201 });
}
