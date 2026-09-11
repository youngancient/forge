import { Resend } from "resend";
import { withRetry } from "@/lib/retry";

// Lazily constructed — Resend validates the API key eagerly in its
// constructor, which would otherwise throw during Next.js's build-time route
// analysis (before real env vars are guaranteed to be present).
function getResendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

export interface SendProposalEmailInput {
  clientEmail: string;
  clientName: string;
  companyName: string;
  preparedByName: string;
  preparedByEmail: string;
  proposalLink: string;
  pdfAttachment?: { filename: string; content: Buffer };
}

// Body follows artifact/client-email-template.md structure (design.md decision #1).
function buildEmailBody(input: SendProposalEmailInput): string {
  return `Hi ${input.clientName},

Thanks again for taking the time to speak with us. Based on our conversation, we have put together a customized proposal for your review.

You can view the proposal here: ${input.proposalLink}

This document outlines the project scope, timeline, pricing details, and recommended approach.

If you have any questions or would like to make adjustments, feel free to reach out. We are happy to iterate with you.

Looking forward to hearing your thoughts.

Best regards,

${input.preparedByName}
${input.preparedByEmail}
Koya Talent`;
}

export function sendProposalEmail(input: SendProposalEmailInput): Promise<void> {
  return withRetry(async () => {
    const { error } = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      // to: input.clientEmail,
      to: "tochyokoye@gmail.com",
      subject: `Proposal for ${input.companyName}`,
      text: buildEmailBody(input),
      attachments: input.pdfAttachment
        ? [
          {
            filename: input.pdfAttachment.filename,
            content: input.pdfAttachment.content,
          },
        ]
        : undefined,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }
  });
}
