// Server functions for Phase 3C SAM Executive Intelligence.
// Every mutation runs behind requireSupabaseAuth. Writes go through the
// admin client loaded inside the handler.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { loadIntelligenceDataset } from "./dataset.server";
import { orderFindings, runAllDetectors } from "./detectors";
import { recommendationsForAll } from "./recommendations";
import { computeHealth } from "./health";
import { assembleDigest } from "./digest";
import {
  persistDigest,
  persistHealthSnapshot,
  upsertInsights,
  upsertRecommendations,
} from "./persist.server";
import { INTELLIGENCE_VERSION } from "./types";

const OrgInput = z.object({ organizationId: z.string().uuid() });
const OrgVentureInput = OrgInput.extend({
  ventureId: z.string().uuid().nullable().optional(),
});

export const runIntelligenceSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { organizationId } = data;

    // Authorization: caller must be an org member (RLS on downstream reads
    // enforces this, but fail fast).
    const { data: mem } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!mem) throw new Error("Not a member of this organization");

    const dataset = await loadIntelligenceDataset(supabase, organizationId);
    const findings = orderFindings(runAllDetectors(dataset));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const persistedInsights = await upsertInsights(
      supabaseAdmin,
      organizationId,
      findings,
    );

    const insightsByKey = new Map(
      persistedInsights.map((i) => [`${i.patternKey}|${i.entityRef}`, i.id]),
    );

    const drafts = recommendationsForAll(findings);
    const persistedRecs = await upsertRecommendations(
      supabaseAdmin,
      organizationId,
      drafts,
      insightsByKey,
      userId,
    );

    const health = computeHealth(dataset);
    const healthSnapshotId = await persistHealthSnapshot(
      supabaseAdmin,
      organizationId,
      null,
      health,
    );

    // Recently learned (SAM memory confirmed last 24h)
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data: learnedRows } = await supabase
      .from("sam_memory_items")
      .select("id, title, statement, last_confirmed_at")
      .eq("organization_id", organizationId)
      .gte("last_confirmed_at", dayAgo)
      .order("last_confirmed_at", { ascending: false })
      .limit(10);

    // Recent wins (last 7 days): completed projects/commitments, achieved goals
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [projWon, commitWon, goalWon] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, updated_at")
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .gte("updated_at", weekAgo)
        .limit(10),
      supabase
        .from("commitments")
        .select("id, title, completed_at")
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .gte("completed_at", weekAgo)
        .limit(10),
      supabase
        .from("goals")
        .select("id, title, updated_at")
        .eq("organization_id", organizationId)
        .eq("status", "achieved")
        .gte("updated_at", weekAgo)
        .limit(10),
    ]);

    const recentWins = [
      ...(projWon.data ?? []).map((p) => ({ id: p.id, kind: "project" as const, title: p.name })),
      ...(commitWon.data ?? []).map((c) => ({ id: c.id, kind: "commitment" as const, title: c.title })),
      ...(goalWon.data ?? []).map((g) => ({ id: g.id, kind: "goal" as const, title: g.title })),
    ];

    const digest = assembleDigest({
      dataset,
      insights: persistedInsights.map((i) => ({
        id: i.id,
        pattern_key: i.patternKey,
        title: i.title,
        summary: i.summary,
        priority: i.priority,
        entity_ref: i.entityRef,
      })),
      recommendations: persistedRecs.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        rationale: "",
        priority: r.priority,
      })),
      health,
      healthSnapshotId,
      recentlyLearned: (learnedRows ?? []).map((r) => ({
        id: r.id,
        title: r.title ?? "Memory confirmed",
        summary: r.statement,
      })),
      recentWins,
    });

    const digestDate = new Date().toISOString().slice(0, 10);
    const digestId = await persistDigest(supabaseAdmin, organizationId, digestDate, digest);

    return {
      version: INTELLIGENCE_VERSION,
      insightsPersisted: persistedInsights.length,
      recommendationsPersisted: persistedRecs.length,
      healthSnapshotId,
      digestId,
      overallHealth: health.overall,
    };
  });

export const listInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    OrgVentureInput.extend({
      includeDismissed: z.boolean().optional().default(false),
      limit: z.number().int().min(1).max(200).optional().default(50),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("executive_insights")
      .select(
        "id, organization_id, venture_id, insight_type, pattern_key, entity_ref, title, summary, severity, priority, confidence, evidence, status, dismissed_at, dismissed_reason, generated_at",
      )
      .eq("organization_id", data.organizationId)
      .order("priority", { ascending: true })
      .order("generated_at", { ascending: false })
      .limit(data.limit);
    if (data.ventureId) q = q.eq("venture_id", data.ventureId);
    if (!data.includeDismissed) q = q.is("dismissed_at", null);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const dismissInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        insightId: z.string().uuid(),
        reason: z.string().min(1).max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("executive_insights")
      .update({
        status: "dismissed",
        dismissed_at: new Date().toISOString(),
        dismissed_by: userId,
        dismissed_reason: data.reason ?? null,
      })
      .eq("id", data.insightId)
      .eq("organization_id", data.organizationId);
    if (error) throw error;
    return { ok: true };
  });

export const listRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    OrgVentureInput.extend({
      status: z.array(z.enum(["pending", "accepted", "dismissed", "snoozed", "converted"])).optional(),
      limit: z.number().int().min(1).max(200).optional().default(50),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("sam_recommendations")
      .select(
        "id, organization_id, venture_id, insight_id, kind, title, rationale, expected_impact, confidence, priority, status, evidence, snooze_until, created_at, resolved_at",
      )
      .eq("organization_id", data.organizationId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.ventureId) q = q.eq("venture_id", data.ventureId);
    q = q.in("status", data.status ?? ["pending"]);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

const ActInput = z.object({
  organizationId: z.string().uuid(),
  recommendationId: z.string().uuid(),
  action: z.enum([
    "accepted",
    "dismissed",
    "snoozed",
    "assigned",
    "converted_task",
    "converted_goal",
    "opened",
  ]),
  reason: z.string().max(1000).optional(),
  snoozeUntil: z.string().datetime().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const actOnRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ActInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    type RecUpdate = {
      status?: "pending" | "accepted" | "dismissed" | "snoozed" | "converted";
      resolved_at?: string;
      resolved_by?: string;
      snooze_until?: string;
      converted_to_ref?: unknown;
    };
    const patch: RecUpdate = {};
    switch (data.action) {
      case "accepted":
        patch.status = "accepted";
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by = userId;
        break;
      case "dismissed":
        patch.status = "dismissed";
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by = userId;
        break;
      case "snoozed":
        patch.status = "snoozed";
        patch.snooze_until = data.snoozeUntil ?? new Date(Date.now() + 86_400_000).toISOString();
        break;
      case "converted_task":
      case "converted_goal":
        patch.status = "converted";
        patch.converted_to_ref = data.payload ?? { kind: data.action };
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by = userId;
        break;
      case "assigned":
      case "opened":
        break;
    }
    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from("sam_recommendations")
        .update(patch as never)
        .eq("id", data.recommendationId)
        .eq("organization_id", data.organizationId);
      if (error) throw error;
    }
    const { error: eErr } = await supabase.from("sam_recommendation_events").insert({
      organization_id: data.organizationId,
      recommendation_id: data.recommendationId,
      actor_user_id: userId,
      action: data.action,
      reason: data.reason ?? null,
      payload: (data.payload ?? null) as never,
    });
    if (eErr) throw eErr;
    return { ok: true };
  });

export const getHealthSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgVentureInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("sam_health_snapshots")
      .select("id, overall, categories, inputs, computed_at, method_version, venture_id")
      .eq("organization_id", data.organizationId)
      .order("computed_at", { ascending: false })
      .limit(1);
    q = data.ventureId ? q.eq("venture_id", data.ventureId) : q.is("venture_id", null);
    const { data: row, error } = await q.maybeSingle();
    if (error) throw error;
    return row;
  });

export const getHealthTrend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    OrgVentureInput.extend({ days: z.number().int().min(1).max(180).optional().default(30) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    let q = supabase
      .from("sam_health_snapshots")
      .select("id, overall, computed_at")
      .eq("organization_id", data.organizationId)
      .gte("computed_at", since)
      .order("computed_at", { ascending: true });
    q = data.ventureId ? q.eq("venture_id", data.ventureId) : q.is("venture_id", null);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const getTodayDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);
    const { data: row, error } = await supabase
      .from("sam_executive_digests")
      .select("id, digest_date, sections, insight_ids, recommendation_ids, health_snapshot_id, generated_at")
      .eq("organization_id", data.organizationId)
      .eq("digest_date", today)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const listRecommendationEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        recommendationId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("sam_recommendation_events")
      .select("id, action, reason, payload, actor_user_id, created_at")
      .eq("organization_id", data.organizationId)
      .eq("recommendation_id", data.recommendationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });