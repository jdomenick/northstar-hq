// Version-history and freshness bookkeeping for ingested content items.
// Called by the change-detection ingest path. All writes preserve audit;
// nothing is ever destroyed. Freshness classification is delegated to
// freshness.server.ts so behavior stays consistent with SAM context.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { classifyFreshness } from "./freshness.server";
import type { ChangeDetectionResult } from "./change-detection";

type SB = SupabaseClient<Database>;

export interface RecordVersionInput {
  organizationId: string;
  contentItemId: string;
  nextVersionNumber: number;
  contentHash: string;
  title: string | null;
  text: string | null;
  change: ChangeDetectionResult;
  metadata?: Record<string, unknown>;
}

export async function recordContentVersion(supabase: SB, input: RecordVersionInput): Promise<void> {
  const { error } = await supabase.from("ingested_content_versions").insert({
    organization_id: input.organizationId,
    content_item_id: input.contentItemId,
    version_number: input.nextVersionNumber,
    content_hash: input.contentHash,
    title: input.title,
    content_text: input.text,
    change_significance: input.change.significance,
    diff_summary: {
      ratio: input.change.changeRatio,
      title_changed: input.change.titleChanged,
      length_delta: input.change.lengthDeltaChars,
      signals: input.change.signals,
    } as unknown as Json,
    metadata: (input.metadata ?? {}) as unknown as Json,
  });
  if (error) throw error;
}

// Recompute freshness for every content item in an org. Deterministic;
// safe to call from a manual admin action or a future scheduler.
export async function recomputeOrgFreshness(supabase: SB, organizationId: string): Promise<{ updated: number }> {
  const { data: rows, error } = await supabase
    .from("ingested_content_items")
    .select("id, last_ingested_at, freshness_status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (error) throw error;

  const now = new Date();
  let updated = 0;
  for (const r of rows ?? []) {
    const next = classifyFreshness(r.last_ingested_at as string | null, now);
    if (next !== r.freshness_status) {
      const { error: uErr } = await supabase
        .from("ingested_content_items")
        .update({ freshness_status: next })
        .eq("id", r.id);
      if (!uErr) updated += 1;
    }
  }
  return { updated };
}