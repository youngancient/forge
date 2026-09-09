import { prisma } from "@/lib/db";
import { sendDiscordAlert } from "@/lib/discord";
import type { ActivityAction } from "@prisma/client";

const FAILURE_ACTIONS: ActivityAction[] = [
  "GENERATION_FAILED",
  "SECTION_REGENERATION_FAILED",
  "PDF_GENERATION_FAILED",
  "SEND_FAILED",
];

export async function logActivity(
  proposalId: string,
  action: ActivityAction,
  options: { actorId?: string; detail?: string } = {},
): Promise<void> {
  await prisma.activityLog.create({
    data: {
      proposalId,
      action,
      actorId: options.actorId,
      detail: options.detail,
    },
  });

  if (FAILURE_ACTIONS.includes(action)) {
    // best-effort, never throws (design.md: Failure Handling)
    void sendDiscordAlert(
      `⚠️ Forge: ${action} on proposal ${proposalId}${options.detail ? ` — ${options.detail}` : ""}`,
    );
  }
}
