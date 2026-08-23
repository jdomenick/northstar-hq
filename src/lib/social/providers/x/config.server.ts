// Server-only X (Twitter) configuration resolver.
//
// Reads process.env at call time. Never throws for a missing secret in the
// status path: callers render a truthful "Setup required" state instead of
// pretending the provider is connected.

export const X_REQUIRED_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
] as const;

export const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const X_REVOKE_URL = "https://api.x.com/2/oauth2/revoke";
export const X_API_BASE = "https://api.x.com/2";

export interface XConfigStatus {
  configured: boolean;
  missing: string[];
  redirectUri: string | null;
  armed: boolean;
}

export function readXConfigStatus(): XConfigStatus {
  const missing: string[] = [];
  if (!process.env.X_CLIENT_ID) missing.push("X_CLIENT_ID");
  if (!process.env.X_CLIENT_SECRET) missing.push("X_CLIENT_SECRET");
  if (!process.env.X_REDIRECT_URI) missing.push("X_REDIRECT_URI");
  return {
    configured: missing.length === 0,
    missing,
    redirectUri: process.env.X_REDIRECT_URI ?? null,
    armed: process.env.X_PUBLISH_ARMED === "true",
  };
}

export interface XConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  armed: boolean;
}

export class XNotConfiguredError extends Error {
  readonly code = "x_not_configured" as const;
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`X credentials required (missing: ${missing.join(", ")})`);
    this.name = "XNotConfiguredError";
    this.missing = missing;
  }
}

export function getXConfig(): XConfig {
  const status = readXConfigStatus();
  if (!status.configured) throw new XNotConfiguredError(status.missing);
  return {
    clientId: process.env.X_CLIENT_ID!,
    clientSecret: process.env.X_CLIENT_SECRET!,
    redirectUri: process.env.X_REDIRECT_URI!,
    armed: status.armed,
  };
}
