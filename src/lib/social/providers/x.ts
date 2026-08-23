// X (Twitter) adapter. OAuth 2.0 user context with PKCE.
//
// Auth: per-organization/venture connection established through
// /api/public/oauth/x/authorize -> /api/public/oauth/x/callback. Tokens are
// stored encrypted in social_oauth_credentials and refreshed automatically
// (offline.access is a required scope).
//
// Safety: publish() is gated on X_PUBLISH_ARMED === "true" so a live post is
// impossible until an operator explicitly arms it. Approval gates upstream
// still apply; this adapter never approves anything.
//
// Media: not enabled. X media upload requires a separate upload pipeline
// (v2 POST /2/media/upload + metadata), which the current normalized publish
// path does not carry end to end. Capabilities advertise this honestly.

import type {
  MetricsResult,
  PublishInput,
  PublishResult,
  SocialProviderAdapter,
  SocialProviderImplementationStatus,
} from "./index";

const API_BASE = "https://api.x.com/2";

// Config lives in one place; this adapter never re-derives it.
import { readXConfigStatus, X_REQUIRED_SCOPES } from "./x/config.server";

export const X_SCOPES = [...X_REQUIRED_SCOPES];

function envStatus(): { configured: boolean; missing: string[]; armed: boolean } {
  const s = readXConfigStatus();
  return { configured: s.configured, missing: s.missing, armed: s.armed };
}

async function xFetch(
  path: string,
  init: RequestInit,
  accessToken: string,
): Promise<{ ok: boolean; status: number; body: unknown; providerMessage: string | null }> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (err) {
    return { ok: false, status: 0, body: null, providerMessage: `network_error: ${(err as Error).message}` };
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
    providerMessage: res.ok ? null : `x_http_${res.status}`,
  };
}

export interface XValidationResult {
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
 * Truthful state of the X connection for a given venture. Never fabricates a
 * connected state: missing app credentials, missing connection, and a dead
 * token are three distinct, visible outcomes.
 */
export async function validateXConnection(
  organizationId: string,
  ventureId: string,
): Promise<XValidationResult> {
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
      message: `X app credentials missing: ${env.missing.join(", ")}. Add them in Project Settings, then connect an account.`,
    };
  }

  const { getXAccessToken } = await import("./x/tokens.server");
  const live = await getXAccessToken(organizationId, ventureId);
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
      message: "X app configured. No account connected yet - use Connect to authorize an X account.",
    };
  }

  const res = await xFetch("/users/me?user.fields=username,name", { method: "GET" }, live.accessToken);
  if (!res.ok) {
    return {
      configured: true,
      connected: true,
      reachable: res.status !== 0,
      accountId: live.connection.externalAccountId,
      username: live.connection.externalUsername,
      displayName: live.connection.externalDisplayName,
      grantedCapabilities: live.connection.grantedScopes,
      missingCapabilities: res.status === 401 || res.status === 403 ? ["users.read"] : [],
      armed: env.armed,
      message:
        res.status === 401 || res.status === 403
          ? "X rejected the stored token. Reconnect the account."
          : `X identity lookup failed (${res.providerMessage ?? "unknown"}).`,
    };
  }
  const data = ((res.body as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
  const missingScopes = X_SCOPES.filter((s) => !live.connection.grantedScopes.includes(s));
  return {
    configured: true,
    connected: true,
    reachable: true,
    accountId: typeof data['id'] === "string" ? data['id'] : live.connection.externalAccountId,
    username: typeof data['username'] === "string" ? data['username'] : live.connection.externalUsername,
    displayName: typeof data['name'] === "string" ? data['name'] : live.connection.externalDisplayName,
    grantedCapabilities: live.connection.grantedScopes,
    missingCapabilities: missingScopes,
    armed: env.armed,
    message: env.armed
      ? "X account connected. Publishing is ARMED (X_PUBLISH_ARMED=true)."
      : "X account connected. Publishing is DISARMED (set X_PUBLISH_ARMED='true' to allow live posts).",
  };
}

function buildText(input: PublishInput): string {
  const parts: string[] = [];
  if (input.body) parts.push(input.body);
  if (input.hashtags?.length) {
    parts.push(input.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "));
  }
  if (input.linkUrl) parts.push(input.linkUrl);
  return parts.join("\n\n").trim();
}

export const xAdapter: SocialProviderAdapter = {
  key: "x",
  connectorVersion: "0.1.0",
  get implementationStatus(): SocialProviderImplementationStatus {
    return envStatus().configured ? "implemented" : "blocked_no_credentials";
  },
  getCapabilities() {
    return {
      platform: "x" as const,
      adapterVersion: "0.1.0",
      supportsOAuth: true,
      supportsApiKey: false,
      supportsCredentialRefresh: true,
      requiredScopes: X_SCOPES,
      requiresDestinationSelection: false,
      supportsListDestinations: false,
      supportsPublish: true,
      supportsScheduledPublish: false,
      supportsDelete: true,
      supportsMediaUpload: false,
      supportsMultipleMedia: false,
      supportsAltText: false,
      supportsFirstComment: false,
      supportsLink: true,
      supportsMentions: true,
      supportsHashtags: true,
      maxTextLength: 280,
      maxHashtagCount: 5,
      supportedMediaFormats: [],
      maxMediaCount: 0,
      supportsFetchMetrics: false,
      supportsVerifyPublication: false,
      destinationsMayRequireManualApproval: false,
    };
  },
  async publish(input: PublishInput): Promise<PublishResult> {
    const env = envStatus();
    if (!env.configured) {
      return {
        status: "blocked_missing_credentials",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: `X publish blocked: ${env.missing.join(", ")} not set.`,
      };
    }
    if (!env.armed) {
      return {
        status: "blocked_missing_credentials",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: "X publish DISARMED: set X_PUBLISH_ARMED='true' to allow live posts.",
      };
    }
    const { getXAccessToken } = await import("./x/tokens.server");
    const live = await getXAccessToken(input.organizationId, input.ventureId);
    if (!live) {
      return {
        status: "blocked_missing_credentials",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: "X publish blocked: no live X connection for this venture. Reconnect the account.",
      };
    }
    const text = buildText(input);
    if (!text) {
      return {
        status: "failed",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: "X publish failed: empty post body.",
      };
    }
    if (text.length > 280) {
      return {
        status: "failed",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: `X publish failed: composed text is ${text.length} characters (limit 280).`,
      };
    }
    const res = await xFetch("/tweets", { method: "POST", body: JSON.stringify({ text }) }, live.accessToken);
    if (!res.ok) {
      return {
        status: "failed",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: `x_publish_failed status=${res.status} ${res.providerMessage ?? ""}`.trim(),
        raw: res.body,
      };
    }
    const data = ((res.body as { data?: { id?: string } })?.data ?? {}) as { id?: string };
    const id = typeof data.id === "string" ? data.id : null;
    const handle = live.connection.externalUsername ?? "i";
    return {
      status: "published",
      externalPostId: id,
      externalPostUrl: id ? `https://x.com/${handle}/status/${id}` : null,
      providerMessage: null,
      raw: res.body,
    };
  },
  async fetchMetrics(_externalPostId: string): Promise<MetricsResult> {
    // Tweet metrics need organic-metrics access on the connected user token
    // and a separate quota tier. Not enabled.
    return {};
  },
};
