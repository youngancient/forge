"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
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
import { NARRATIVE_FIELD_MAX } from "@/lib/validations";
import { cn } from "@/lib/cn";

const SECTION_LABEL: Record<SectionKey, string> = {
  INTRODUCTION: "Introduction",
  PROPOSED_SOLUTION: "Proposed Solution",
  DELIVERABLES: "Deliverables",
  TIMELINE: "Timeline",
  PRICING: "Pricing",
  NEXT_STEPS: "Next Steps",
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
  title: string | null;
  creatorName: string;
  creatorEmail: string;
  clientName: string;
  clientEmail: string;
  companyName: string;
  salespersonName: string;
  dateOfCall: string;
  rejectionNote: string | null;
  sentAt: string | null;
  sections: Section[];
}

interface ActivityEntry {
  id: string;
  action: ActivityAction;
  detail: string | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
}

export function ProposalDetail({
  proposal,
  isOwner,
  isManager,
  currentUserId,
  activity,
}: {
  proposal: SerializedProposal;
  isOwner: boolean;
  isManager: boolean;
  currentUserId: string;
  activity: ActivityEntry[];
}) {
  const router = useRouter();
  const isDraft = proposal.status === "DRAFT";
  const canAct = isOwner && isDraft;
  const generationFailed = isDraft && proposal.sections.length === 0;

  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());
  const [busySections, setBusySections] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const hasUnsavedChanges = dirtySections.size > 0;
  // Covers any in-flight AI call (per-section regenerate, or a full retry
  // after failed generation) — not just unsaved manual edits — since leaving
  // mid-request is just as easy to do accidentally as leaving mid-edit.
  const hasBusyActivity = busySections.size > 0 || retrying;
  const blocksNavigation = hasUnsavedChanges || hasBusyActivity;

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

  const onSectionBusyChange = useCallback(
    (sectionId: string, isBusy: boolean) => {
      setBusySections((prev) => {
        const next = new Set(prev);
        if (isBusy) next.add(sectionId);
        else next.delete(sectionId);
        return next;
      });
    },
    [],
  );

  // A stable wrapper — EditableTitle's onDirtyChange effect depends on this
  // reference, so an inline arrow here would re-run the effect (and thus
  // setDirtySections, which always returns a new Set) on every render.
  const onTitleDirtyChange = useCallback(
    (isDirty: boolean) => onSectionDirtyChange("title", isDirty),
    [onSectionDirtyChange],
  );

  // Same reasoning — ActionBar's busy state (submit/send/clone/approve/
  // reject) wasn't reported to the leave-confirm gate at all before this.
  const onActionBarBusyChange = useCallback(
    (isBusy: boolean) => onSectionBusyChange("actionbar", isBusy),
    [onSectionBusyChange],
  );

  // Same safety net as SectionCard's per-edit beforeunload guard used to be,
  // but centralized here so it also covers busy/retrying — not just dirty.
  useEffect(() => {
    if (!canAct || !blocksNavigation) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [canAct, blocksNavigation]);

  function goBack() {
    // Only trust "back" when we actually navigated here from within the app —
    // a direct load/refresh has nowhere in-app to go back to.
    const canGoBack =
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin);
    if (canGoBack) router.back();
    else router.push("/dashboard");
    // Whichever page we land on (dashboard, approvals list, etc.) may have
    // changed since it was last visited (e.g. this proposal's status just
    // changed) — force a real refetch instead of a stale Router Cache hit.
    router.refresh();
  }

  function handleBackClick() {
    if (blocksNavigation) setLeaveConfirmOpen(true);
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
          {isManager && (
            <p className="text-xs text-muted-foreground">
              Created by {proposal.creatorName} &lt;{proposal.creatorEmail}&gt;
            </p>
          )}
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
        <GenerationFailedCard
          proposalId={proposal.id}
          isOwner={isOwner}
          onRetryingChange={setRetrying}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <EditableTitle
              proposalId={proposal.id}
              title={proposal.title}
              editable={canAct}
              onDirtyChange={onTitleDirtyChange}
            />
            {proposal.sections.map((section) => (
              <SectionCard
                key={section.id}
                proposalId={proposal.id}
                section={section}
                editable={canAct}
                onDirtyChange={onSectionDirtyChange}
                onBusyChange={onSectionBusyChange}
              />
            ))}
          </div>

          <ActionBar
            proposal={proposal}
            isOwner={isOwner}
            isManager={isManager}
            router={router}
            onBusyChange={onActionBarBusyChange}
          />
        </>
      )}

      {!isDraft && (
        <ActivityFeed entries={activity} currentUserId={currentUserId} />
      )}

      <Dialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <DialogContent>
          <DialogTitle>Leave this page?</DialogTitle>
          <DialogDescription className="mt-2">
            You have unsaved changes or a generation in progress. Leave
            anyway?
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
  onRetryingChange,
}: {
  proposalId: string;
  isOwner: boolean;
  onRetryingChange: (isRetrying: boolean) => void;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    onRetryingChange(retrying);
    return () => onRetryingChange(false);
  }, [retrying, onRetryingChange]);

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

function ActivityFeed({
  entries,
  currentUserId,
}: {
  entries: ActivityEntry[];
  currentUserId: string;
}) {
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
                    · {entry.actorId === currentUserId ? "You" : entry.actorName}
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

// Shared by SectionCard's manual-edit autosave and EditableTitle — debounced
// save on change, immediate flush on blur, plus a `replace` escape hatch for
// content swapped in from elsewhere (e.g. an AI regenerate result) that
// should be treated as already-saved, not as a pending edit to debounce.
function useAutosaveField(
  initialValue: string,
  save: (value: string) => Promise<boolean>,
  initialLastSavedAt?: Date,
) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(
    () => initialLastSavedAt ?? new Date(),
  );
  const valueRef = useRef(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function commit(v: string) {
    setSaving(true);
    try {
      const ok = await save(v);
      if (ok) {
        setDirty(false);
        setLastSavedAt(new Date());
      }
    } finally {
      setSaving(false);
    }
  }

  function onChange(v: string) {
    setValue(v);
    valueRef.current = v;
    setDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      commit(valueRef.current);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function flush() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (dirty && !saving) commit(valueRef.current);
  }

  function replace(v: string) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setValue(v);
    valueRef.current = v;
    setDirty(false);
    setLastSavedAt(new Date());
  }

  return { value, onChange, saving, dirty, lastSavedAt, flush, replace };
}

function EditableTitle({
  proposalId,
  title,
  editable,
  onDirtyChange,
}: {
  proposalId: string;
  title: string | null;
  editable: boolean;
  onDirtyChange: (isDirty: boolean) => void;
}) {
  const field = useAutosaveField(title ?? "", async (value) => {
    const res = await fetch(`/api/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value }),
    });
    if (!res.ok) {
      toast.error("Couldn't save the title.");
      return false;
    }
    return true;
  });

  useEffect(() => {
    onDirtyChange(field.dirty);
    return () => onDirtyChange(false);
  }, [field.dirty, onDirtyChange]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Title</CardTitle>
        {editable && (
          <span className="text-xs text-muted-foreground">
            {field.saving
              ? "Saving…"
              : `Saved ${field.lastSavedAt.toDateString() === new Date().toDateString()
                ? field.lastSavedAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : field.lastSavedAt.toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }`}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {editable ? (
          <Input
            value={field.value}
            placeholder="Untitled Proposal"
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.flush}
          />
        ) : (
          <p className="text-sm text-foreground">
            {title || "Untitled Proposal"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SectionCard({
  proposalId,
  section,
  editable,
  onDirtyChange,
  onBusyChange,
}: {
  proposalId: string;
  section: Section;
  editable: boolean;
  onDirtyChange: (sectionId: string, isDirty: boolean) => void;
  onBusyChange: (sectionId: string, isBusy: boolean) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [showInstruction, setShowInstruction] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const field = useAutosaveField(
    section.content,
    async (value) => {
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
        return false;
      }
      return true;
    },
    new Date(section.updatedAt),
  );

  useEffect(() => {
    onDirtyChange(section.id, field.dirty);
    return () => onDirtyChange(section.id, false);
  }, [field.dirty, section.id, onDirtyChange]);

  useEffect(() => {
    onBusyChange(section.id, regenerating);
    return () => onBusyChange(section.id, false);
  }, [regenerating, section.id, onBusyChange]);

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
      field.replace(newContent);
      setShowInstruction(false);
      setInstruction("");
      toast.success(`${SECTION_LABEL[section.sectionKey]} section regenerated.`);
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
              {field.saving
                ? "Saving…"
                : `Saved ${field.lastSavedAt.toDateString() === new Date().toDateString()
                  ? field.lastSavedAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : field.lastSavedAt.toLocaleString([], {
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
          <>
            <Textarea
              className="min-h-32"
              value={field.value}
              maxLength={NARRATIVE_FIELD_MAX}
              disabled={regenerating}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.flush}
            />
            <p className="text-xs text-muted-foreground">
              {field.value.length.toLocaleString()} /{" "}
              {NARRATIVE_FIELD_MAX.toLocaleString()} characters
            </p>
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {field.value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewPdfButton({ proposalId }: { proposalId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // reset so the loader shows again next time this dialog is opened
        if (!next) setLoaded(false);
      }}
    >
      <Button variant="outline" onClick={() => setOpen(true)}>
        Preview PDF
      </Button>
      <DialogContent className="flex h-[85vh] w-full max-w-3xl flex-col p-4">
        <div className="flex items-center justify-between">
          <DialogTitle>Preview PDF</DialogTitle>
          <DialogClose render={<Button variant="ghost" size="sm">Close</Button>} />
        </div>
        <div className="relative mt-3 flex-1">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md border border-border bg-muted/30">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {open && (
            <iframe
              src={`/api/proposals/${proposalId}/pdf?inline=1`}
              title="Proposal PDF preview"
              onLoad={() => setLoaded(true)}
              className="h-full w-full rounded-md border border-border"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionBar({
  proposal,
  isOwner,
  isManager,
  router,
  onBusyChange,
}: {
  proposal: SerializedProposal;
  isOwner: boolean;
  isManager: boolean;
  router: ReturnType<typeof useRouter>;
  onBusyChange: (isBusy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [attachPdf, setAttachPdf] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const isMountedRef = useRef(true);
  // PDFs are generated on-demand (no cached pdfUrl anymore) — available once
  // there's final, approved-or-later content to render.
  const canExportPdf =
    proposal.status !== "DRAFT" && proposal.status !== "PENDING_APPROVAL";
  // Preview is allowed a stage earlier than export/download — a manager can
  // preview exactly what the client would see while still deciding whether
  // to approve or reject (matches PDF_AVAILABLE_STATUSES on the API route).
  const canPreviewPdf = proposal.status !== "DRAFT";

  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    // Reset on mount, not just declared once — React Strict Mode's dev-only
    // mount->cleanup->mount cycle would otherwise leave this stuck at false
    // after the simulated unmount, permanently blocking real navigation.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function approve() {
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Couldn't approve this proposal.");
        return;
      }
      toast.success("Approved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejectionNote.trim()) {
      toast.error("A rejection note is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: rejectionNote }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Couldn't reject this proposal.");
        return;
      }
      toast.success("Rejected.");
      setRejectOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

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
    const isResend = proposal.status === "SENT";
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
      toast.success(
        isResend ? "Proposal resent to client." : "Proposal sent to client.",
      );
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
      toast.success("New draft created.");
      // If the user already navigated away (e.g. clicked Back before this
      // resolved), don't yank them forward to the new draft — the clone
      // still exists, they can find it from the dashboard.
      if (isMountedRef.current) router.push(`/proposals/${id}`);
    } finally {
      setBusy(false);
    }
  }

  if (proposal.status === "PENDING_APPROVAL" && isManager) {
    return (
      <div className="flex gap-2">
        {canPreviewPdf && <PreviewPdfButton proposalId={proposal.id} />}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <Button variant="outline" onClick={() => setRejectOpen(true)}>
            Reject
          </Button>
          <DialogContent>
            <DialogTitle>Reject proposal</DialogTitle>
            <DialogDescription className="mt-2">
              A note is required so the salesperson knows what to fix.
            </DialogDescription>
            <Textarea
              className="mt-4"
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder="What needs to change?"
            />
            <div className="mt-6 flex justify-end gap-2">
              <DialogClose render={<Button variant="outline">Close</Button>} />
              <Button variant="destructive" disabled={busy} onClick={reject}>
                {busy ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button disabled={busy} onClick={approve}>
          Approve
        </Button>
      </div>
    );
  }

  if (!isOwner) {
    // Not this proposal's owner. A manager can still preview the PDF for any
    // non-draft proposal they're allowed to view (page-level `canView` gate) —
    // export/send/clone stay owner-only.
    if (isManager && canPreviewPdf) {
      return (
        <div className="flex gap-2">
          <PreviewPdfButton proposalId={proposal.id} />
        </div>
      );
    }
    return null;
  }

  if (proposal.status === "DRAFT") {
    return (
      <Button disabled={busy} onClick={submitForApproval} className="self-start">
        Submit for Approval
      </Button>
    );
  }

  if (proposal.status === "APPROVED" || proposal.status === "SENT") {
    const isResend = proposal.status === "SENT";
    return (
      <div className="flex gap-2">
        <Dialog open={sendOpen} onOpenChange={setSendOpen}>
          <Button onClick={() => setSendOpen(true)}>
            {isResend ? "Resend to Client" : "Send to Client"}
          </Button>
          <DialogContent>
            <DialogTitle>
              {isResend ? "Resend to" : "Send to"} {proposal.clientName}
            </DialogTitle>
            <DialogDescription className="mt-2">
              This will email the proposal link to {proposal.clientEmail}.
              {isResend && (
                <>
                  {" "}
                  You already sent this proposal
                  {proposal.sentAt
                    ? ` on ${new Date(proposal.sentAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : " before"}
                  .
                </>
              )}
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
              <DialogClose render={<Button variant="outline">Close</Button>} />
              <Button disabled={busy} onClick={send}>
                {busy ? "Sending…" : isResend ? "Resend" : "Send"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {isResend && (
          <Button variant="outline" disabled={busy} onClick={clone}>
            Clone to New Draft
          </Button>
        )}
        {canExportPdf && (
          <>
            <PreviewPdfButton proposalId={proposal.id} />
            <a
              href={`/api/proposals/${proposal.id}/pdf`}
              className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Export PDF
            </a>
          </>
        )}
      </div>
    );
  }

  if (proposal.status === "REJECTED") {
    return (
      <div className="flex gap-2">
        <Button disabled={busy} onClick={clone}>
          Revise & Create New Draft
        </Button>
        {canExportPdf && (
          <>
            <PreviewPdfButton proposalId={proposal.id} />
            <a
              href={`/api/proposals/${proposal.id}/pdf`}
              className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Export PDF
            </a>
          </>
        )}
      </div>
    );
  }

  return null;
}
