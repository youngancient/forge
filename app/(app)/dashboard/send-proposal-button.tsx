"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

export function SendProposalButton({
  proposalId,
  companyName,
  clientName,
  clientEmail,
}: {
  proposalId: string;
  companyName: string;
  clientName: string;
  clientEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachPdf, setAttachPdf] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/send`, {
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
      setOpen(false);
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-9 px-0 text-muted-foreground hover:text-foreground"
        aria-label={`Send proposal for ${companyName} to client`}
        onClick={() => setOpen(true)}
      >
        <Send className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Send to {clientName}</DialogTitle>
          <DialogDescription className="mt-2">
            This will email the proposal link to {clientEmail}.
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
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  Close
                </Button>
              }
            />
            <Button type="button" disabled={sending} onClick={handleSend}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
