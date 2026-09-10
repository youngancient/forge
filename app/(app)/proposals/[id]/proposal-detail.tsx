"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown } from "lucide-react";
import type { ActivityAction, ProposalStatus, SectionKey } from "@prisma/client";
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
import {
  STATUS_LABEL,
  STATUS_BADGE_VARIANT,
  ACTIVITY_ACTION_LABEL,
  FAILURE_ACTIONS,
} from "@/lib/status";
import { cn } from "@/lib/cn";

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
  updatedAt: string;
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

interface ActivityEntry {
  id: string;
  action: ActivityAction;
  detail: string | null;
  actorName: string | null;
  createdAt: string;
}

export function ProposalDetail({
  proposal,
  isOwner,
  activity,
}: {
  proposal: SerializedProposal;
  isOwner: boolean;
  activity: ActivityEntry[];
}) {
  const router = useRouter();
  const isDraft = proposal.status === "DRAFT";
  const canAct = isOwner && isDraft;
  const generationFailed = isDraft && proposal.sections.length === 0;

  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const hasUnsavedChanges = dirtySections.size > 0;

  const onSectionDirtyChange = useCallback(
    (sectionId: string, isDirty: boolean) => {
      setDirtySections((prev) => {
        const next = new Set(prev);
        if (isDirty) next.add(sectionId);
        else next.delete(sectionId);
        return next;
      });
    },
    [],
  );

  function goBack() {
    // Only trust "back" when we actually navigated here from within the app —
    // a direct load/refresh has nowhere in-app to go back to.
    const canGoBack =
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin);
    if (canGoBack) router.back();
    else router.push("/dashboard");
  }

  function handleBackClick() {
    if (hasUnsavedChanges) setLeaveConfirmOpen(true);
    else goBack();
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 self-start"
        onClick={handleBackClick}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            {proposal.companyName}
          </h1>
          <p className="text-sm text-muted-foreground">{proposal.clientName}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge variant={STATUS_BADGE_VARIANT[proposal.status]}>
            {STATUS_LABEL[proposal.status]}
          </Badge>
          {canAct && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  hasUnsavedChanges ? "bg-muted-foreground" : "bg-success",
                )}
              />
              {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
            </span>
          )}
        </div>
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

      {generationFailed ? (
        <GenerationFailedCard proposalId={proposal.id} isOwner={isOwner} />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {proposal.sections.map((section) => (
              <SectionCard
                key={section.id}
                proposalId={proposal.id}
                section={section}
                editable={canAct}
                onDirtyChange={onSectionDirtyChange}
              />
            ))}
          </div>

          <ActionBar proposal={proposal} isOwner={isOwner} router={router} />
        </>
      )}

      {!isDraft && <ActivityFeed entries={activity} />}

      <Dialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <DialogContent>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription className="mt-2">
            Leave without saving these edits?
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              }
            />
            <Button type="button" variant="destructive" onClick={goBack}>
              Leave anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GenerationFailedCard({
  proposalId,
  isOwner,
}: {
  proposalId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/generate`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Generation failed again — please try once more.");
        return;
      }
      toast.success("Proposal generated.");
      router.refresh();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="flex flex-col items-start gap-3 pt-6">
        <div>
          <p className="text-sm font-medium text-warning">
            Generation failed
          </p>
          <p className="mt-1 text-sm text-foreground">
            This proposal was created, but its content couldn&apos;t be
            generated — no sections exist yet.{" "}
            {isOwner
              ? "You can retry generation below."
              : "Only the owner can retry generation."}
          </p>
        </div>
        {isOwner && (
          <Button type="button" disabled={retrying} onClick={retry}>
            {retrying ? "Generating…" : "Retry Generation"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
        Activity
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-150 ease-[var(--ease-out)] group-open:rotate-180" />
      </summary>
      <div className="flex flex-col divide-y divide-border border-t border-border">
        {entries.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No activity yet.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <span
                  className={cn(
                    "text-sm font-medium",
                    FAILURE_ACTIONS.includes(entry.action)
                      ? "text-danger"
                      : "text-foreground",
                  )}
                >
                  {ACTIVITY_ACTION_LABEL[entry.action]}
                </span>
                {entry.actorName && (
                  <span className="text-sm text-muted-foreground">
                    {" "}
                    · {entry.actorName}
                  </span>
                )}
                {entry.detail && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entry.detail}
                  </p>
                )}
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </details>
  );
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

function SectionCard({
  proposalId,
  section,
  editable,
  onDirtyChange,
}: {
  proposalId: string;
  section: Section;
  editable: boolean;
  onDirtyChange: (sectionId: string, isDirty: boolean) => void;
}) {
  const [content, setContent] = useState(section.content);
  const [instruction, setInstruction] = useState("");
  const [showInstruction, setShowInstruction] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(
    () => new Date(section.updatedAt),
  );
  const contentRef = useRef(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    onDirtyChange(section.id, dirty);
    return () => onDirtyChange(section.id, false);
  }, [dirty, section.id, onDirtyChange]);

  // Standard "unsaved changes" safety net for the narrow window between a
  // keystroke and the debounced/blur save actually completing.
  useEffect(() => {
    if (!editable || !dirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editable, dirty]);

  async function saveEdit(value: string) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/sections/${section.sectionKey}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: value }),
        },
      );
      if (!res.ok) {
        toast.error("Couldn't save your edit.");
        return;
      }
      setDirty(false);
      setLastSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  function onContentChange(value: string) {
    setContent(value);
    contentRef.current = value;
    setDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      saveEdit(contentRef.current);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function flushSave() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (dirty && !saving) saveEdit(contentRef.current);
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
      // A regenerate replaces the section outright, so any pending manual
      // edit debounce would otherwise clobber it a moment later.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setContent(newContent);
      contentRef.current = newContent;
      setDirty(false);
      setLastSavedAt(new Date());
      setShowInstruction(false);
      setInstruction("");
      const sectionName = SECTION_LABEL[section.sectionKey].replace(
        /^\d+\.\s*/,
        "",
      );
      toast.success(`${sectionName} section regenerated.`);
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {saving
                ? "Saving…"
                : `Saved ${lastSavedAt.toDateString() === new Date().toDateString()
                  ? lastSavedAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : lastSavedAt.toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }`}
            </span>
            <Button
              type="button"
              variant="outline"
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
            onChange={(e) => onContentChange(e.target.value)}
            onBlur={flushSave}
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
