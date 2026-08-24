/**
 * Server-only resolver for the shared cross-app reporting credential.
 *
 * Production source is this project's Supabase Vault entry
 * `northstar_reporting_secret`, read through the service-role only
 * `public.get_reporting_secret()` function. The environment variable
 * NORTHSTAR_REPORTING_SECRET remains an optional fallback.
 *
 * The raw value never leaves this module except as an outbound request header.
 * It is never logged, never returned to the client, and never serialized.
 */

import { REPORTING_SECRET_ENV } from "./types";

export type ReportingSecretSource = "vault" | "env" | null;

export interface ReportingSecretState {
  secret: string | null;
  source: ReportingSecretSource;
}

let cached: { value: ReportingSecretState; at: number } | null = null;
const TTL_MS = 60_000;

function envSecret(): string | null {
  const raw = process.env[REPORTING_SECRET_ENV];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

async function vaultSecret(): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_reporting_secret");
    if (error) {
      // Reason only. Never include the credential or the raw response.
      console.error("[reporting] vault credential read failed:", error.message);
      return null;
    }
    return typeof data === "string" && data.trim() !== "" ? data.trim() : null;
  } catch (err) {
    console.error(
      "[reporting] vault credential read threw:",
      err instanceof Error ? err.message : "unknown error",
    );
    return null;
  }
}

/** Resolves the credential, preferring Vault, falling back to environment. */
export async function resolveReportingSecret(): Promise<ReportingSecretState> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const fromVault = await vaultSecret();
  const value: ReportingSecretState = fromVault
    ? { secret: fromVault, source: "vault" }
    : (() => {
        const fromEnv = envSecret();
        return fromEnv
          ? { secret: fromEnv, source: "env" as const }
          : { secret: null, source: null };
      })();

  cached = { value, at: Date.now() };
  return value;
}

/** Configuration status only. Never exposes the credential itself. */
export async function reportingSecretStatus(): Promise<{
  configured: boolean;
  source: ReportingSecretSource;
}> {
  const { secret, source } = await resolveReportingSecret();
  return { configured: secret !== null, source };
}
