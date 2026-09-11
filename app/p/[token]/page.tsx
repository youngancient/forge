import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

const SECTION_LABEL: Record<string, string> = {
  INTRODUCTION: "Introduction",
  PROPOSED_SOLUTION: "Proposed Solution",
  DELIVERABLES: "Deliverables",
  TIMELINE: "Timeline",
  PRICING: "Pricing",
  NEXT_STEPS: "Next Steps",
};

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { publicToken: token },
    include: {
      sections: { orderBy: { position: "asc" } },
      owner: { select: { name: true, email: true } },
    },
  });

  // Only ever visible once approved — a leaked token before approval must
  // not expose unreviewed content (design.md decision #19).
  if (!proposal || (proposal.status !== "APPROVED" && proposal.status !== "SENT")) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">
        Proposal for {proposal.clientName}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Prepared by {proposal.owner.name} &lt;
        <a href={`mailto:${proposal.owner.email}`} className="underline hover:text-foreground">
          {proposal.owner.email}
        </a>
        &gt;
      </p>
      <p className="text-sm text-muted-foreground">
        Date: {proposal.dateOfCall.toDateString()}
      </p>

      <a
        href={`/api/public/${token}/pdf`}
        className="mt-6 inline-flex h-9 w-fit items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
      >
        Download PDF
      </a>

      <div className="mt-10 flex flex-col gap-10">
        {proposal.sections.map((section) => (
          <div key={section.id}>
            <h2 className="text-lg font-semibold tracking-[-0.01em]">
              {SECTION_LABEL[section.sectionKey]}
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-foreground">
              {section.content}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
