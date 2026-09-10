import { prisma } from "@/lib/db";
import { sendDiscordAlert } from "@/lib/discord";
import { FAILURE_ACTIONS } from "@/lib/status";
import type { ActivityAction } from "@prisma/client";

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
