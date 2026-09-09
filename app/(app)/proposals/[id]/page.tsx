import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
        sections: proposal.sections,
      }}
      isOwner={isOwner}
    />
  );
}
