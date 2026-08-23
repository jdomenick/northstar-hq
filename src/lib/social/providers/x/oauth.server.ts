// X OAuth 2.0 (user context) with PKCE. Server-only.
//
// X issues short-lived access tokens (~2h). `offline.access` is mandatory so
// we receive a refresh token; without it the connection dies silently.

import {
  X_AUTHORIZE_URL,
  X_REQUIRED_SCOPES,
  X_TOKEN_URL,
  getXConfig,
} from "./config.server";

function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateOAuthState(): { state: string; codeVerifier: string } {
  const stateBytes = new Uint8Array(32);
  const verifierBytes = new Uint8Array(48);
  crypto.getRandomValues(stateBytes);
  crypto.getRandomValues(verifierBytes);
  return { state: base64Url(stateBytes), codeVerifier: base64Url(verifierBytes) };
}

export async function codeChallengeFor(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return base64Url(new Uint8Array(digest));
}

export function getRequiredScopes(): string[] {
  return [...X_REQUIRED_SCOPES];
}

export async function buildAuthorizeUrl(input: {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  scopes: string[];
}): Promise<string> {
  const cfg = getXConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: input.redirectUri,
    scope: input.scopes.join(" "),
    state: input.state,
    code_challenge: await codeChallengeFor(input.codeVerifier),
    code_challenge_method: "S256",
  });
  return `${X_AUTHORIZE_URL}?${params.toString()}`;
}

export interface XTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  grantedScopes: string[];
}

async function tokenRequest(body: URLSearchParams): Promise<XTokenSet> {
  const cfg = getXConfig();
  const basic = btoa(`${cfg.clientId}:${cfg.clientSecret}`);
  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`x_token_http_${res.status}`);
  }
  let parsed: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("x_token_unparseable_response");
  }
  if (!parsed.access_token) throw new Error("x_token_missing_access_token");
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? null,
    expiresAt: parsed.expires_in
      ? new Date(Date.now() + parsed.expires_in * 1000).toISOString()
      : null,
    grantedScopes: parsed.scope ? parsed.scope.split(" ").filter(Boolean) : [],
  };
}

export async function exchangeCodeForTokens(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<XTokenSet> {
  const cfg = getXConfig();
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
      client_id: cfg.clientId,
    }),
  );
}

export async function refreshTokens(refreshToken: string): Promise<XTokenSet> {
  const cfg = getXConfig();
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: cfg.clientId,
    }),
  );
}
