import { XOAuthClient } from "../../lib/xOAuth.js";

type VerifyCredentialsResponse = {
  id_str?: string;
  screen_name?: string;
  name?: string;
  verified?: boolean;
};

export class XPublisher {
  private readonly oauthClient: XOAuthClient;

  constructor(
    consumerKey?: string,
    consumerSecret?: string,
    accessToken?: string,
    accessTokenSecret?: string
  ) {
    this.oauthClient = new XOAuthClient({
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret
    });
  }

  isConfigured() {
    return this.oauthClient.isConfigured();
  }

  async verifyAccount() {
    if (!this.isConfigured()) {
      return {
        ok: false as const,
        reason: "X OAuth 1.0a user-context credentials are not configured"
      };
    }

    const response = await this.oauthClient.fetch(
      "https://api.x.com/1.1/account/verify_credentials.json?include_entities=false&skip_status=true"
    );

    if (!response.ok) {
      return {
        ok: false as const,
        code: response.status,
        reason: await response.text()
      };
    }

    const json = (await response.json()) as VerifyCredentialsResponse;

    return {
      ok: true as const,
      account: {
        id: json.id_str,
        username: json.screen_name,
        name: json.name,
        verified: json.verified ?? false
      }
    };
  }

  async publish(text: string) {
    if (!this.isConfigured()) {
      return {
        status: "skipped",
        reason: "X OAuth 1.0a user-context credentials are not configured"
      };
    }

    const response = await this.oauthClient.fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ text, made_with_ai: true })
    });

    const payload = response.ok ? await response.json().catch(() => null) : null;

    return {
      status: response.ok ? "published" : "failed",
      code: response.status,
      reason: response.ok ? undefined : await response.text().catch(() => "Unknown error"),
      externalPostId:
        payload &&
        typeof payload === "object" &&
        "data" in payload &&
        payload.data &&
        typeof payload.data === "object" &&
        "id" in payload.data &&
        typeof payload.data.id === "string"
          ? payload.data.id
          : undefined
    };
  }
}
