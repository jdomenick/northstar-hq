import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ClientIdentityError } from "@/lib/client-identity/errors";
import {
  buildClientWorkspace,
  type ResolvedAccount,
} from "@/lib/client-workspace/workspace.server";
import { buildClientDelivery } from "@/lib/delivery/client-delivery.server";
import { buildClientExecutiveReport } from "@/lib/reporting/reporting.server";
import type { ClientWorkspaceData } from "@/lib/client-workspace/types";
import type { ClientDeliveryView } from "@/lib/delivery/client-delivery";
import type { ClientExecutiveReportView } from "@/lib/reporting/types";
import { canPreviewAsClient } from "./access";

type SB = SupabaseClient<Database>;

export interface PreviewContext {
  scope: ResolvedAccount;
  company: { id: string; name: string; status: string };
  /** Shape of an existing client login, used only to render the profile page. */
  account: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    preferred_contact_method: "email" | "phone" | "sms";
    role: "client_admin" | "client_user";
  } | null;
}

/**
 * Verifies the caller is an active admin/owner of the organization AND that the
 * client belongs to that organization. Reads stay scoped to organization_id +
 * client_id. No impersonation, no session change, no RLS bypass for the client.
 */
export async function requireClientPreviewAccess(
  supabase: SB,
  organizationId: string,
  clientId: string,
  userId: string,
): Promise<PreviewContext> {
  const { data: mem, error: memErr } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memErr) throw new ClientIdentityError("internal_error", memErr.message);
  if (!canPreviewAsClient(mem?.role, mem?.status)) {
    throw new ClientIdentityError("permission_denied");
  }

  const { data: client, error: clientErr } = await supabase
    .from("revenue_clients")
    .select("id, name, status")
    .eq("id", clientId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (clientErr) throw new ClientIdentityError("internal_error", clientErr.message);
  if (!client) throw new ClientIdentityError("client_not_found");

  const { data: account } = await supabase
    .from("client_accounts")
    .select("email, first_name, last_name, phone, preferred_contact_method, role, status")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    scope: {
      account_id: "preview",
      organization_id: organizationId,
      client_id: clientId,
      role: account?.role ?? "client_admin",
    },
    company: client,
    account: account
      ? {
          email: account.email,
          first_name: account.first_name,
          last_name: account.last_name,
          phone: account.phone,
          preferred_contact_method: account.preferred_contact_method,
          role: account.role,
        }
      : null,
  };
}

export async function previewWorkspace(
  supabase: SB,
  organizationId: string,
  clientId: string,
  userId: string,
): Promise<ClientWorkspaceData> {
  const ctx = await requireClientPreviewAccess(supabase, organizationId, clientId, userId);
  return buildClientWorkspace(supabase, ctx.scope);
}

export async function previewDelivery(
  supabase: SB,
  organizationId: string,
  clientId: string,
  userId: string,
): Promise<ClientDeliveryView> {
  const ctx = await requireClientPreviewAccess(supabase, organizationId, clientId, userId);
  return buildClientDelivery(supabase, ctx.scope);
}

export async function previewExecutiveReport(
  supabase: SB,
  organizationId: string,
  clientId: string,
  userId: string,
): Promise<ClientExecutiveReportView> {
  const ctx = await requireClientPreviewAccess(supabase, organizationId, clientId, userId);
  return buildClientExecutiveReport(supabase, ctx.scope);
}
