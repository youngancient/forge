import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { STATUS_LABEL, STATUS_BADGE_VARIANT } from "@/lib/status";

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
            <Link
              key={p.id}
              href={`/proposals/${p.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{p.companyName}</span>
                <span className="text-sm text-muted-foreground">
                  {p.clientName}
                  {isManager ? ` · ${p.owner.name}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {p.updatedAt.toLocaleDateString()}
                </span>
                <Badge variant={STATUS_BADGE_VARIANT[p.status]}>
                  {STATUS_LABEL[p.status]}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
