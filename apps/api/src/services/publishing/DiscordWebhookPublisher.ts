export class DiscordWebhookPublisher {
  constructor(private readonly webhookUrl?: string) {}

  async publish(message: string) {
    if (!this.webhookUrl) {
      return {
        status: "skipped",
        reason: "DISCORD_WEBHOOK_URL not configured"
      };
    }

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ content: message })
    });

    return {
      status: response.ok ? "published" : "failed",
      code: response.status
    };
  }
}

