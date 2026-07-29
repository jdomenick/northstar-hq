// Truthful audit trail for client identity events. Never stores passwords,
// tokens, or any authentication secret.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ClientAuditEvent } from "./types";

const FORBIDDEN = /^(password|token|token_hash|secret|authorization|api_key)$/i;

function sanitize(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (FORBIDDEN.test(k)) continue;
    out[k] = v && typeof v === "object" ? sanitize(v) : v;
  }
  return out;
}

export async function recordClientAuditEvent(
  supabase: SupabaseClient<Database>,
  input: {
    organization_id: string;
    event_type: ClientAuditEvent;
    client_id?: string | null;
    client_account_id?: string | null;
    invitation_id?: string | null;
    actor_type?: "operator" | "client" | "system";
    actor_id?: string | null;
    metadata?: unknown;
  },
): Promise<void> {
  const { error } = await supabase.from("client_audit_events").insert({
    organization_id: input.organization_id,
    event_type: input.event_type,
    client_id: input.client_id ?? null,
    client_account_id: input.client_account_id ?? null,
    invitation_id: input.invitation_id ?? null,
    actor_type: input.actor_type ?? "system",
    actor_id: input.actor_id ?? null,
    metadata: sanitize(input.metadata ?? {}) as never,
  });
  if (error) {
    console.error("[client_audit_events] insert failed", error.message);
  }
}