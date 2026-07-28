// LinkedIn adapter. Uses the Lovable connector gateway.
//
// Auth: server-only. Requires LOVABLE_API_KEY + LINKEDIN_API_KEY, both
// injected by the workspace-level LinkedIn connector.
//
// Publishing scope: w_member_social (posts as the connected member).
// Identity: /v2/userinfo returns { sub, name, email, ... }. The `sub`
// value is the member id used to build the author URN
// (urn:li:person:{sub}) required by /v2/ugcPosts.
//
// Safety: publish() is gated on LINKEDIN_PUBLISH_ARMED === "true" so a
// live post is impossible until an operator explicitly arms it.

import type {
  SocialProviderAdapter,
  PublishInput,
  PublishResult,
  MetricsResult,
  SocialProviderImplementationStatus,
} from "./index";

const GATEWAY = "https://connector-gateway.lovable.dev/linkedin";

function creds(): { lovable: string; connection: string } | null {
  const lovable = process.env.LOVABLE_API_KEY;
  const connection = process.env.LINKEDIN_API_KEY;
  if (!lovable || !connection) return null;
  return { lovable, connection };
}

function armed(): boolean {
  return process.env.LINKEDIN_PUBLISH_ARMED === "true";
}

async function linkedinFetch(
  path: string,
  init: RequestInit,
  c: { lovable: string; connection: string },
): Promise<{ ok: boolean; status: number; body: unknown; providerMessage: string | null; postId?: string | null }> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${c.lovable}`);
  headers.set("X-Connection-Api-Key", c.connection);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${GATEWAY}${path}`, { ...init, headers });
  } catch (err) {
    return { ok: false, status: 0, body: null, providerMessage: `network_error: ${(err as Error).message}` };
  }
  const postId = res.headers.get("x-restli-id");
  let body: unknown = null;
  const text = await res.text().catch(() => "");
  if (text) {
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
  }
  return {
    ok: res.ok,
    status: res.status,
    body,
    providerMessage: res.ok ? null : `linkedin_http_${res.status}`,
    postId,
  };
}

export interface LinkedInValidationResult {
  configured: boolean;
  reachable: boolean;
  memberId: string | null;
  displayName: string | null;
  email: string | null;
  grantedCapabilities: string[];
  missingCapabilities: string[];
  armed: boolean;
  message: string;
  raw?: unknown;
}

export async function validateLinkedInCredentials(): Promise<LinkedInValidationResult> {
  const c = creds();
  if (!c) {
    return {
      configured: false,
      reachable: false,
      memberId: null,
      displayName: null,
      email: null,
      grantedCapabilities: [],
      missingCapabilities: ["openid", "profile", "email", "w_member_social"],
      armed: false,
      message: "LOVABLE_API_KEY and/or LINKEDIN_API_KEY not set. Ask Lovable to connect the LinkedIn connector.",
    };
  }
  const res = await linkedinFetch("/v2/userinfo", { method: "GET" }, c);
  if (!res.ok) {
    return {
      configured: true,
      reachable: res.status !== 0,
      memberId: null,
      displayName: null,
      email: null,
      grantedCapabilities: [],
      missingCapabilities: ["profile"],
      armed: armed(),
      message:
        res.status === 401 || res.status === 403
          ? "LinkedIn rejected the connection or the token lacks the profile scope."
          : `LinkedIn identity lookup failed (${res.providerMessage ?? "unknown"}).`,
      raw: res.body,
    };
  }
  const info = (res.body ?? {}) as Record<string, unknown>;
  const sub = typeof info.sub === "string" ? info.sub : null;
  const name = typeof info.name === "string" ? info.name : null;
  const email = typeof info.email === "string" ? info.email : null;
  return {
    configured: true,
    reachable: true,
    memberId: sub,
    displayName: name,
    email,
    grantedCapabilities: ["openid", "profile", "email", "w_member_social"],
    missingCapabilities: [],
    armed: armed(),
    message: armed()
      ? "LinkedIn credentials valid. Publishing is ARMED (LINKEDIN_PUBLISH_ARMED=true)."
      : "LinkedIn credentials valid. Publishing is DISARMED (set LINKEDIN_PUBLISH_ARMED='true' to allow live posts).",
    raw: info,
  };
}

function buildText(input: PublishInput): string {
  const parts: string[] = [];
  if (input.title) parts.push(input.title);
  if (input.body) parts.push(input.body);
  if (input.hashtags?.length) parts.push(input.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "));
  if (input.linkUrl) parts.push(input.linkUrl);
  return parts.join("\n\n").trim();
}

export const linkedinAdapter: SocialProviderAdapter = {
  key: "linkedin",
  connectorVersion: "0.1.0",
  get implementationStatus(): SocialProviderImplementationStatus {
    if (!creds()) return "blocked_no_credentials";
    return "implemented";
  },
  getCapabilities() {
    return {
      platform: "linkedin" as const,
      adapterVersion: "0.1.0",
      supportsOAuth: true,
      supportsApiKey: false,
      supportsCredentialRefresh: true,
      requiredScopes: ["openid", "profile", "email", "w_member_social"],
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
      supportsMentions: false,
      supportsHashtags: true,
      maxTextLength: 3000,
      maxHashtagCount: 10,
      supportedMediaFormats: [],
      maxMediaCount: 0,
      supportsFetchMetrics: false,
      supportsVerifyPublication: true,
      destinationsMayRequireManualApproval: false,
    };
  },
  async publish(input: PublishInput): Promise<PublishResult> {
    const c = creds();
    if (!c) {
      return {
        status: "blocked_missing_credentials",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: "LinkedIn publish blocked: LINKEDIN_API_KEY not set.",
      };
    }
    if (!armed()) {
      return {
        status: "blocked_missing_credentials",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage:
          "LinkedIn publish DISARMED: set LINKEDIN_PUBLISH_ARMED='true' to allow live posts.",
      };
    }
    const idRes = await linkedinFetch("/v2/userinfo", { method: "GET" }, c);
    const sub = idRes.ok ? (idRes.body as { sub?: string })?.sub : null;
    if (!sub) {
      return {
        status: "failed",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: "LinkedIn author lookup failed - cannot post without member id.",
      };
    }
    const author = `urn:li:person:${sub}`;
    const text = buildText(input);
    const payload = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: input.linkUrl ? "ARTICLE" : "NONE",
          ...(input.linkUrl
            ? {
                media: [
                  {
                    status: "READY",
                    originalUrl: input.linkUrl,
                  },
                ],
              }
            : {}),
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };
    const res = await linkedinFetch(
      "/v2/ugcPosts",
      { method: "POST", body: JSON.stringify(payload), headers: { "X-Restli-Protocol-Version": "2.0.0" } },
      c,
    );
    if (!res.ok) {
      return {
        status: "failed",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: `linkedin_publish_failed status=${res.status} ${res.providerMessage ?? ""}`.trim(),
        raw: res.body,
      };
    }
    const respBody = (res.body ?? {}) as Record<string, unknown>;
    const externalId = res.postId ?? (typeof respBody.id === "string" ? respBody.id : null);
    const url = externalId
      ? `https://www.linkedin.com/feed/update/${encodeURIComponent(externalId)}/`
      : null;
    return {
      status: "published",
      externalPostId: externalId,
      externalPostUrl: url,
      providerMessage: null,
      raw: respBody,
    };
  },
  async verifyPublication(externalPostId: string): Promise<{ verified: boolean; reason?: string }> {
    const c = creds();
    if (!c) return { verified: false, reason: "not_configured" };
    const res = await linkedinFetch(
      `/v2/ugcPosts/${encodeURIComponent(externalPostId)}`,
      { method: "GET", headers: { "X-Restli-Protocol-Version": "2.0.0" } },
      c,
    );
    return res.ok ? { verified: true, reason: "linkedin_ugc_reachable" } : { verified: false, reason: res.providerMessage ?? `http_${res.status}` };
  },
  async fetchMetrics(_externalPostId: string): Promise<MetricsResult> {
    // LinkedIn metrics require additional scopes (r_organization_social /
    // rw_organization_admin) and the ugcPosts stats endpoint. Not enabled
    // on this connector yet.
    return {};
  },
};