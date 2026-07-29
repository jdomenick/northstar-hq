// Invitation issuance, verification, and acceptance. Tokens are random,
// hashed at rest, single use, expiring, and revocable. The raw token is only
// ever returned once, to the operator who created or resent the invitation.

import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ClientIdentityError } from "./errors";
import { recordClientAuditEvent } from "./audit.server";
import type { ClientRole } from "./types";

type SB = SupabaseClient<Database>;

export const INVITATION_TTL_DAYS = 7;

export function generateInvitationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiry(): string {
  return new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function invitationLink(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/client/invite/${token}`;
}

type InvitationRow = Database["public"]["Tables"]["client_invitations"]["Row"];

/** Resolve a raw token to a usable invitation, or throw a typed error. */
export async function verifyInvitation(admin: SB, token: string): Promise<InvitationRow> {
  if (!token || token.length < 20) throw new ClientIdentityError("invitation_invalid");
  const { data, error } = await admin
    .from("client_invitations")
    .select("*")
    .eq("token_hash", hashInvitationToken(token))
    .maybeSingle();
  if (error) throw new ClientIdentityError("internal_error");
  if (!data) throw new ClientIdentityError("invitation_invalid");
  if (data.accepted_at) throw new ClientIdentityError("invitation_accepted");
  if (data.revoked_at) throw new ClientIdentityError("invitation_revoked");
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new ClientIdentityError("invitation_expired");
  }
  return data;
}

export interface InvitationPreview {
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  expires_at: string;
}

export async function previewInvitation(admin: SB, token: string): Promise<InvitationPreview> {
  const inv = await verifyInvitation(admin, token);
  const { data: client } = await admin
    .from("revenue_clients")
    .select("name")
    .eq("id", inv.client_id)
    .maybeSingle();
  return {
    first_name: inv.first_name,
    last_name: inv.last_name,
    email: inv.email,
    company_name: client?.name ?? "your company",
    expires_at: inv.expires_at,
  };
}

/**
 * Accept an invitation: create the auth user, create the client account row,
 * and burn the invitation. Idempotency is enforced by accepted_at.
 */
export async function acceptInvitation(
  admin: SB,
  token: string,
  password: string,
): Promise<{ email: string }> {
  if (!password || password.length < 8) throw new ClientIdentityError("invalid_input");
  const inv = await verifyInvitation(admin, token);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: inv.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: `${inv.first_name} ${inv.last_name}`.trim(),
      account_type: "client",
    },
  });
  if (createErr || !created?.user) {
    const msg = (createErr?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      throw new ClientIdentityError("email_in_use");
    }
    console.error("[client-identity] createUser failed", createErr?.message);
    throw new ClientIdentityError("internal_error");
  }

  const { data: account, error: accErr } = await admin
    .from("client_accounts")
    .insert({
      organization_id: inv.organization_id,
      client_id: inv.client_id,
      user_id: created.user.id,
      email: inv.email,
      first_name: inv.first_name,
      last_name: inv.last_name,
      role: inv.role,
      status: "active",
      invited_by: inv.invited_by,
    })
    .select("id")
    .single();
  if (accErr || !account) {
    // Roll the auth user back so a failed acceptance can be retried cleanly.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    console.error("[client-identity] account insert failed", accErr?.message);
    throw new ClientIdentityError("internal_error");
  }

  const { error: burnErr } = await admin
    .from("client_invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_account_id: account.id })
    .eq("id", inv.id)
    .is("accepted_at", null);
  if (burnErr) console.error("[client-identity] invitation burn failed", burnErr.message);

  await recordClientAuditEvent(admin, {
    organization_id: inv.organization_id,
    client_id: inv.client_id,
    client_account_id: account.id,
    invitation_id: inv.id,
    event_type: "client_invitation_accepted",
    actor_type: "client",
    actor_id: created.user.id,
    metadata: { email: inv.email, role: inv.role },
  });

  return { email: inv.email };
}

export type { ClientRole };