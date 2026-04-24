import { createHmac, randomBytes } from "node:crypto";

type XOAuthConfig = {
  consumerKey?: string;
  consumerSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
};

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function normalizeParams(params: Array<[string, string]>) {
  return params
    .slice()
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey)
    )
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");
}

export class XOAuthClient {
  constructor(private readonly config: XOAuthConfig) {}

  isConfigured() {
    return Boolean(
      this.config.consumerKey &&
        this.config.consumerSecret &&
        this.config.accessToken &&
        this.config.accessTokenSecret
    );
  }

  private buildAuthorizationHeader(method: string, url: string) {
    if (!this.isConfigured()) {
      throw new Error("X user-context credentials are not configured");
    }

    const parsedUrl = new URL(url);
    const oauthParams: Array<[string, string]> = [
      ["oauth_consumer_key", this.config.consumerKey!],
      ["oauth_nonce", randomBytes(16).toString("hex")],
      ["oauth_signature_method", "HMAC-SHA1"],
      ["oauth_timestamp", Math.floor(Date.now() / 1000).toString()],
      ["oauth_token", this.config.accessToken!],
      ["oauth_version", "1.0"]
    ];

    const requestParams: Array<[string, string]> = [];
    parsedUrl.searchParams.forEach((value, key) => {
      requestParams.push([key, value]);
    });

    const signatureBaseString = [
      method.toUpperCase(),
      percentEncode(`${parsedUrl.origin}${parsedUrl.pathname}`),
      percentEncode(normalizeParams([...requestParams, ...oauthParams]))
    ].join("&");

    const signingKey = `${percentEncode(this.config.consumerSecret!)}&${percentEncode(this.config.accessTokenSecret!)}`;
    const signature = createHmac("sha1", signingKey).update(signatureBaseString).digest("base64");

    const headerParams = [...oauthParams, ["oauth_signature", signature]]
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
      .join(", ");

    return `OAuth ${headerParams}`;
  }

  async fetch(url: string, init: RequestInit = {}) {
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers ?? {});
    headers.set("authorization", this.buildAuthorizationHeader(method, url));

    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return fetch(url, {
      ...init,
      headers
    });
  }
}
