import { z } from "zod";

// design.md decision #18: pasted text / extracted file text capped at ~100K
// characters — sized to comfortably fit a full call transcript.
export const SUPPORTING_TEXT_MAX = 100_000;
export const SUPPORTING_FILE_MAX_BYTES = 2 * 1024 * 1024; // 2MB, decision #18

// Caps for the 11 required intake fields — previously unbounded, unlike
// supportingText above. Two tiers: short identity fields, and the 6
// narrative fields sized to comfortably fit several detailed paragraphs
// (not a full transcript — that's what supportingText is for) while still
// bounding worst-case prompt cost.
export const NAME_MAX = 200;
export const EMAIL_MAX = 254; // RFC 5321 practical max
export const DATE_MAX = 32;
export const NARRATIVE_FIELD_MAX = 5_000;
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
const narrativeMaxMessage = `Limited to ${NARRATIVE_FIELD_MAX.toLocaleString()} characters — try summarizing.`;

export const proposalIntakeSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(1, "Client name is required.")
    .max(NAME_MAX, `Limited to ${NAME_MAX} characters.`),
  clientEmail: z
    .string()
    .trim()
    .email("Enter a valid client email address.")
    .max(EMAIL_MAX, `Limited to ${EMAIL_MAX} characters.`),
  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required.")
    .max(NAME_MAX, `Limited to ${NAME_MAX} characters.`),
  dateOfCall: z
    .string()
    .trim()
    .min(1, "Date of call is required.")
    .max(DATE_MAX, `Limited to ${DATE_MAX} characters.`)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Enter a valid date.",
    })
    .refine(
      (value) => {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        return new Date(value).getTime() <= endOfToday.getTime();
      },
      { message: "Date of call cannot be in the future." },
    ),
  salespersonName: z
    .string()
    .trim()
    .min(1, "Salesperson name is required.")
    .max(NAME_MAX, `Limited to ${NAME_MAX} characters.`),
  clientNeedsSummary: z
    .string()
    .trim()
    .min(1, "Summary of client's needs is required.")
    .max(NARRATIVE_FIELD_MAX, narrativeMaxMessage),
  projectScope: z
    .string()
    .trim()
    .min(1, "Project scope is required.")
    .max(NARRATIVE_FIELD_MAX, narrativeMaxMessage),
  goalsAndObjectives: z
    .string()
    .trim()
    .min(1, "Goals and objectives are required.")
    .max(NARRATIVE_FIELD_MAX, narrativeMaxMessage),
  recommendedServices: z
    .string()
    .trim()
    .min(1, "Recommended services or deliverables are required.")
    .max(NARRATIVE_FIELD_MAX, narrativeMaxMessage),
  proposedTimeline: z
    .string()
    .trim()
    .min(1, "Proposed timeline is required.")
    .max(NARRATIVE_FIELD_MAX, narrativeMaxMessage),
  estimatedPricing: z
    .string()
    .trim()
    .min(1, "Estimated pricing is required.")
    .max(NARRATIVE_FIELD_MAX, narrativeMaxMessage),
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
