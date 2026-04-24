type XMetricsResponse = {
  data?: {
    id: string;
    public_metrics?: {
      like_count?: number;
      retweet_count?: number;
      reply_count?: number;
      quote_count?: number;
      bookmark_count?: number;
      impression_count?: number;
    };
  };
};

export class XAnalyticsService {
  constructor(private readonly bearerToken?: string) {}

  isConfigured() {
    return Boolean(this.bearerToken);
  }

  async fetchTweetPublicMetrics(tweetId: string) {
    if (!this.bearerToken) {
      return {
        ok: false as const,
        reason: "X_BEARER_TOKEN not configured"
      };
    }

    const response = await fetch(
      `https://api.x.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
      {
        headers: {
          authorization: `Bearer ${this.bearerToken}`
        }
      }
    );

    if (!response.ok) {
      return {
        ok: false as const,
        code: response.status,
        reason: await response.text()
      };
    }

    const json = (await response.json()) as XMetricsResponse;
    const metrics = json.data?.public_metrics;

    return {
      ok: true as const,
      tweetId,
      metrics: {
        impressions: metrics?.impression_count ?? 0,
        engagements:
          (metrics?.like_count ?? 0) +
          (metrics?.retweet_count ?? 0) +
          (metrics?.reply_count ?? 0) +
          (metrics?.quote_count ?? 0) +
          (metrics?.bookmark_count ?? 0),
        clicks: 0,
        shares: (metrics?.retweet_count ?? 0) + (metrics?.quote_count ?? 0),
        comments: metrics?.reply_count ?? 0,
        likes: metrics?.like_count ?? 0,
        reposts: metrics?.retweet_count ?? 0,
        quotes: metrics?.quote_count ?? 0,
        bookmarks: metrics?.bookmark_count ?? 0
      }
    };
  }
}

