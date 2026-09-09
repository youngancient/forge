import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager, apiErrorResponse } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { generateProposalPdf } from "@/lib/pdf";

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

    const proposal = await prisma.proposal.findUniqueOrThrow({
      where: { id },
      include: { sections: true },
    });
    const section = (key: string) =>
      proposal.sections.find((s) => s.sectionKey === key)?.content ?? "";

    try {
      const pdfUrl = await generateProposalPdf(id, {
        clientName: proposal.clientName,
        companyName: proposal.companyName,
        salespersonName: proposal.salespersonName,
        dateOfCall: proposal.dateOfCall.toDateString(),
        introduction: section("INTRODUCTION"),
        proposedSolution: section("PROPOSED_SOLUTION"),
        deliverables: section("DELIVERABLES"),
        timeline: section("TIMELINE"),
        pricing: section("PRICING"),
        nextSteps: section("NEXT_STEPS"),
      });

      await prisma.proposal.update({ where: { id }, data: { pdfUrl } });
      await logActivity(id, "PDF_GENERATED");
    } catch (error) {
      // approval itself already succeeded; PDF failure is surfaced but does
      // not roll back the approval — the manager can see it failed and retry
      // export later once the underlying issue is fixed.
      await logActivity(id, "PDF_GENERATION_FAILED", { detail: String(error) });
      return NextResponse.json(
        { ok: true, pdfFailed: true },
        { status: 207 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
