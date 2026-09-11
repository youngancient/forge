import { prisma } from "@/lib/db";
import { sendDiscordAlert } from "@/lib/discord";
import { FAILURE_ACTIONS } from "@/lib/status";
import type { ActivityAction } from "@prisma/client";

export async function logActivity(
  proposalId: string,
  action: ActivityAction,
  options: { actorId?: string; detail?: string } = {},
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        proposalId,
        action,
        actorId: options.actorId,
        detail: options.detail,
      },
    });
  } catch (error) {
    // The real operation this call is logging has already succeeded by the
    // time this runs — a DB hiccup writing the log entry must never surface
    // as a failure of that operation. Best-effort visibility instead
    // (console + Discord), not a second activityLog write — that's the
    // thing that just failed.
    console.error(`logActivity failed for ${action} on ${proposalId}:`, error);
    void sendDiscordAlert(
      `⚠️ Forge: failed to record activity log entry (${action}) for proposal ${proposalId} — ${String(error)}`,
    );
  }

  if (FAILURE_ACTIONS.includes(action)) {
    // best-effort, never throws (design.md: Failure Handling)
    void sendDiscordAlert(
      `⚠️ Forge: ${action} on proposal ${proposalId}${options.detail ? ` — ${options.detail}` : ""}`,
    );
  }
}
