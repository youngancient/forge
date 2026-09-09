// design.md decision #13: alerts go through the existing Discord bot's REST
// API, not a separate webhook. Best-effort/fire-and-forget — a Discord outage
// must never break the caller's actual operation (design.md, Failure Handling).
export async function sendDiscordAlert(message: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_ALERT_CHANNEL_ID;

  if (!token || !channelId) return;

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: message.slice(0, 1900) }),
      },
    );

    if (!response.ok) {
      console.error("Discord alert failed:", response.status, await response.text());
    }
  } catch (error) {
    console.error("Discord alert failed:", error);
  }
}
