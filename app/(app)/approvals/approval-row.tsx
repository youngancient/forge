"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

export function ApprovalRow({
  proposal,
}: {
  proposal: {
    id: string;
    clientName: string;
    companyName: string;
    ownerName: string;
    updatedAt: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");

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
    if (!note.trim()) {
      toast.error("A rejection note is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
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

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <div>
          <Link
            href={`/proposals/${proposal.id}`}
            className="font-medium hover:underline"
          >
            {proposal.companyName}
          </Link>
          <p className="text-sm text-muted-foreground">{proposal.clientName}</p>
          <p className="text-xs text-muted-foreground">
            Created by {proposal.ownerName}
          </p>
        </div>
        <div className="flex gap-2">
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
                value={note}
                onChange={(e) => setNote(e.target.value)}
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
      </CardContent>
    </Card>
  );
}
