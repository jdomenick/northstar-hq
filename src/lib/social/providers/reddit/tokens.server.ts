// Server-only token store for the Reddit connection.
//
// Reuses the same encrypted social OAuth credential architecture as X:
// public.social_oauth_credentials, service role only, RLS with no policies.

import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets.server";
import { refreshTokens } from "./oauth.server";

const PURPOSE = "reddit_oauth_token_v1";

export interface RedditStoredConnection {
  id: string;
  organizationId: string;
  ventureId: string;
  externalAccountId: string | null;
  externalUsername: string | null;
  externalDisplayName: string | null;
  grantedScopes: string[];
  tokenExpiresAt: string | null;
  revokedAt: string | null;
}

type Row = {
  id: string;
  organization_id: string;
  venture_id: string;
  external_account_id: string | null;
  external_username: string | null;
  external_display_name: string | null;
  granted_scopes: string[] | null;
  token_expires_at: string | null;
  revoked_at: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
};

function toPublic(row: Row): RedditStoredConnection {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ventureId: row.venture_id,
    externalAccountId: row.external_account_id,
    externalUsername: row.external_username,
    externalDisplayName: row.external_display_name,
    grantedScopes: row.granted_scopes ?? [],
    tokenExpiresAt: row.token_expires_at,
    revokedAt: row.revoked_at,
  };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function readRow(organizationId: string, ventureId: string): Promise<Row | null> {
  const sb = await admin();
  const { data } = await sb
    .from("social_oauth_credentials")
    .select(
      "id, organization_id, venture_id, external_account_id, external_username, external_display_name, granted_scopes, token_expires_at, revoked_at, access_token_encrypted, refresh_token_encrypted",
    )
    .eq("organization_id", organizationId)
    .eq("venture_id", ventureId)
    .eq("platform", "reddit")
    .maybeSingle();
  return (data as Row | null) ?? null;
}

export async function getRedditConnection(
  organizationId: string,
  ventureId: string,
): Promise<RedditStoredConnection | null> {
  const row = await readRow(organizationId, ventureId);
  if (!row || row.revoked_at) return null;
  return toPublic(row);
}

/**
 * Returns a usable access token, refreshing when expired or within 120s of
 * expiry. Returns null when there is no live connection or refresh failed;
 * callers must surface a reconnect state, never a fake token.
 */
export async function getRedditAccessToken(
  organizationId: string,
  ventureId: string,
): Promise<{ accessToken: string; connection: RedditStoredConnection } | null> {
  const row = await readRow(organizationId, ventureId);
  if (!row || row.revoked_at) return null;

  const expiresAt = row.token_expires_at ? Date.parse(row.token_expires_at) : null;
  const needsRefresh = expiresAt !== null && expiresAt - Date.now() < 120_000;
  if (!needsRefresh) {
    return {
      accessToken: decryptSecret(row.access_token_encrypted, PURPOSE),
      connection: toPublic(row),
    };
  }
  if (!row.refresh_token_encrypted) return null;

  try {
    const next = await refreshTokens(decryptSecret(row.refresh_token_encrypted, PURPOSE));
    const sb = await admin();
    await sb
      .from("social_oauth_credentials")
      .update({
        access_token_encrypted: encryptSecret(next.accessToken, PURPOSE),
        refresh_token_encrypted: next.refreshToken
          ? encryptSecret(next.refreshToken, PURPOSE)
          : row.refresh_token_encrypted,
        token_expires_at: next.expiresAt,
        granted_scopes: next.grantedScopes.length ? next.grantedScopes : (row.granted_scopes ?? []),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", row.id);
    return {
      accessToken: next.accessToken,
      connection: { ...toPublic(row), tokenExpiresAt: next.expiresAt },
    };
  } catch {
    return null;
  }
}

export async function upsertRedditConnection(input: {
  organizationId: string;
  ventureId: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  grantedScopes: string[];
  externalAccountId: string | null;
  externalUsername: string | null;
  externalDisplayName: string | null;
  connectedBy: string | null;
}): Promise<void> {
  const sb = await admin();
  await sb.from("social_oauth_credentials").upsert(
    {
      organization_id: input.organizationId,
      venture_id: input.ventureId,
      platform: "reddit",
      access_token_encrypted: encryptSecret(input.accessToken, PURPOSE),
      refresh_token_encrypted: input.refreshToken
        ? encryptSecret(input.refreshToken, PURPOSE)
        : null,
      token_expires_at: input.tokenExpiresAt,
      granted_scopes: input.grantedScopes,
      external_account_id: input.externalAccountId,
      external_username: input.externalUsername,
      external_display_name: input.externalDisplayName,
      connected_by: input.connectedBy,
      social_account_id: null,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "organization_id,venture_id,platform" },
  );
}

export async function revokeRedditConnection(
  organizationId: string,
  ventureId: string,
): Promise<void> {
  const sb = await admin();
  await sb
    .from("social_oauth_credentials")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
    .eq("organization_id", organizationId)
    .eq("venture_id", ventureId)
    .eq("platform", "reddit");
}
