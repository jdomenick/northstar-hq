// Server functions for SAM Memory. All routed through requireSupabaseAuth so
// RLS enforces organization + privacy scope. Client never sets
// organization_id / owner_user_id — those are derived from the authenticated
// user + validated input.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SamError } from "@/lib/errors";
import {
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryLayer,
  MemoryStatus,
  PERSONAL_LAYERS,
  bandForScore,
} from "./schema";
import type { Database } from "@/integrations/supabase/types";
import { SAM_MEMORY_LIMITS } from "@/lib/constants";
import { detectConflicts } from "./conflict";

async function assertMembership(
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>,
  orgId: string,
  userId: string,
) {
  const { data: mem } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem || mem.status !== "active") throw new SamError("membership_unavailable");
  return mem;
}

// ---- listMemory ------------------------------------------------------------
const ListInput = z.object({
  organizationId: z.string().uuid(),
  layer: MemoryLayer.optional(),
  status: MemoryStatus.optional(),
  ventureId: z.string().uuid().nullable().optional(),
  query: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(SAM_MEMORY_LIMITS.maxListPage).optional(),
});

export const listMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    let q = supabase
      .from("sam_memory_items")
      .select("*")
      .eq("organization_id", data.organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(data.limit ?? SAM_MEMORY_LIMITS.maxListPage);
    if (data.layer) q = q.eq("layer", data.layer);
    if (data.status) q = q.eq("status", data.status);
    if (data.ventureId) q = q.eq("venture_id", data.ventureId);
    if (data.query) q = q.or(`title.ilike.%${data.query}%,statement.ilike.%${data.query}%`);
    const { data: rows, error } = await q;
    if (error) throw new SamError("unknown_error", error.message);
    return rows ?? [];
  });

// ---- getMemory -------------------------------------------------------------
export const getMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid(), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    const { data: item } = await supabase
      .from("sam_memory_items")
      .select("*")
      .eq("id", data.id)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!item) throw new SamError("memory_not_found");
    return item;
  });

// ---- createMemory ----------------------------------------------------------
export const createMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateMemoryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);

    const personal = PERSONAL_LAYERS.has(data.layer);
    const ownerId = personal ? userId : null;

    if (data.layer === "venture") {
      if (!data.ventureId) throw new SamError("memory_venture_required");
      const { data: v } = await supabase
        .from("ventures")
        .select("id, organization_id")
        .eq("id", data.ventureId)
        .maybeSingle();
      if (!v || v.organization_id !== data.organizationId) {
        throw new SamError("memory_venture_required");
      }
    }

    // Manual creation defaults to confirmed with the actor as confirmer.
    const status = data.status ?? (data.source_type === "manual" ? "confirmed" : "proposed");
    const confidence = data.confidence_score ?? (status === "confirmed" ? 0.8 : 0.5);

    const { data: row, error } = await supabase
      .from("sam_memory_items")
      .insert({
        organization_id: data.organizationId,
        owner_user_id: ownerId,
        venture_id: data.layer === "venture" ? data.ventureId ?? null : null,
        layer: data.layer,
        category: data.category,
        title: data.title,
        statement: data.statement,
        structured_value: (data.structured_value as never) ?? null,
        status,
        confidence_score: confidence,
        confidence_band: bandForScore(confidence),
        source_type: data.source_type,
        source_entity_type: data.source_entity_type ?? null,
        source_entity_id: data.source_entity_id ?? null,
        source_knowledge_record_id: data.source_knowledge_record_id ?? null,
        source_conversation_id: data.source_conversation_id ?? null,
        source_message_id: data.source_message_id ?? null,
        effective_at: data.effective_at ?? null,
        expires_at: data.expires_at ?? null,
        last_confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
        confirmed_by: status === "confirmed" ? userId : null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error || !row) throw new SamError("unknown_error", error?.message);
    return row;
  });

// ---- updateMemory ----------------------------------------------------------
export const updateMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateMemoryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    const patch: Database["public"]["Tables"]["sam_memory_items"]["Update"] = {
      ...(data.patch as Database["public"]["Tables"]["sam_memory_items"]["Update"]),
    };
    if (patch.confidence_score != null) {
      patch.confidence_band = bandForScore(patch.confidence_score);
    }
    const { data: row, error } = await supabase
      .from("sam_memory_items")
      .update(patch)
      .eq("id", data.id)
      .eq("organization_id", data.organizationId)
      .select("*")
      .single();
    if (error) throw new SamError("unknown_error", error.message);
    if (!row) throw new SamError("memory_not_found");
    return row;
  });

// ---- status transitions ---------------------------------------------------
const StatusInput = z.object({
  organizationId: z.string().uuid(),
  id: z.string().uuid(),
  reason: z.string().max(400).optional(),
});

async function transitionStatus(
  ctx: { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string },
  data: z.infer<typeof StatusInput>,
  next: MemoryStatus,
  extra: Database["public"]["Tables"]["sam_memory_items"]["Update"] = {},
) {
  await assertMembership(ctx.supabase, data.organizationId, ctx.userId);
  const { data: row, error } = await ctx.supabase
    .from("sam_memory_items")
    .update({ status: next, ...extra })
    .eq("id", data.id)
    .eq("organization_id", data.organizationId)
    .select("*")
    .single();
  if (error) throw new SamError("unknown_error", error.message);
  if (!row) throw new SamError("memory_not_found");
  return row;
}

export const confirmMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(({ data, context }) =>
    transitionStatus(context, data, "confirmed", {
      last_confirmed_at: new Date().toISOString(),
      confirmed_by: context.userId,
    }),
  );

export const rejectMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(({ data, context }) =>
    transitionStatus(context, data, "archived", { deleted_at: new Date().toISOString() }),
  );

export const disputeMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(({ data, context }) => transitionStatus(context, data, "disputed"));

export const markMemoryOutdated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(({ data, context }) => transitionStatus(context, data, "outdated"));

export const archiveMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(({ data, context }) =>
    transitionStatus(context, data, "archived", { deleted_at: new Date().toISOString() }),
  );

export const restoreMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(({ data, context }) =>
    transitionStatus(context, data, "confirmed", { deleted_at: null }),
  );

// ---- listMemoryVersions ---------------------------------------------------
export const listMemoryVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid(), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    const { data: rows } = await supabase
      .from("sam_memory_versions")
      .select("*")
      .eq("memory_item_id", data.id)
      .order("version_number", { ascending: false })
      .limit(SAM_MEMORY_LIMITS.maxVersionHistory);
    return rows ?? [];
  });

// ---- submitMemoryFeedback --------------------------------------------------
export const submitMemoryFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        memoryItemId: z.string().uuid(),
        feedback_type: z.enum(["accurate", "inaccurate", "incomplete", "outdated", "disputed"]),
        correction_text: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    const { error } = await supabase.from("sam_memory_feedback").insert({
      organization_id: data.organizationId,
      memory_item_id: data.memoryItemId,
      user_id: userId,
      feedback_type: data.feedback_type,
      correction_text: data.correction_text ?? null,
    });
    if (error) throw new SamError("learning_persistence_failed", error.message);
    return { ok: true };
  });

// ---- listConflicts --------------------------------------------------------
export const listMemoryConflicts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    // Best-effort refresh: recompute open conflicts from current confirmed items.
    const { data: items } = await supabase
      .from("sam_memory_items")
      .select("*")
      .eq("organization_id", data.organizationId)
      .is("deleted_at", null)
      .in("status", ["confirmed", "proposed"])
      .limit(500);
    const detected = detectConflicts(items ?? []);
    if (detected.length) {
      const rows = detected.map((c) => ({
        organization_id: data.organizationId,
        memory_item_a_id: c.a.id,
        memory_item_b_id: c.b.id,
        reason: c.reason,
        status: "open",
      }));
      // Idempotency: rely on manual dedupe by pair for now.
      const { data: existing } = await supabase
        .from("sam_memory_conflicts")
        .select("memory_item_a_id, memory_item_b_id")
        .eq("organization_id", data.organizationId)
        .eq("status", "open");
      const seen = new Set(
        (existing ?? []).map((e) => `${e.memory_item_a_id}|${e.memory_item_b_id}`),
      );
      const toInsert = rows.filter(
        (r) =>
          !seen.has(`${r.memory_item_a_id}|${r.memory_item_b_id}`) &&
          !seen.has(`${r.memory_item_b_id}|${r.memory_item_a_id}`),
      );
      if (toInsert.length) {
        await supabase.from("sam_memory_conflicts").insert(toInsert);
      }
    }
    const { data: conflicts } = await supabase
      .from("sam_memory_conflicts")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(SAM_MEMORY_LIMITS.maxConflictsPerRun);
    return conflicts ?? [];
  });

export const resolveMemoryConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        id: z.string().uuid(),
        status: z.enum(["resolved", "dismissed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    const { error } = await supabase
      .from("sam_memory_conflicts")
      .update({
        status: data.status,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new SamError("unknown_error", error.message);
    return { ok: true };
  });