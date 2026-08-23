// Server-only Reddit configuration resolver.
//
// Reads process.env at call time. Never throws in the status path: callers
// render a truthful "Setup required" state instead of pretending the provider
// is connected.

export const REDDIT_REQUIRED_SCOPES = ["identity", "read", "submit"] as const;

export const REDDIT_AUTHORIZE_URL = "https://www.reddit.com/api/v1/authorize";
export const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
export const REDDIT_API_BASE = "https://oauth.reddit.com";
export const REDDIT_USER_AGENT = "web:northstar-labs-hq:v0.1.0 (by /u/northstarlabs)";

export interface RedditConfigStatus {
  configured: boolean;
  missing: string[];
  redirectUri: string | null;
  armed: boolean;
}

export function readRedditConfigStatus(): RedditConfigStatus {
  const missing: string[] = [];
  if (!process.env.REDDIT_CLIENT_ID) missing.push("REDDIT_CLIENT_ID");
  if (!process.env.REDDIT_CLIENT_SECRET) missing.push("REDDIT_CLIENT_SECRET");
  if (!process.env.REDDIT_REDIRECT_URI) missing.push("REDDIT_REDIRECT_URI");
  return {
    configured: missing.length === 0,
    missing,
    redirectUri: process.env.REDDIT_REDIRECT_URI ?? null,
    armed: process.env.REDDIT_PUBLISH_ARMED === "true",
  };
}

export interface RedditConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  armed: boolean;
}

export class RedditNotConfiguredError extends Error {
  readonly code = "reddit_not_configured" as const;
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Reddit credentials required (missing: ${missing.join(", ")})`);
    this.name = "RedditNotConfiguredError";
    this.missing = missing;
  }
}

export function getRedditConfig(): RedditConfig {
  const status = readRedditConfigStatus();
  if (!status.configured) throw new RedditNotConfiguredError(status.missing);
  return {
    clientId: process.env.REDDIT_CLIENT_ID!,
    clientSecret: process.env.REDDIT_CLIENT_SECRET!,
    redirectUri: process.env.REDDIT_REDIRECT_URI!,
    armed: status.armed,
  };
}
