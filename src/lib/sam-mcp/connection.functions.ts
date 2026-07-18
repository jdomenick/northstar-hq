// Client-callable server functions for the Northstar SAM MCP connection.
// Both are admin-only. The API key never crosses this boundary.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { readConnection, testConnection, type ConnectionRecord, type TestConnectionOutcome } from "./service.server";
import { SAM_MCP_SERVER_URL } from "./client.server";

const OrgInput = z.object({ organizationId: z.string().uuid() });

async function requireOrgAdmin(
  supabase: never,
  userId: string,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; reason: "not_a_member" | "insufficient_role" }> {
  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (a: string, b: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: { role: string } | null }> } } };
    };
  };
  const { data } = await sb
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_a_member" };
  const rank: Record<string, number> = { viewer: 0, member: 1, executive: 2, admin: 3, owner: 4 };
  if ((rank[data.role] ?? -1) < rank.admin) return { ok: false, reason: "insufficient_role" };
  return { ok: true };
}

export const getSamMcpConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => OrgInput.parse(v))
  .handler(async ({ data, context }): Promise<
    | { ok: true; record: ConnectionRecord; apiKeyConfigured: boolean; serverUrl: string }
    | { ok: false; reason: "not_a_member" | "insufficient_role" }
  > => {
    const gate = await requireOrgAdmin(context.supabase as never, context.userId, data.organizationId);
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const record = await readConnection(data.organizationId);
    return {
      ok: true,
      record,
      apiKeyConfigured: Boolean(process.env.SAM_MCP_API_KEY && process.env.SAM_MCP_API_KEY.trim().length >= 8),
      serverUrl: SAM_MCP_SERVER_URL,
    };
  });

export const runSamMcpConnectionTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => OrgInput.parse(v))
  .handler(async ({ data, context }): Promise<
    | { ok: true; outcome: TestConnectionOutcome; record: ConnectionRecord }
    | { ok: false; reason: "not_a_member" | "insufficient_role" }
  > => {
    const gate = await requireOrgAdmin(context.supabase as never, context.userId, data.organizationId);
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const outcome = await testConnection({
      organizationId: data.organizationId,
      actorUserId: context.userId,
    });
    const record = await readConnection(data.organizationId);
    return { ok: true, outcome, record };
  });