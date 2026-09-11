import Link from "next/link";
import type { Prisma, ProposalStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { STATUS_LABEL, STATUS_BADGE_VARIANT } from "@/lib/status";
import { DeleteProposalButton } from "./delete-proposal-button";
import { SendProposalButton } from "./send-proposal-button";
import { DashboardToolbar } from "./dashboard-toolbar";

const STATUS_VALUES = Object.keys(STATUS_LABEL);

function formatDate(date: Date) {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  const isManager = session!.user.role === "MANAGER";
  const { q, status } = await searchParams;
  const query = q?.trim() ?? "";
  const statusFilter =
    status && STATUS_VALUES.includes(status) ? (status as ProposalStatus) : "";

  // Drafts are a salesperson's work-in-progress — not a manager's concern
  // until submitted for approval.
  const baseWhere: Prisma.ProposalWhereInput = isManager
    ? { status: { not: "DRAFT" } }
    : { ownerId: session!.user.id };

  const filters: Prisma.ProposalWhereInput[] = [baseWhere];
  if (statusFilter) filters.push({ status: statusFilter });
  if (query) {
    filters.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { companyName: { contains: query, mode: "insensitive" } },
        { clientName: { contains: query, mode: "insensitive" } },
        { owner: { name: { contains: query, mode: "insensitive" } } },
      ],
    });
  }

  const proposals = await prisma.proposal.findMany({
    where: { AND: filters },
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { name: true } } },
  });

  const isFiltered = Boolean(query || statusFilter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            {isManager ? "All Proposals" : "Your Proposals"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? "Submitted proposals across the sales team."
              : "Draft, review, and send client proposals."}
          </p>
        </div>
        {!isManager && (
          <Link href="/proposals/new" className={buttonVariants()}>
            New Proposal
          </Link>
        )}
      </div>

      <DashboardToolbar
        currentQuery={query}
        currentStatus={statusFilter || "ALL"}
        isManager={isManager}
      />

      {proposals.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {isFiltered
            ? "No proposals match your search."
            : "No proposals yet."}
        </Card>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {proposals.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted"
            >
              <Link
                href={`/proposals/${p.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {p.title ?? "Untitled Proposal"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {p.companyName} · {p.clientName}
                  </span>
                  {isManager && (
                    <span className="truncate text-xs text-muted-foreground">
                      Created by {p.owner.name}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge variant={STATUS_BADGE_VARIANT[p.status]}>
                    {STATUS_LABEL[p.status]}
                  </Badge>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(p.updatedAt)}
                  </span>
                </div>
              </Link>
              <div className="w-9 shrink-0">
                {p.status === "DRAFT" && p.ownerId === session!.user.id && (
                  <DeleteProposalButton
                    proposalId={p.id}
                    companyName={p.companyName}
                  />
                )}
                {p.status === "APPROVED" &&
                  !p.sentAt &&
                  p.ownerId === session!.user.id && (
                    <SendProposalButton
                      proposalId={p.id}
                      companyName={p.companyName}
                      clientName={p.clientName}
                      clientEmail={p.clientEmail}
                    />
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
