// Reddit OAuth 2.0 (web app, authorization code). Server-only.
//
// Reddit does not support PKCE. It issues 1 hour access tokens and only
// returns a refresh token when duration=permanent is requested, so we always
// request permanent access; without it the connection dies after an hour.

import {
  REDDIT_AUTHORIZE_URL,
  REDDIT_REQUIRED_SCOPES,
  REDDIT_TOKEN_URL,
  REDDIT_USER_AGENT,
  getRedditConfig,
} from "./config.server";

function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateOAuthState(): { state: string } {
  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  return { state: base64Url(stateBytes) };
}

export function getRequiredScopes(): string[] {
  return [...REDDIT_REQUIRED_SCOPES];
}

export function buildAuthorizeUrl(input: {
  state: string;
  redirectUri: string;
  scopes: string[];
}): string {
  const cfg = getRedditConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    state: input.state,
    redirect_uri: input.redirectUri,
    duration: "permanent",
    scope: input.scopes.join(" "),
  });
  return `${REDDIT_AUTHORIZE_URL}?${params.toString()}`;
}

export interface RedditTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  grantedScopes: string[];
}

async function tokenRequest(body: URLSearchParams): Promise<RedditTokenSet> {
  const cfg = getRedditConfig();
  const basic = btoa(`${cfg.clientId}:${cfg.clientSecret}`);
  const res = await fetch(REDDIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": REDDIT_USER_AGENT,
    },
    body,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`reddit_token_http_${res.status}`);
  let parsed: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("reddit_token_unparseable_response");
  }
  if (parsed.error) throw new Error(`reddit_token_${parsed.error}`);
  if (!parsed.access_token) throw new Error("reddit_token_missing_access_token");
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? null,
    expiresAt: parsed.expires_in
      ? new Date(Date.now() + parsed.expires_in * 1000).toISOString()
      : null,
    grantedScopes: parsed.scope ? parsed.scope.split(/[\s,]+/).filter(Boolean) : [],
  };
}

export async function exchangeCodeForTokens(input: {
  code: string;
  redirectUri: string;
}): Promise<RedditTokenSet> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  );
}

export async function refreshTokens(refreshToken: string): Promise<RedditTokenSet> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}
