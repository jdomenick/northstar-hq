// Reddit adapter. OAuth 2.0 web-app authorization code (Reddit has no PKCE).
//
// Auth: per-organization/venture connection established through
// /api/public/oauth/reddit/authorize -> /api/public/oauth/reddit/callback.
// Tokens are stored encrypted in social_oauth_credentials, the same store the
// X connection uses, and refreshed automatically (duration=permanent).
//
// Safety: publish() is gated on REDDIT_PUBLISH_ARMED === "true" so a live
// submission is impossible until an operator explicitly arms it. Approval
// gates upstream still apply; this adapter never approves anything.
//
// Media: not enabled. Reddit media submissions require a separate asset lease
// upload pipeline the normalized publish path does not carry.

import type {
  MetricsResult,
  PublishInput,
  PublishResult,
  SocialProviderAdapter,
  SocialProviderImplementationStatus,
} from "./index";
import {
  REDDIT_API_BASE,
  REDDIT_REQUIRED_SCOPES,
  REDDIT_USER_AGENT,
  readRedditConfigStatus,
} from "./reddit/config.server";

export const REDDIT_SCOPES = [...REDDIT_REQUIRED_SCOPES];

function envStatus(): { configured: boolean; missing: string[]; armed: boolean } {
  const s = readRedditConfigStatus();
  return { configured: s.configured, missing: s.missing, armed: s.armed };
}

async function redditFetch(
  path: string,
  init: RequestInit,
  accessToken: string,
): Promise<{ ok: boolean; status: number; body: unknown; providerMessage: string | null }> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("User-Agent", REDDIT_USER_AGENT);
  headers.set("Accept", "application/json");
  let res: Response;
  try {
    res = await fetch(`${REDDIT_API_BASE}${path}`, { ...init, headers });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: null,
      providerMessage: `network_error: ${(err as Error).message}`,
    };
  }
  let body: unknown = null;
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return {
    ok: res.ok,
    status: res.status,
    body,
    providerMessage: res.ok ? null : `reddit_http_${res.status}`,
  };
}

export interface RedditValidationResult {
  configured: boolean;
  connected: boolean;
  reachable: boolean;
  accountId: string | null;
  username: string | null;
  displayName: string | null;
  grantedCapabilities: string[];
  missingCapabilities: string[];
  armed: boolean;
  message: string;
}

/**
 * Truthful state of the Reddit connection for a venture. Missing app
 * credentials, missing connection, and a dead token are three distinct,
 * visible outcomes. Never fabricates a connected state.
 */
export async function validateRedditConnection(
  organizationId: string,
  ventureId: string,
): Promise<RedditValidationResult> {
  const env = envStatus();
  if (!env.configured) {
    return {
      configured: false,
      connected: false,
      reachable: false,
      accountId: null,
      username: null,
      displayName: null,
      grantedCapabilities: [],
      missingCapabilities: env.missing,
      armed: false,
      message: `Reddit app credentials missing: ${env.missing.join(", ")}. Add them in Project Settings, then connect an account.`,
    };
  }

  const { getRedditAccessToken } = await import("./reddit/tokens.server");
  const live = await getRedditAccessToken(organizationId, ventureId);
  if (!live) {
    return {
      configured: true,
      connected: false,
      reachable: false,
      accountId: null,
      username: null,
      displayName: null,
      grantedCapabilities: [],
      missingCapabilities: ["oauth_connection"],
      armed: env.armed,
      message:
        "Reddit app configured. No account connected yet - use Connect to authorize a Reddit account.",
    };
  }

  const res = await redditFetch("/api/v1/me", { method: "GET" }, live.accessToken);
  if (!res.ok) {
    const authFailure = res.status === 401 || res.status === 403;
    return {
      configured: true,
      connected: true,
      reachable: res.status !== 0,
      accountId: live.connection.externalAccountId,
      username: live.connection.externalUsername,
      displayName: live.connection.externalDisplayName,
      grantedCapabilities: live.connection.grantedScopes,
      missingCapabilities: authFailure ? ["identity"] : [],
      armed: env.armed,
      message: authFailure
        ? "Reddit rejected the stored token. Reconnect the account."
        : `Reddit identity lookup failed (${res.providerMessage ?? "unknown"}).`,
    };
  }
  const data = (res.body ?? {}) as Record<string, unknown>;
  const missingScopes = REDDIT_SCOPES.filter((s) => !live.connection.grantedScopes.includes(s));
  return {
    configured: true,
    connected: true,
    reachable: true,
    accountId: typeof data['id'] === "string" ? data['id'] : live.connection.externalAccountId,
    username: typeof data['name'] === "string" ? data['name'] : live.connection.externalUsername,
    displayName:
      typeof data['name'] === "string" ? `u/${data['name']}` : live.connection.externalDisplayName,
    grantedCapabilities: live.connection.grantedScopes,
    missingCapabilities: missingScopes,
    armed: env.armed,
    message: env.armed
      ? "Reddit account connected. Publishing is ARMED (REDDIT_PUBLISH_ARMED=true)."
      : "Reddit account connected. Publishing is DISARMED (set REDDIT_PUBLISH_ARMED='true' to allow live submissions).",
  };
}

function buildTitle(input: PublishInput): string {
  const raw = (input.title ?? input.body ?? "").trim().replace(/\s+/g, " ");
  return raw.length > 300 ? `${raw.slice(0, 297)}...` : raw;
}

export const redditAdapter: SocialProviderAdapter = {
  key: "reddit",
  connectorVersion: "0.1.0",
  get implementationStatus(): SocialProviderImplementationStatus {
    return envStatus().configured ? "implemented" : "blocked_no_credentials";
  },
  getCapabilities() {
    return {
      platform: "reddit" as const,
      adapterVersion: "0.1.0",
      supportsOAuth: true,
      supportsApiKey: false,
      supportsCredentialRefresh: true,
      requiredScopes: REDDIT_SCOPES,
      requiresDestinationSelection: true,
      supportsListDestinations: false,
      supportsPublish: true,
      supportsScheduledPublish: false,
      supportsDelete: false,
      supportsMediaUpload: false,
      supportsMultipleMedia: false,
      supportsAltText: false,
      supportsFirstComment: false,
      supportsLink: true,
      supportsMentions: false,
      supportsHashtags: false,
      maxTextLength: 40000,
      maxHashtagCount: 0,
      supportedMediaFormats: [],
      maxMediaCount: 0,
      supportsFetchMetrics: false,
      supportsVerifyPublication: false,
      destinationsMayRequireManualApproval: true,
    };
  },
  async publish(input: PublishInput): Promise<PublishResult> {
    const env = envStatus();
    if (!env.configured) {
      return {
        status: "blocked_missing_credentials",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: `Reddit publish blocked: ${env.missing.join(", ")} not set.`,
      };
    }
    if (!env.armed) {
      return {
        status: "blocked_missing_credentials",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage:
          "Reddit publish DISARMED: set REDDIT_PUBLISH_ARMED='true' to allow live submissions.",
      };
    }
    // Reddit requires an explicit target subreddit. socialAccountId carries the
    // operator-selected destination in the normalized contract; without it we
    // refuse rather than guessing a subreddit.
    const subreddit = (input.socialAccountId ?? "").trim();
    if (!subreddit) {
      return {
        status: "blocked_missing_credentials",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: "Reddit publish blocked: no target subreddit selected for this item.",
      };
    }
    const { getRedditAccessToken } = await import("./reddit/tokens.server");
    const live = await getRedditAccessToken(input.organizationId, input.ventureId);
    if (!live) {
      return {
        status: "blocked_missing_credentials",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage:
          "Reddit publish blocked: no live Reddit connection for this venture. Reconnect the account.",
      };
    }
    const title = buildTitle(input);
    if (!title) {
      return {
        status: "failed",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: "Reddit publish failed: empty title.",
      };
    }
    const form = new URLSearchParams({
      sr: subreddit.replace(/^\/?r\//, ""),
      title,
      api_type: "json",
      kind: input.linkUrl ? "link" : "self",
    });
    if (input.linkUrl) form.set("url", input.linkUrl);
    else form.set("text", input.body ?? "");

    const res = await redditFetch(
      "/api/submit",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      },
      live.accessToken,
    );
    const json = (res.body ?? {}) as { json?: { errors?: unknown[]; data?: { id?: string; url?: string } } };
    const errors = json.json?.errors ?? [];
    if (!res.ok || errors.length > 0) {
      return {
        status: "failed",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage:
          `reddit_publish_failed status=${res.status} ${res.providerMessage ?? ""} ${errors.length ? JSON.stringify(errors) : ""}`.trim(),
        raw: res.body,
      };
    }
    return {
      status: "published",
      externalPostId: json.json?.data?.id ?? null,
      externalPostUrl: json.json?.data?.url ?? null,
      providerMessage: null,
      raw: res.body,
    };
  },
  async fetchMetrics(_externalPostId: string): Promise<MetricsResult> {
    // Reddit post metrics require a separate listing fetch per thing id and are
    // not part of this connection pass.
    return {};
  },
};
