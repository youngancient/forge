import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { STATUS_LABEL, STATUS_BADGE_VARIANT } from "@/lib/status";
import { DeleteProposalButton } from "./delete-proposal-button";

function formatDate(date: Date) {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const session = await auth();
  const isManager = session!.user.role === "MANAGER";

  const proposals = await prisma.proposal.findMany({
    where: isManager ? {} : { ownerId: session!.user.id },
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            {isManager ? "All Proposals" : "Your Proposals"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? "Company-wide view across the sales team."
              : "Draft, review, and send client proposals."}
          </p>
        </div>
        {!isManager && (
          <Link href="/proposals/new" className={buttonVariants()}>
            New Proposal
          </Link>
        )}
      </div>

      {proposals.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No proposals yet.
        </Card>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {proposals.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted"
            >
              <Link
                href={`/proposals/${p.id}`}
                className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">
                    {p.companyName}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {p.clientName}
                    {isManager ? ` · ${p.owner.name}` : ""}
                  </span>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(p.updatedAt)}
                </span>
                <Badge variant={STATUS_BADGE_VARIANT[p.status]}>
                  {STATUS_LABEL[p.status]}
                </Badge>
              </Link>
              {p.status === "DRAFT" && p.ownerId === session!.user.id && (
                <DeleteProposalButton
                  proposalId={p.id}
                  companyName={p.companyName}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
