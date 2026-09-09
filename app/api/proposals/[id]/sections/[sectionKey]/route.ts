import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, apiErrorResponse } from "@/lib/api-auth";
import type { SectionKey } from "@prisma/client";

const bodySchema = z.object({ content: z.string() });

// Manual inline edits — only while the proposal is still a draft
// (design.md: locked once submitted, matches the AI-regenerate route's rule).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionKey: string }> },
) {
  try {
    const session = await requireSession();
    const { id, sectionKey } = await params;
    const { content } = bodySchema.parse(await request.json());

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

    await prisma.proposalSection.update({
      where: {
        proposalId_sectionKey: {
          proposalId: id,
          sectionKey: sectionKey.toUpperCase() as SectionKey,
        },
      },
      data: { content },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
