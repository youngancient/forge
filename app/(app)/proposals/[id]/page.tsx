import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FAILURE_ACTIONS } from "@/lib/status";
import { ProposalDetail } from "./proposal-detail";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { sections: { orderBy: { position: "asc" } } },
  });

  if (!proposal) notFound();

  const isOwner = proposal.ownerId === session!.user.id;
  const isManager = session!.user.role === "MANAGER";
  if (!isOwner && !isManager) redirect("/dashboard");

  // design.md: the activity log must be visible to the proposal's owner and
  // any manager — both roles already passed the gate above. Not shown for
  // drafts (project decision: draft-stage activity isn't audit-relevant).
  const activity =
    proposal.status === "DRAFT"
      ? []
      : await prisma.activityLog.findMany({
        where: { proposalId: id },
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
      });

  return (
    <ProposalDetail
      proposal={{
        id: proposal.id,
        status: proposal.status,
        clientName: proposal.clientName,
        clientEmail: proposal.clientEmail,
        companyName: proposal.companyName,
        salespersonName: proposal.salespersonName,
        dateOfCall: proposal.dateOfCall.toISOString(),
        rejectionNote: proposal.rejectionNote,
        pdfUrl: proposal.pdfUrl,
        sections: proposal.sections.map((s) => ({
          id: s.id,
          sectionKey: s.sectionKey,
          content: s.content,
          position: s.position,
          updatedAt: s.updatedAt.toISOString(),
        })),
      }}
      isOwner={isOwner}
      activity={activity.map((entry) => ({
        id: entry.id,
        action: entry.action,
        // Failure details are raw caught errors (stack traces, internal
        // paths) — fine for Discord/server logs, never sent to the browser.
        detail: FAILURE_ACTIONS.includes(entry.action)
          ? "An internal error occurred — the team has been notified."
          : entry.detail,
        actorName: entry.actor?.name ?? null,
        createdAt: entry.createdAt.toISOString(),
      }))}
    />
  );
}
