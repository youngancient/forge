"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { ProposalStatus, SectionKey } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { STATUS_LABEL, STATUS_BADGE_VARIANT } from "@/lib/status";

const SECTION_LABEL: Record<SectionKey, string> = {
  INTRODUCTION: "1. Introduction",
  PROPOSED_SOLUTION: "2. Proposed Solution",
  DELIVERABLES: "3. Deliverables",
  TIMELINE: "4. Timeline",
  PRICING: "5. Pricing",
  NEXT_STEPS: "6. Next Steps",
};

interface Section {
  id: string;
  sectionKey: SectionKey;
  content: string;
  position: number;
}

interface SerializedProposal {
  id: string;
  status: ProposalStatus;
  clientName: string;
  clientEmail: string;
  companyName: string;
  salespersonName: string;
  dateOfCall: string;
  rejectionNote: string | null;
  pdfUrl: string | null;
  sections: Section[];
}

export function ProposalDetail({
  proposal,
  isOwner,
}: {
  proposal: SerializedProposal;
  isOwner: boolean;
}) {
  const router = useRouter();
  const isDraft = proposal.status === "DRAFT";
  const canAct = isOwner && isDraft;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            {proposal.companyName}
          </h1>
          <p className="text-sm text-muted-foreground">{proposal.clientName}</p>
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[proposal.status]}>
          {STATUS_LABEL[proposal.status]}
        </Badge>
      </div>

      {proposal.status === "REJECTED" && proposal.rejectionNote && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-danger">Rejection note</p>
            <p className="mt-1 text-sm text-foreground">
              {proposal.rejectionNote}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {proposal.sections.map((section) => (
          <SectionCard
            key={section.id}
            proposalId={proposal.id}
            section={section}
            editable={canAct}
          />
        ))}
      </div>

      <ActionBar proposal={proposal} isOwner={isOwner} router={router} />
    </div>
  );
}

function SectionCard({
  proposalId,
  section,
  editable,
}: {
  proposalId: string;
  section: Section;
  editable: boolean;
}) {
  const [content, setContent] = useState(section.content);
  const [instruction, setInstruction] = useState("");
  const [showInstruction, setShowInstruction] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function saveEdit() {
    if (content === section.content) return;
    const res = await fetch(
      `/api/proposals/${proposalId}/sections/${section.sectionKey}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      },
    );
    if (!res.ok) toast.error("Couldn't save your edit.");
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/sections/${section.sectionKey}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction }),
        },
      );
      if (!res.ok) {
        toast.error("Regeneration failed — please try again.");
        return;
      }
      const { content: newContent } = await res.json();
      setContent(newContent);
      setShowInstruction(false);
      setInstruction("");
      toast.success("Section regenerated.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">
          {SECTION_LABEL[section.sectionKey]}
        </CardTitle>
        {editable && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={regenerating}
              onClick={() => setShowInstruction((v) => !v)}
            >
              Regenerate
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editable && showInstruction && (
          <div className="flex gap-2">
            <Input
              placeholder="Optional instruction (e.g. make this more concise)"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              disabled={regenerating}
              onClick={regenerate}
            >
              {regenerating ? "Working…" : "Go"}
            </Button>
          </div>
        )}
        {editable ? (
          <Textarea
            className="min-h-32"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={saveEdit}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {content}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionBar({
  proposal,
  isOwner,
  router,
}: {
  proposal: SerializedProposal;
  isOwner: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [attachPdf, setAttachPdf] = useState(false);

  async function submitForApproval() {
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/submit`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Couldn't submit for approval.");
        return;
      }
      toast.success("Submitted for approval.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachPdf }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Failed to send. Please try again.");
        return;
      }
      toast.success("Proposal sent to client.");
      setSendOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clone() {
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/clone`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Couldn't create a new draft.");
        return;
      }
      const { id } = await res.json();
      router.push(`/proposals/${id}`);
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner) return null;

  if (proposal.status === "DRAFT") {
    return (
      <Button disabled={busy} onClick={submitForApproval} className="self-start">
        Submit for Approval
      </Button>
    );
  }

  if (proposal.status === "APPROVED") {
    return (
      <div className="flex gap-2">
        <Dialog open={sendOpen} onOpenChange={setSendOpen}>
          <Button onClick={() => setSendOpen(true)}>Send to Client</Button>
          <DialogContent>
            <DialogTitle>Send to {proposal.clientName}</DialogTitle>
            <DialogDescription className="mt-2">
              This will email the proposal link to {proposal.clientEmail}.
            </DialogDescription>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={(e) => setAttachPdf(e.target.checked)}
              />
              Attach PDF copy
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button disabled={busy} onClick={send}>
                {busy ? "Sending…" : "Send"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {proposal.pdfUrl && (
          <a
            href={`/api/proposals/${proposal.id}/pdf`}
            className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Export PDF
          </a>
        )}
      </div>
    );
  }

  if (proposal.status === "SENT" || proposal.status === "REJECTED") {
    return (
      <div className="flex gap-2">
        <Button disabled={busy} onClick={clone}>
          {proposal.status === "REJECTED"
            ? "Revise & Create New Draft"
            : "Clone to New Draft"}
        </Button>
        {proposal.pdfUrl && (
          <a
            href={`/api/proposals/${proposal.id}/pdf`}
            className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Export PDF
          </a>
        )}
      </div>
    );
  }

  return null;
}
