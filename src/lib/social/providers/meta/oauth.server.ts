// Meta OAuth 2.0 helpers (v25.0). All calls read config inside the function,
// never at module scope. State + code-verifier persistence goes through
// meta_oauth_states via the caller (route handler).

import { randomBytes, createHash, createHmac, timingSafeEqual } from "crypto";
import { getMetaConfig, META_GRAPH_VERSION } from "./config.server";

export interface AuthorizeUrlInput {
  organizationId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}

const REQUIRED_SCOPES = [
  "email",
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
];

export function getRequiredScopes(): string[] {
  return [...REQUIRED_SCOPES];
}

export function generateOAuthState(): { state: string; codeVerifier: string } {
  return {
    state: randomBytes(32).toString("base64url"),
    codeVerifier: randomBytes(48).toString("base64url"),
  };
}

export function buildAuthorizeUrl(input: AuthorizeUrlInput): string {
  const cfg = getMetaConfig();
  const url = new URL(`https://www.facebook.com/${cfg.graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.scopes.join(","));
  return url.toString();
}

export interface CodeExchangeResult {
  accessToken: string;
  tokenType: string;
  expiresIn: number | null;
}

export async function exchangeCodeForShortToken(code: string, redirectUri: string): Promise<CodeExchangeResult> {
  const cfg = getMetaConfig();
  const url = new URL(`https://graph.facebook.com/${cfg.graphVersion}/oauth/access_token`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("client_secret", cfg.appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`meta_code_exchange_failed:${res.status}`);
  const body = (await res.json()) as { access_token: string; token_type?: string; expires_in?: number };
  return {
    accessToken: body.access_token,
    tokenType: body.token_type ?? "bearer",
    expiresIn: body.expires_in ?? null,
  };
}

export async function exchangeForLongLivedToken(shortToken: string): Promise<CodeExchangeResult> {
  const cfg = getMetaConfig();
  const url = new URL(`https://graph.facebook.com/${cfg.graphVersion}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("client_secret", cfg.appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`meta_long_token_exchange_failed:${res.status}`);
  const body = (await res.json()) as { access_token: string; token_type?: string; expires_in?: number };
  return {
    accessToken: body.access_token,
    tokenType: body.token_type ?? "bearer",
    expiresIn: body.expires_in ?? null,
  };
}

/**
 * Verify a Meta signed_request payload (used by deauthorize and data-deletion
 * callbacks). Returns the decoded payload or null on invalid signature.
 */
export function verifySignedRequest(signedRequest: string): Record<string, unknown> | null {
  const [encSig, encPayload] = signedRequest.split(".");
  if (!encSig || !encPayload) return null;
  const cfg = getMetaConfig();
  const expected = createHmac("sha256", cfg.appSecret).update(encPayload).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(encSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  try {
    const json = Buffer.from(encPayload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function buildDataDeletionConfirmation(userId: string, statusUrl: string): { url: string; confirmation_code: string } {
  const code = createHash("sha256").update(`${userId}:${Date.now()}`).digest("hex").slice(0, 20);
  return { url: statusUrl, confirmation_code: code };
}

export { META_GRAPH_VERSION };
