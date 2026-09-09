import type { ProposalStatus } from "@prisma/client";

export const STATUS_LABEL: Record<ProposalStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  SENDING: "Sending",
  SENT: "Sent",
  REJECTED: "Rejected",
};

export const STATUS_BADGE_VARIANT: Record<
  ProposalStatus,
  "muted" | "accent" | "success" | "warning" | "danger"
> = {
  DRAFT: "muted",
  PENDING_APPROVAL: "warning",
  APPROVED: "accent",
  SENDING: "warning",
  SENT: "success",
  REJECTED: "danger",
};
