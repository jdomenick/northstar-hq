// Server-only Meta config resolver. Never imported by client code.
// Reads process.env at call time (Cloudflare Workers inject at request).

export interface MetaConfig {
  appId: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphVersion: string; // v25.0
  encryptionKey: string; // 32 bytes hex; derived from SUPABASE_SERVICE_ROLE_KEY
}

export interface MetaConfigStatus {
  configured: boolean;
  missing: string[];
  graphVersion: string;
}

export const META_GRAPH_VERSION = "v25.0";

export function readMetaConfigStatus(): MetaConfigStatus {
  const missing: string[] = [];
  if (!process.env.META_APP_ID) missing.push("META_APP_ID");
  if (!process.env.META_APP_SECRET) missing.push("META_APP_SECRET");
  if (!process.env.META_WEBHOOK_VERIFY_TOKEN) missing.push("META_WEBHOOK_VERIFY_TOKEN");
  return {
    configured: missing.length === 0,
    missing,
    graphVersion: META_GRAPH_VERSION,
  };
}

export function isMetaConfigured(): boolean {
  return readMetaConfigStatus().configured;
}

/**
 * Returns the resolved Meta config. Throws MetaNotConfiguredError when any
 * required env var is missing. Callers must handle this by returning a
 * truthful blocked state - never fall back to defaults.
 */
export function getMetaConfig(): MetaConfig {
  const status = readMetaConfigStatus();
  if (!status.configured) {
    throw new MetaNotConfiguredError(status.missing);
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new MetaNotConfiguredError(["SUPABASE_SERVICE_ROLE_KEY"]);
  }
  return {
    appId: process.env.META_APP_ID!,
    appSecret: process.env.META_APP_SECRET!,
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN!,
    graphVersion: META_GRAPH_VERSION,
    // Derive a stable 32-byte key from the service role key for AES-256-GCM
    // symmetric encryption of Page tokens at rest. Never logged.
    encryptionKey: serviceRoleKey,
  };
}

export class MetaNotConfiguredError extends Error {
  readonly code = "meta_not_configured" as const;
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Meta credentials required (missing: ${missing.join(", ")})`);
    this.name = "MetaNotConfiguredError";
    this.missing = missing;
  }
}
