// Persists detector output, recommendations, health snapshots, and digests.
// All writes go through the admin client (RLS-safe for a trusted server fn
// that already verified the caller through requireSupabaseAuth).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  RECOMMENDATION_VERSION,
  HEALTH_METHOD_VERSION,
  DIGEST_METHOD_VERSION,
  type DetectorFinding,
  type HealthReport,
  type RecommendationDraft,
  type DigestReport,
} from "./types";

type Insight = Database["public"]["Tables"]["executive_insights"]["Row"];

const SEVERITY_MAP: Record<DetectorFinding["severity"], string> = {
  information: "information",
  opportunity: "opportunity",
  warning: "warning",
  critical: "critical",
};

export interface PersistedInsight {
  id: string;
  patternKey: string;
  entityRef: string;
  ventureId: string | null;
  priority: string;
  title: string;
  summary: string;
}

export async function upsertInsights(
  supabaseAdmin: SupabaseClient<Database>,
  organizationId: string,
  findings: DetectorFinding[],
): Promise<PersistedInsight[]> {
  if (findings.length === 0) return [];

  // Fetch existing active + dismissed matches so we can update-in-place or
  // resurrect a dismissed row if evidence changed materially.
  const patternKeys = Array.from(new Set(findings.map((f) => f.patternKey)));
  const { data: existing } = await supabaseAdmin
    .from("executive_insights")
    .select("id, pattern_key, entity_ref, dismissed_at, evidence")
    .eq("organization_id", organizationId)
    .in("pattern_key", patternKeys);

  const byKey = new Map<string, { id: string; dismissed: boolean; evidence: unknown }>();
  for (const row of existing ?? []) {
    if (!row.pattern_key || !row.entity_ref) continue;
    byKey.set(`${row.pattern_key}|${row.entity_ref}`, {
      id: row.id,
      dismissed: row.dismissed_at !== null,
      evidence: row.evidence,
    });
  }

  const persisted: PersistedInsight[] = [];

  for (const f of findings) {
    const key = `${f.patternKey}|${f.entityRef}`;
    const prev = byKey.get(key);
    const payload = {
      organization_id: organizationId,
      venture_id: f.ventureId,
      insight_type: f.patternKey,
      title: f.title,
      summary: f.summary,
      severity: SEVERITY_MAP[f.severity] as Insight["severity"],
      priority: f.priority as Insight["priority"],
      confidence: f.confidence,
      evidence: f.evidence as unknown as Insight["evidence"],
      pattern_key: f.patternKey,
      pattern_version: f.patternVersion,
      entity_ref: f.entityRef,
      source_records: f.evidence.refs as unknown as Insight["source_records"],
      status: "active" as Insight["status"],
      generated_at: new Date().toISOString(),
    };

    if (prev) {
      // Only clear dismissal if evidence materially changed.
      const evidenceChanged =
        JSON.stringify(prev.evidence ?? {}) !== JSON.stringify(f.evidence);
      const update = evidenceChanged
        ? { ...payload, dismissed_at: null, dismissed_by: null, dismissed_reason: null }
        : payload;
      const { error } = await supabaseAdmin
        .from("executive_insights")
        .update(update)
        .eq("id", prev.id);
      if (error) throw new Error(`insight update failed: ${error.message}`);
      persisted.push({
        id: prev.id,
        patternKey: f.patternKey,
        entityRef: f.entityRef,
        ventureId: f.ventureId,
        priority: f.priority,
        title: f.title,
        summary: f.summary,
      });
    } else {
      const { data, error } = await supabaseAdmin
        .from("executive_insights")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) throw new Error(`insight insert failed: ${error?.message ?? "unknown"}`);
      persisted.push({
        id: data.id,
        patternKey: f.patternKey,
        entityRef: f.entityRef,
        ventureId: f.ventureId,
        priority: f.priority,
        title: f.title,
        summary: f.summary,
      });
    }
  }

  return persisted;
}

export interface PersistedRecommendation {
  id: string;
  kind: string;
  title: string;
  priority: string;
}

export async function upsertRecommendations(
  supabaseAdmin: SupabaseClient<Database>,
  organizationId: string,
  drafts: RecommendationDraft[],
  insightsByKey: Map<string, string>, // `${patternKey}|${entityRef}` -> insightId
  actorUserId: string | null,
): Promise<PersistedRecommendation[]> {
  if (drafts.length === 0) return [];

  // De-dupe: if a pending recommendation already exists for the same insight,
  // update it in place instead of creating a duplicate.
  const insightIds = Array.from(
    new Set(
      drafts
        .map((d) => insightsByKey.get(`${d.insightPatternKey}|${d.insightEntityRef}`))
        .filter((x): x is string => !!x),
    ),
  );
  const { data: existing } = insightIds.length
    ? await supabaseAdmin
        .from("sam_recommendations")
        .select("id, insight_id, status")
        .eq("organization_id", organizationId)
        .in("insight_id", insightIds)
        .eq("status", "pending")
    : { data: [] };

  const existingByInsight = new Map<string, string>();
  for (const row of existing ?? []) {
    if (row.insight_id) existingByInsight.set(row.insight_id, row.id);
  }

  const out: PersistedRecommendation[] = [];
  for (const d of drafts) {
    const insightId = insightsByKey.get(`${d.insightPatternKey}|${d.insightEntityRef}`) ?? null;
    const payload = {
      organization_id: organizationId,
      venture_id: d.ventureId,
      insight_id: insightId,
      kind: d.kind,
      title: d.title,
      rationale: d.rationale,
      evidence: d.evidence as never,
      expected_impact: d.expectedImpact,
      confidence: d.confidence,
      priority: d.priority,
      status: "pending" as const,
      method_version: RECOMMENDATION_VERSION,
    };
    const dupId = insightId ? existingByInsight.get(insightId) : undefined;
    if (dupId) {
      const { error } = await supabaseAdmin
        .from("sam_recommendations")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", dupId);
      if (error) throw new Error(`rec update failed: ${error.message}`);
      out.push({ id: dupId, kind: d.kind, title: d.title, priority: d.priority });
    } else {
      const { data, error } = await supabaseAdmin
        .from("sam_recommendations")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data)
        throw new Error(`rec insert failed: ${error?.message ?? "unknown"}`);
      await supabaseAdmin.from("sam_recommendation_events").insert({
        organization_id: organizationId,
        recommendation_id: data.id,
        actor_user_id: actorUserId,
        action: "created",
        payload: { kind: d.kind } as never,
      });
      out.push({ id: data.id, kind: d.kind, title: d.title, priority: d.priority });
    }
  }
  return out;
}

export async function persistHealthSnapshot(
  supabaseAdmin: SupabaseClient<Database>,
  organizationId: string,
  ventureId: string | null,
  report: HealthReport,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("sam_health_snapshots")
    .insert({
      organization_id: organizationId,
      venture_id: ventureId,
      computed_at: report.computedAt,
      overall: report.overall,
      categories: report.categories as never,
      inputs: report.inputs as never,
      method_version: HEALTH_METHOD_VERSION,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`health insert failed: ${error?.message ?? "unknown"}`);
  return data.id;
}

export async function persistDigest(
  supabaseAdmin: SupabaseClient<Database>,
  organizationId: string,
  digestDate: string,
  report: DigestReport,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("sam_executive_digests")
    .upsert(
      {
        organization_id: organizationId,
        digest_date: digestDate,
        sections: report.sections as never,
        insight_ids: report.insightIds,
        recommendation_ids: report.recommendationIds,
        health_snapshot_id: report.healthSnapshotId,
        generated_at: report.generatedAt,
        method_version: DIGEST_METHOD_VERSION,
      },
      { onConflict: "organization_id,digest_date" },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`digest upsert failed: ${error?.message ?? "unknown"}`);
  return data.id;
}