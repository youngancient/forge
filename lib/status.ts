import type { ActivityAction, ProposalStatus } from "@prisma/client";

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
  "muted" | "accent" | "success" | "warning" | "danger" | "info"
> = {
  DRAFT: "info",
  PENDING_APPROVAL: "warning",
  APPROVED: "accent",
  SENDING: "warning",
  SENT: "success",
  REJECTED: "danger",
};

export const FAILURE_ACTIONS: ActivityAction[] = [
  "GENERATION_FAILED",
  "SECTION_REGENERATION_FAILED",
  "PDF_GENERATION_FAILED",
  "SEND_FAILED",
];

export const ACTIVITY_ACTION_LABEL: Record<ActivityAction, string> = {
  GENERATED: "Proposal generated",
  GENERATION_FAILED: "Generation failed",
  SECTION_REGENERATED: "Section regenerated",
  SECTION_REGENERATION_FAILED: "Section regeneration failed",
  SUBMITTED_FOR_APPROVAL: "Submitted for approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ALREADY_PROCESSED: "Duplicate action ignored",
  PDF_GENERATED: "PDF generated",
  PDF_GENERATION_FAILED: "PDF generation failed",
  SENT: "Sent to client",
  SEND_FAILED: "Send failed",
  ALREADY_SENT: "Duplicate send ignored",
  SEND_RECLAIMED_AFTER_STALL: "Send retried after stall",
  LOGGING_FAILED: "Logging failed",
  SUPPORTING_FILE_EXTRACTION_FAILED: "Supporting file extraction failed",
  USER_CONFIRMED_PROCEED_WITHOUT_FILE: "Proceeded without supporting file",
  USER_REUPLOADED_FILE: "Re-uploaded supporting file",
  CLONED: "Cloned into new draft",
};
