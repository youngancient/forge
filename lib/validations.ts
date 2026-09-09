import { z } from "zod";

// design.md decision #18: pasted text / extracted file text capped at ~100K
// characters — sized to comfortably fit a full call transcript.
export const SUPPORTING_TEXT_MAX = 100_000;
export const SUPPORTING_FILE_MAX_BYTES = 2 * 1024 * 1024; // 2MB, decision #18
export const SUPPORTING_FILE_ACCEPT = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;

// design.md decision #9: all 11 intake fields are hard-required.
export const proposalIntakeSchema = z.object({
  clientName: z.string().trim().min(1, "Client name is required."),
  clientEmail: z.string().trim().email("Enter a valid client email address."),
  companyName: z.string().trim().min(1, "Company name is required."),
  dateOfCall: z.string().trim().min(1, "Date of call is required."),
  salespersonName: z.string().trim().min(1, "Salesperson name is required."),
  clientNeedsSummary: z
    .string()
    .trim()
    .min(1, "Summary of client's needs is required."),
  projectScope: z.string().trim().min(1, "Project scope is required."),
  goalsAndObjectives: z
    .string()
    .trim()
    .min(1, "Goals and objectives are required."),
  recommendedServices: z
    .string()
    .trim()
    .min(1, "Recommended services or deliverables are required."),
  proposedTimeline: z.string().trim().min(1, "Proposed timeline is required."),
  estimatedPricing: z.string().trim().min(1, "Estimated pricing is required."),
  supportingText: z
    .string()
    .max(
      SUPPORTING_TEXT_MAX,
      `Supporting notes are limited to ~${SUPPORTING_TEXT_MAX.toLocaleString()} characters — try summarizing or uploading a file instead.`,
    )
    .optional()
    .or(z.literal("")),
});

export type ProposalIntakeInput = z.infer<typeof proposalIntakeSchema>;

export const regenerateSectionSchema = z.object({
  instruction: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const rejectProposalSchema = z.object({
  note: z.string().trim().min(1, "A rejection note is required."),
});

export const sendProposalSchema = z.object({
  attachPdf: z.boolean().default(false),
});
