// Server-only storage for per-operator App User Connector connection keys.
//
// The gateway connection key (lovack_*) is a credential. It is stored
// encrypted at rest with the shared AES-256-GCM helper, keyed by the
// authenticated app user id plus connector id, and never returned to a
// browser bundle.

import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets.server";

const PURPOSE = "app_user_connection_key_v1";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface StoredAppUserConnection {
  connectionAPIKey: string;
  externalIdentity: string | null;
  connectedAt: string;
}

export async function getAppUserConnection(
  userId: string,
  connectorId: string,
): Promise<StoredAppUserConnection | null> {
  const sb = await admin();
  const { data } = await sb
    .from("app_user_connections")
    .select("connection_key_ciphertext, external_identity, created_at")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  const row = data as
    | { connection_key_ciphertext: string; external_identity: string | null; created_at: string }
    | null;
  if (!row) return null;
  try {
    return {
      connectionAPIKey: decryptSecret(row.connection_key_ciphertext, PURPOSE),
      externalIdentity: row.external_identity,
      connectedAt: row.created_at,
    };
  } catch {
    // Undecryptable ciphertext means the stored key is unusable. Report it as
    // "not connected" rather than pretending the connection is live.
    return null;
  }
}

export async function hasAppUserConnection(
  userId: string,
  connectorId: string,
): Promise<{ connected: boolean; identity: string | null; connectedAt: string | null }> {
  const sb = await admin();
  const { data } = await sb
    .from("app_user_connections")
    .select("external_identity, created_at")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  const row = data as { external_identity: string | null; created_at: string } | null;
  return {
    connected: !!row,
    identity: row?.external_identity ?? null,
    connectedAt: row?.created_at ?? null,
  };
}

export async function saveAppUserConnection(input: {
  userId: string;
  connectorId: string;
  connectionAPIKey: string;
  externalIdentity: string | null;
}): Promise<void> {
  const sb = await admin();
  const { error } = await sb.from("app_user_connections").upsert(
    {
      user_id: input.userId,
      connector_id: input.connectorId,
      connection_key_ciphertext: encryptSecret(input.connectionAPIKey, PURPOSE),
      external_identity: input.externalIdentity,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw new Error(`app_user_connection_persist_failed: ${error.message}`);
}

export async function deleteAppUserConnection(
  userId: string,
  connectorId: string,
): Promise<void> {
  const sb = await admin();
  await sb
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}
