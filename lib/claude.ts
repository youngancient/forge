import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { withRetry, NonRetryableError } from "@/lib/retry";

// design.md decision #15: Sonnet 5 for both generation and regeneration —
// not Opus (this is structured business writing, not complex reasoning) and
// not Haiku (regeneration is the moment a salesperson wants *better* output).
const MODEL = "claude-sonnet-5";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const sectionsSchema = z.object({
  introduction: z.string().min(1),
  proposedSolution: z.string().min(1),
  deliverables: z.string().min(1),
  timeline: z.string().min(1),
  pricing: z.string().min(1),
  nextSteps: z.string().min(1),
});

export type ProposalSections = z.infer<typeof sectionsSchema>;

const SECTIONS_TOOL: Anthropic.Tool = {
  name: "write_proposal_sections",
  description: "Write the content for each section of the client proposal.",
  input_schema: {
    type: "object",
    properties: {
      introduction: {
        type: "string",
        description:
          "Opening section thanking the client and framing their needs.",
      },
      proposedSolution: {
        type: "string",
        description:
          "The recommended approach — how the project scope will be addressed.",
      },
      deliverables: {
        type: "string",
        description: "The concrete deliverables the client will receive.",
      },
      timeline: {
        type: "string",
        description: "The proposed timeline, based only on the input given.",
      },
      pricing: {
        type: "string",
        description: "The estimated pricing, based only on the input given.",
      },
      nextSteps: {
        type: "string",
        description: "What happens if the client wants to proceed.",
      },
    },
    required: [
      "introduction",
      "proposedSolution",
      "deliverables",
      "timeline",
      "pricing",
      "nextSteps",
    ],
  },
};

const SYSTEM_PROMPT = `You are a proposal writer for a professional services company. You write clear, structured, client-ready proposals from the sales team's intake notes.

Rules:
- Use only the facts given in the intake fields and supporting material. Never invent client-specific details — especially pricing, timeline, or scope — that were not provided.
- Write in a warm, professional, confident tone suitable for sending directly to a client.
- If supporting material is provided, weave in specific, relevant details from it rather than writing generically.
- Call the write_proposal_sections tool exactly once with the full content for every section.`;

export interface GenerationInput {
  clientName: string;
  companyName: string;
  clientNeedsSummary: string;
  projectScope: string;
  goalsAndObjectives: string;
  recommendedServices: string;
  proposedTimeline: string;
  estimatedPricing: string;
  supportingMaterial?: string;
}

function buildUserPrompt(input: GenerationInput): string {
  return `Write a proposal for the following intake:

Client name: ${input.clientName}
Company: ${input.companyName}
Summary of client's needs: ${input.clientNeedsSummary}
Project scope: ${input.projectScope}
Goals and objectives: ${input.goalsAndObjectives}
Recommended services / deliverables: ${input.recommendedServices}
Proposed timeline: ${input.proposedTimeline}
Estimated pricing: ${input.estimatedPricing}
${input.supportingMaterial ? `\nSupporting material from the sales call:\n${input.supportingMaterial}` : ""}`;
}

function isRetryableAnthropicError(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    return error.status === undefined || error.status >= 500 || error.status === 429;
  }
  return true; // network errors etc.
}

function extractToolInput(message: Anthropic.Message): unknown {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new NonRetryableError("Claude did not call the expected tool.");
  }
  return toolUse.input;
}

async function callTool<T>(
  schema: z.ZodType<T>,
  tool: Anthropic.Tool,
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  // one retry on malformed/incomplete output, on top of the transient-failure
  // retries below (design.md decision #16).
  let lastParseError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await withRetry(
      () =>
        client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          tools: [tool],
          tool_choice: { type: "tool", name: tool.name },
        }),
      isRetryableAnthropicError,
    );

    const parsed = schema.safeParse(extractToolInput(message));
    if (parsed.success) return parsed.data;
    lastParseError = parsed.error;
  }

  throw new Error(
    `Claude returned malformed content after retrying: ${String(lastParseError)}`,
  );
}

export function generateProposalSections(
  input: GenerationInput,
): Promise<ProposalSections> {
  return callTool(
    sectionsSchema,
    SECTIONS_TOOL,
    SYSTEM_PROMPT,
    buildUserPrompt(input),
  );
}

const singleSectionSchema = z.object({ content: z.string().min(1) });

const SINGLE_SECTION_TOOL: Anthropic.Tool = {
  name: "write_section",
  description: "Write the rewritten content for a single proposal section.",
  input_schema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The rewritten section content, ready to send to the client.",
      },
    },
    required: ["content"],
  },
};

// Uses a dedicated single-field tool rather than reusing write_proposal_sections:
// regeneration only ever has the current content of *this* section, so forcing
// the model to also fill the other five (required) fields would make it
// fabricate content for sections it has no context for — wasted cost and a
// real risk of inventing details, which decision #9 explicitly rules out.
export async function regenerateSection(
  sectionKey: keyof ProposalSections,
  input: GenerationInput,
  currentContent: string,
  instruction?: string,
): Promise<string> {
  const prompt = `Here is the current version of the "${sectionKey}" section of a client proposal:

"""
${currentContent}
"""

Original intake this proposal was built from:
${buildUserPrompt(input)}

Rewrite only this section${instruction ? ` with this instruction: ${instruction}` : ", improving clarity and quality"}. Call write_section with the rewritten text.`;

  const result = await callTool(
    singleSectionSchema,
    SINGLE_SECTION_TOOL,
    SYSTEM_PROMPT,
    prompt,
  );
  return result.content;
}
