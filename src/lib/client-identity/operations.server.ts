// Server-only operations behind the client identity server functions.
// Authorization is enforced twice: RLS on every table, plus explicit role
// checks here for operator-only mutations.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ClientIdentityError } from "./errors";
import { recordClientAuditEvent } from "./audit.server";
import {
  generateInvitationToken,
  invitationExpiry,
  invitationLink,
} from "./invitations.server";
import {
  clientStatusCopy,
  invitationState,
  type ClientAccountSummary,
  type ClientInvitationSummary,
  type ClientRole,
  type PreferredContactMethod,
} from "./types";

type SB = SupabaseClient<Database>;

export async function requireOrgAdmin(
  supabase: SB,
  organizationId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_org_role", {
    _org: organizationId,
    _user: userId,
    _min: "admin",
  });
  if (error || data !== true) throw new ClientIdentityError("permission_denied");
}

function safeOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && u.hostname !== "localhost") {
      throw new Error("insecure origin");
    }
    return u.origin;
  } catch {
    throw new ClientIdentityError("invalid_input", "invalid origin");
  }
}

export async function loadClientIdentity(
  supabase: SB,
  organizationId: string,
  clientId: string,
): Promise<{ accounts: ClientAccountSummary[]; invitations: ClientInvitationSummary[] }> {
  const [{ data: accounts, error: aErr }, { data: invites, error: iErr }] = await Promise.all([
    supabase
      .from("client_accounts")
      .select(
        "id, email, first_name, last_name, phone, preferred_contact_method, role, status, last_login_at, created_at",
      )
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: true }),
    supabase
      .from("client_invitations")
      .select("id, email, first_name, last_name, role, accepted_at, revoked_at, expires_at, created_at")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);
  if (aErr || iErr) throw new ClientIdentityError("internal_error");

  return {
    accounts: (accounts ?? []).map((a) => ({
      ...a,
      preferred_contact_method: a.preferred_contact_method as PreferredContactMethod,
    })) as ClientAccountSummary[],
    invitations: (invites ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      first_name: i.first_name,
      last_name: i.last_name,
      role: i.role as ClientRole,
      state: invitationState(i),
      expires_at: i.expires_at,
      created_at: i.created_at,
    })),
  };
}

export async function createInvitation(
  supabase: SB,
  admin: SB,
  actorId: string,
  input: {
    organizationId: string;
    clientId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: ClientRole;
    origin: string;
  },
): Promise<{ invitationId: string; link: string }> {
  const origin = safeOrigin(input.origin);
  const email = input.email.trim().toLowerCase();

  const { data: existing } = await supabase
    .from("client_accounts")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) throw new ClientIdentityError("email_in_use");

  const { token, hash } = generateInvitationToken();
  const { data, error } = await supabase
    .from("client_invitations")
    .insert({
      organization_id: input.organizationId,
      client_id: input.clientId,
      email,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      role: input.role,
      token_hash: hash,
      expires_at: invitationExpiry(),
      invited_by: actorId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[client-identity] invitation insert failed", error?.message);
    throw new ClientIdentityError("permission_denied");
  }

  await recordClientAuditEvent(admin, {
    organization_id: input.organizationId,
    client_id: input.clientId,
    invitation_id: data.id,
    event_type: "client_invited",
    actor_type: "operator",
    actor_id: actorId,
    metadata: { email, role: input.role },
  });

  return { invitationId: data.id, link: invitationLink(origin, token) };
}

/** Rotate the token and extend expiry. The previous link stops working. */
export async function resendInvitation(
  supabase: SB,
  admin: SB,
  actorId: string,
  invitationId: string,
  origin: string,
): Promise<{ link: string }> {
  const safe = safeOrigin(origin);
  const { data: inv, error } = await supabase
    .from("client_invitations")
    .select("id, organization_id, client_id, accepted_at, email")
    .eq("id", invitationId)
    .maybeSingle();
  if (error || !inv) throw new ClientIdentityError("invitation_invalid");
  if (inv.accepted_at) throw new ClientIdentityError("invitation_accepted");

  const { token, hash } = generateInvitationToken();
  const { error: upErr } = await supabase
    .from("client_invitations")
    .update({ token_hash: hash, expires_at: invitationExpiry(), revoked_at: null, revoked_by: null })
    .eq("id", invitationId);
  if (upErr) throw new ClientIdentityError("permission_denied");

  await recordClientAuditEvent(admin, {
    organization_id: inv.organization_id,
    client_id: inv.client_id,
    invitation_id: inv.id,
    event_type: "client_invitation_resent",
    actor_type: "operator",
    actor_id: actorId,
    metadata: { email: inv.email },
  });

  return { link: invitationLink(safe, token) };
}

export async function revokeInvitation(
  supabase: SB,
  admin: SB,
  actorId: string,
  invitationId: string,
): Promise<void> {
  const { data: inv } = await supabase
    .from("client_invitations")
    .select("id, organization_id, client_id, accepted_at, email")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv) throw new ClientIdentityError("invitation_invalid");
  if (inv.accepted_at) throw new ClientIdentityError("invitation_accepted");

  const { error } = await supabase
    .from("client_invitations")
    .update({ revoked_at: new Date().toISOString(), revoked_by: actorId })
    .eq("id", invitationId);
  if (error) throw new ClientIdentityError("permission_denied");

  await recordClientAuditEvent(admin, {
    organization_id: inv.organization_id,
    client_id: inv.client_id,
    invitation_id: inv.id,
    event_type: "client_invitation_revoked",
    actor_type: "operator",
    actor_id: actorId,
    metadata: { email: inv.email },
  });
}

export async function setAccountStatus(
  supabase: SB,
  admin: SB,
  actorId: string,
  accountId: string,
  status: "active" | "deactivated",
): Promise<void> {
  const { data: acc } = await supabase
    .from("client_accounts")
    .select("id, organization_id, client_id, email, user_id")
    .eq("id", accountId)
    .maybeSingle();
  if (!acc) throw new ClientIdentityError("account_not_found");

  const { error } = await supabase.from("client_accounts").update({ status }).eq("id", accountId);
  if (error) throw new ClientIdentityError("permission_denied");

  if (status === "deactivated") {
    // Kill live sessions so deactivation takes effect immediately.
    await admin.auth.admin.signOut(acc.user_id, "global").catch(() => undefined);
  }

  await recordClientAuditEvent(admin, {
    organization_id: acc.organization_id,
    client_id: acc.client_id,
    client_account_id: acc.id,
    event_type: status === "active" ? "client_reactivated" : "client_deactivated",
    actor_type: "operator",
    actor_id: actorId,
    metadata: { email: acc.email },
  });
}

export async function removeAccount(
  supabase: SB,
  admin: SB,
  actorId: string,
  accountId: string,
): Promise<void> {
  const { data: acc } = await supabase
    .from("client_accounts")
    .select("id, organization_id, client_id, email, user_id")
    .eq("id", accountId)
    .maybeSingle();
  if (!acc) throw new ClientIdentityError("account_not_found");

  const { error } = await supabase.from("client_accounts").delete().eq("id", accountId);
  if (error) throw new ClientIdentityError("permission_denied");

  await admin.auth.admin.deleteUser(acc.user_id).catch(() => undefined);

  await recordClientAuditEvent(admin, {
    organization_id: acc.organization_id,
    client_id: acc.client_id,
    event_type: "client_removed",
    actor_type: "operator",
    actor_id: actorId,
    metadata: { email: acc.email },
  });
}

/* ------------------------------ client side ----------------------------- */

export interface ClientContext {
  account: ClientAccountSummary;
  company: { id: string; name: string; status: string };
  status: string;
  next_step: string;
}

export async function loadClientContext(supabase: SB, userId: string): Promise<ClientContext> {
  const { data: acc, error } = await supabase
    .from("client_accounts")
    .select(
      "id, organization_id, client_id, email, first_name, last_name, phone, preferred_contact_method, role, status, last_login_at, created_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new ClientIdentityError("internal_error");
  if (!acc || acc.status !== "active") throw new ClientIdentityError("account_not_found");

  // Company details are not readable by clients under RLS, so resolve the
  // single permitted record server-side from the verified account.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: company } = await supabaseAdmin
    .from("revenue_clients")
    .select("id, name, status")
    .eq("id", acc.client_id)
    .eq("organization_id", acc.organization_id)
    .maybeSingle();
  if (!company) throw new ClientIdentityError("client_not_found");

  const copy = clientStatusCopy(company.status);
  return {
    account: {
      id: acc.id,
      email: acc.email,
      first_name: acc.first_name,
      last_name: acc.last_name,
      phone: acc.phone,
      preferred_contact_method: acc.preferred_contact_method as PreferredContactMethod,
      role: acc.role as ClientRole,
      status: "active",
      last_login_at: acc.last_login_at,
      created_at: acc.created_at,
    },
    company: { id: company.id, name: company.name, status: company.status },
    status: copy.status,
    next_step: copy.nextStep,
  };
}

export async function updateOwnProfile(
  supabase: SB,
  userId: string,
  patch: {
    first_name: string;
    last_name: string;
    phone: string | null;
    preferred_contact_method: PreferredContactMethod;
  },
): Promise<void> {
  const { data: acc } = await supabase
    .from("client_accounts")
    .select("id, organization_id, client_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!acc) throw new ClientIdentityError("account_not_found");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Only these four fields are writable by the client. Role, status, company,
  // and organization are never accepted from the caller.
  const { error } = await supabaseAdmin
    .from("client_accounts")
    .update(patch)
    .eq("id", acc.id)
    .eq("user_id", userId);
  if (error) throw new ClientIdentityError("internal_error");

  await recordClientAuditEvent(supabaseAdmin, {
    organization_id: acc.organization_id,
    client_id: acc.client_id,
    client_account_id: acc.id,
    event_type: "client_profile_updated",
    actor_type: "client",
    actor_id: userId,
  });
}

export async function recordSessionEvent(
  supabase: SB,
  userId: string,
  event: "client_login" | "client_logout",
): Promise<void> {
  const { data: acc } = await supabase
    .from("client_accounts")
    .select("id, organization_id, client_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!acc) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (event === "client_login") {
    await supabaseAdmin
      .from("client_accounts")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", acc.id);
  }
  await recordClientAuditEvent(supabaseAdmin, {
    organization_id: acc.organization_id,
    client_id: acc.client_id,
    client_account_id: acc.id,
    event_type: event,
    actor_type: "client",
    actor_id: userId,
  });
}