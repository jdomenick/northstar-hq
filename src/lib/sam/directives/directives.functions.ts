import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OrgOnly = z.object({ organizationId: z.string().uuid() });

async function assertMember(supabase: unknown, orgId: string, userId: string) {
  const sb = supabase as { from: (t: string) => { select: (s: string) => { eq: (a: string, b: string) => { eq: (c: string, d: string) => { maybeSingle: () => Promise<{ data: { role: string; status: string } | null }> } } } } };
  const { data } = await sb.from("organization_members").select("role, status").eq("organization_id", orgId).eq("user_id", userId).maybeSingle();
  if (!data || data.status !== "active") throw new Error("Not a member of this organization");
  return data.role as string;
}
function roleAtLeast(role: string, min: "executive" | "admin" | "owner"): boolean {
  const order = ["viewer", "member", "executive", "admin", "owner"];
  return order.indexOf(role) >= order.indexOf(min);
}

export const listDirectives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgOnly.parse(i))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, data.organizationId, context.userId);
    const { data: rows } = await context.supabase
      .from("sam_directives" as never)
      .select("id, text, scope, priority, status, starts_at, expires_at, venture_id, created_by, created_at, updated_at" as never)
      .eq("organization_id", data.organizationId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows ?? []) as any;
  });

const CreateInput = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid().nullable().optional(),
  text: z.string().min(1).max(2000),
  scope: z.enum(["permanent", "temporary"]).default("permanent"),
  priority: z.number().int().min(0).max(1000).default(100),
  expiresAt: z.string().datetime().nullable().optional(),
});
export const createDirective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateInput.parse(i))
  .handler(async ({ data, context }) => {
    const role = await assertMember(context.supabase, data.organizationId, context.userId);
    if (!roleAtLeast(role, "executive")) throw new Error("Executive+ role required");
    const { data: row, error } = await context.supabase
      .from("sam_directives" as never)
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId ?? null,
        text: data.text, scope: data.scope, priority: data.priority,
        status: "active",
        expires_at: data.expiresAt ?? null,
        created_by: context.userId,
      } as never)
      .select("id" as never).single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    const id = (row as unknown as { id: string }).id;
    await context.supabase.from("activity_events").insert({
      organization_id: data.organizationId, actor_user_id: context.userId,
      action: "sam_directive_created", entity_type: "sam_directive", entity_id: id,
      summary: `Directive: ${data.text.slice(0, 120)}`, metadata: { source: "ui" } as never,
    });
    return { id };
  });

const UpdateInput = z.object({
  organizationId: z.string().uuid(),
  directiveId: z.string().uuid(),
  text: z.string().min(1).max(2000).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
export const updateDirective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateInput.parse(i))
  .handler(async ({ data, context }) => {
    const role = await assertMember(context.supabase, data.organizationId, context.userId);
    if (!roleAtLeast(role, "executive")) throw new Error("Executive+ role required");
    const patch: Record<string, unknown> = {};
    if (data.text !== undefined) patch.text = data.text;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.status !== undefined) patch.status = data.status;
    if (data.expiresAt !== undefined) patch.expires_at = data.expiresAt;
    const { error } = await context.supabase
      .from("sam_directives" as never)
      .update(patch as never)
      .eq("id", data.directiveId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_events").insert({
      organization_id: data.organizationId, actor_user_id: context.userId,
      action: "sam_directive_updated", entity_type: "sam_directive", entity_id: data.directiveId,
      summary: `Directive updated`, metadata: patch as never,
    });
    return { ok: true };
  });