import { prisma } from "@/lib/db";
import { ApprovalRow } from "./approval-row";

export default async function ApprovalsPage() {
  const pending = await prisma.proposal.findMany({
    where: { status: "PENDING_APPROVAL" },
    orderBy: { updatedAt: "asc" },
    include: { owner: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          Awaiting Approval
        </h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} proposal{pending.length === 1 ? "" : "s"} waiting.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing pending. Nice.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((p) => (
            <ApprovalRow
              key={p.id}
              proposal={{
                id: p.id,
                clientName: p.clientName,
                companyName: p.companyName,
                ownerName: p.owner.name,
                updatedAt: p.updatedAt.toISOString(),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
