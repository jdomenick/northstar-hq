// Core intelligence sweep, callable from both a server function and a
// background automation handler. Accepts any supabase-typed client with
// read+write access appropriate to the caller (RLS-scoped or admin).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
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

export type IntelligenceSweepResult = {
  version: string;
  organizationId: string;
  insightsPersisted: number;
  recommendationsPersisted: number;
  healthSnapshotId: string;
  digestId: string;
  overallHealth: number;
};

export async function runIntelligenceSweepFor(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  actorUserId: string | null = null,
): Promise<IntelligenceSweepResult> {
  const dataset = await loadIntelligenceDataset(supabase, organizationId);
  const findings = orderFindings(runAllDetectors(dataset));

  const persistedInsights = await upsertInsights(supabase, organizationId, findings);
  const insightsByKey = new Map(
    persistedInsights.map((i) => [`${i.patternKey}|${i.entityRef}`, i.id]),
  );
  const drafts = recommendationsForAll(findings);
  const persistedRecs = await upsertRecommendations(
    supabase,
    organizationId,
    drafts,
    insightsByKey,
    actorUserId,
  );

  const health = computeHealth(dataset);
  const healthSnapshotId = await persistHealthSnapshot(
    supabase,
    organizationId,
    null,
    health,
  );

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
    recentlyLearned: [],
    recentWins: [],
  });

  const digestDate = new Date().toISOString().slice(0, 10);
  const digestId = await persistDigest(supabase, organizationId, digestDate, digest);

  return {
    version: INTELLIGENCE_VERSION,
    organizationId,
    insightsPersisted: persistedInsights.length,
    recommendationsPersisted: persistedRecs.length,
    healthSnapshotId,
    digestId,
    overallHealth: health.overall,
  };
}