import type {
  SocialProviderAdapter,
  PublishInput,
  PublishResult,
  MetricsResult,
  SocialProviderImplementationStatus,
} from "./index";

/**
 * Beehiiv v2 adapter. Real HTTP against api.beehiiv.com/v2.
 *
 * Required env:
 *   - BEEHIIV_API_KEY         Personal API key (server-only)
 *   - BEEHIIV_PUBLICATION_ID  Target publication id (pub_...)
 *
 * Safety posture for 6a:
 *   - `publish()` is DISARMED unless BEEHIIV_PUBLISH_ARMED === "true".
 *     While disarmed it returns `blocked_missing_credentials` with the
 *     provider message explaining the arm flag. This prevents any real
 *     newsletter dispatch during 6a even if the pipeline is invoked.
 *   - When armed, publish() creates the Beehiiv post with
 *     `status: "draft"` unless `input.newsletterSubject` and an explicit
 *     confirmed launch flag are set by the caller. 6a NEVER passes that
 *     flag; 6c will.
 */

const BASE = "https://api.beehiiv.com/v2";

function creds(): { apiKey: string; pubId: string } | null {
  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  if (!apiKey || !pubId) return null;
  return { apiKey, pubId };
}

function armed(): boolean {
  return process.env.BEEHIIV_PUBLISH_ARMED === "true";
}

async function beehiivFetch(
  path: string,
  init: RequestInit & { apiKey: string },
): Promise<{ ok: boolean; status: number; body: unknown; providerMessage: string | null }> {
  const { apiKey, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Accept", "application/json");
  if (rest.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...rest, headers });
  } catch (err) {
    return { ok: false, status: 0, body: null, providerMessage: `network_error: ${(err as Error).message}` };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return {
    ok: res.ok,
    status: res.status,
    body,
    providerMessage: res.ok ? null : `beehiiv_http_${res.status}`,
  };
}

export interface BeehiivValidationResult {
  configured: boolean;
  reachable: boolean;
  publicationId: string | null;
  publicationName: string | null;
  publicationOrganizationName: string | null;
  grantedCapabilities: string[];
  missingCapabilities: string[];
  armed: boolean;
  message: string;
  raw?: unknown;
}

export async function validateBeehiivCredentials(): Promise<BeehiivValidationResult> {
  const c = creds();
  if (!c) {
    return {
      configured: false,
      reachable: false,
      publicationId: null,
      publicationName: null,
      publicationOrganizationName: null,
      grantedCapabilities: [],
      missingCapabilities: ["posts:read", "posts:write", "publications:read"],
      armed: false,
      message: "BEEHIIV_API_KEY and/or BEEHIIV_PUBLICATION_ID not set.",
    };
  }
  // Identity: GET /publications/{id}
  const pubRes = await beehiivFetch(`/publications/${encodeURIComponent(c.pubId)}`, {
    method: "GET",
    apiKey: c.apiKey,
  });
  if (!pubRes.ok) {
    return {
      configured: true,
      reachable: pubRes.status !== 0,
      publicationId: c.pubId,
      publicationName: null,
      publicationOrganizationName: null,
      grantedCapabilities: [],
      missingCapabilities: ["publications:read"],
      armed: armed(),
      message:
        pubRes.status === 401 || pubRes.status === 403
          ? "Beehiiv rejected the API key or it lacks access to the publication."
          : pubRes.status === 404
            ? "Beehiiv could not find that publication id."
            : `Beehiiv publication lookup failed (${pubRes.providerMessage ?? "unknown"}).`,
      raw: pubRes.body,
    };
  }
  const pub = ((pubRes.body as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;
  const publicationName = typeof pub.name === "string" ? pub.name : null;
  const orgName = typeof pub.organization_name === "string" ? pub.organization_name : null;
  // Capability probe: posts:read via GET /publications/{id}/posts?limit=1
  const postsProbe = await beehiivFetch(
    `/publications/${encodeURIComponent(c.pubId)}/posts?limit=1`,
    { method: "GET", apiKey: c.apiKey },
  );
  const granted: string[] = ["publications:read"];
  const missing: string[] = [];
  if (postsProbe.ok) granted.push("posts:read");
  else missing.push("posts:read");
  // posts:write cannot be probed without a real write; treat as inferred-from-scopes.
  // Beehiiv does not expose per-key scopes over the API; require operator confirmation.
  return {
    configured: true,
    reachable: true,
    publicationId: c.pubId,
    publicationName,
    publicationOrganizationName: orgName,
    grantedCapabilities: granted,
    missingCapabilities: missing,
    armed: armed(),
    message: armed()
      ? "Credentials valid. Publishing is ARMED. 6a still blocks publish via the pipeline gates."
      : "Credentials valid. Publishing is DISARMED (BEEHIIV_PUBLISH_ARMED != 'true'). No live send possible.",
    raw: pub,
  };
}

export const beehiivAdapter: SocialProviderAdapter = {
  key: "beehiiv",
  connectorVersion: "0.2.0-6a",
  get implementationStatus(): SocialProviderImplementationStatus {
    if (!creds()) return "blocked_no_credentials";
    // Adapter code is implemented, but the publish path stays gated by
    // BEEHIIV_PUBLISH_ARMED at call time.
    return "implemented";
  },
  getCapabilities() {
    return {
      platform: "beehiiv" as const,
      adapterVersion: "0.2.0-6a",
      supportsOAuth: false,
      supportsApiKey: true,
      supportsCredentialRefresh: false,
      requiredScopes: ["posts:write"],
      requiresDestinationSelection: true,
      supportsListDestinations: false,
      supportsPublish: true,
      supportsScheduledPublish: true,
      supportsDelete: false,
      supportsMediaUpload: false,
      supportsMultipleMedia: false,
      supportsAltText: false,
      supportsFirstComment: false,
      supportsLink: true,
      supportsMentions: false,
      supportsHashtags: false,
      maxTextLength: 500_000,
      maxHashtagCount: 0,
      maxMediaCount: 0,
      supportedMediaFormats: [],
      supportsFetchMetrics: true,
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
        providerMessage:
          "Beehiiv publish blocked: BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID must be set.",
      };
    }
    if (!armed()) {
      return {
        status: "blocked_missing_credentials",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage:
          "Beehiiv publish DISARMED: set BEEHIIV_PUBLISH_ARMED='true' to allow live sends. 6a does not arm this.",
      };
    }
    // Body content: prefer explicit newsletter subject; body is treated as
    // HTML. Beehiiv v2 accepts { title, subtitle, body_content, status }.
    const payload = {
      title: input.newsletterSubject ?? input.title ?? "(untitled)",
      subtitle: input.newsletterPreview ?? undefined,
      body_content: input.body,
      status: "draft",
    };
    const res = await beehiivFetch(`/publications/${encodeURIComponent(c.pubId)}/posts`, {
      method: "POST",
      apiKey: c.apiKey,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        status: "failed",
        externalPostId: null,
        externalPostUrl: null,
        providerMessage: `beehiiv_publish_failed status=${res.status} ${res.providerMessage ?? ""}`.trim(),
        raw: res.body,
      };
    }
    const data = ((res.body as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;
    return {
      status: typeof data.status === "string" && data.status === "confirmed" ? "published" : "scheduled",
      externalPostId: typeof data.id === "string" ? data.id : null,
      externalPostUrl: typeof data.web_url === "string" ? data.web_url : null,
      providerMessage: null,
      raw: data,
    };
  },
  async verifyPublication(externalPostId: string): Promise<{ verified: boolean; reason?: string }> {
    const c = creds();
    if (!c) return { verified: false, reason: "not_configured" };
    const res = await beehiivFetch(
      `/publications/${encodeURIComponent(c.pubId)}/posts/${encodeURIComponent(externalPostId)}`,
      { method: "GET", apiKey: c.apiKey },
    );
    if (!res.ok) return { verified: false, reason: res.providerMessage ?? `http_${res.status}` };
    const data = ((res.body as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;
    const status = typeof data.status === "string" ? data.status : "unknown";
    return { verified: status === "confirmed" || status === "draft" || status === "scheduled", reason: `beehiiv_status=${status}` };
  },
  async fetchMetrics(externalPostId: string): Promise<MetricsResult> {
    const c = creds();
    if (!c) return {};
    const res = await beehiivFetch(
      `/publications/${encodeURIComponent(c.pubId)}/posts/${encodeURIComponent(externalPostId)}?expand[]=stats`,
      { method: "GET", apiKey: c.apiKey },
    );
    if (!res.ok) return { raw: res.body };
    const data = ((res.body as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;
    const stats = (data.stats ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
    const email = (stats.email ?? {}) as Record<string, unknown>;
    const web = (stats.web ?? {}) as Record<string, unknown>;
    return {
      impressions: num(email.recipients) ?? num(web.views),
      reach: num(email.delivered),
      clicks: num(email.unique_clicks) ?? num(web.clicks),
      raw: stats,
    };
  },
};