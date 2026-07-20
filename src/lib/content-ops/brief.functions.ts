// Content Operations items surfaced on The Brief.
//
// One server function returns a flat, capped, deduplicated list of typed
// brief items derived from real DB state (approval queue, scheduled today,
// paused ventures, blocked connectors, learnings). The client renders it
// unchanged - the server owns dedupe, ordering, and RLS.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const CONTENT_OPS_BRIEF_KINDS = [
  "awaiting_approval",
  "scheduled_today",
  "publication_failed",
  "venture_paused",
  "blocked_connector",
  "high_confidence_learning",
] as const;
export type ContentOpsBriefKind = (typeof CONTENT_OPS_BRIEF_KINDS)[number];

export interface ContentOpsBriefItem {
  kind: ContentOpsBriefKind;
  id: string;
  ventureId: string | null;
  title: string;
  detail: string;
  href: string;
  priority: number; // 0 (low) - 100 (highest)
  timestamp: string | null;
}

/** Pure dedupe used by tests. Keeps the highest-priority entry per (kind,id). */
export function dedupeBriefItems(items: ContentOpsBriefItem[], maxPerKind = 5): ContentOpsBriefItem[] {
  const seen = new Map<string, ContentOpsBriefItem>();
  for (const it of items) {
    const key = `${it.kind}:${it.id}`;
    const prev = seen.get(key);
    if (!prev || it.priority > prev.priority) seen.set(key, it);
  }
  const perKind = new Map<ContentOpsBriefKind, ContentOpsBriefItem[]>();
  for (const it of Array.from(seen.values()).sort((a, b) => b.priority - a.priority)) {
    const arr = perKind.get(it.kind) ?? [];
    if (arr.length < maxPerKind) arr.push(it);
    perKind.set(it.kind, arr);
  }
  return Array.from(perKind.values()).flat().sort((a, b) => b.priority - a.priority);
}

const Input = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid().nullable().optional(),
});

export const listContentOpsBriefItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const orgId = data.organizationId;
    const ventureId = data.ventureId ?? null;

    const now = new Date();
    const dayEnd = new Date(now); dayEnd.setUTCHours(23, 59, 59, 999);

    // Approval queue.
    let approvalQ = supabase
      .from("social_content_items")
      .select("id, venture_id, platform, title, hook, updated_at")
      .eq("organization_id", orgId)
      .in("approval_status", ["pending", "awaiting_review", "in_review"])
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (ventureId) approvalQ = approvalQ.eq("venture_id", ventureId);

    // Scheduled today.
    let scheduledQ = supabase
      .from("social_content_items")
      .select("id, venture_id, platform, title, scheduled_for, status")
      .eq("organization_id", orgId)
      .in("status", ["scheduled", "queued", "publishing"])
      .gte("scheduled_for", now.toISOString())
      .lt("scheduled_for", dayEnd.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(20);
    if (ventureId) scheduledQ = scheduledQ.eq("venture_id", ventureId);

    // Failed publications.
    let failedQ = supabase
      .from("social_content_items")
      .select("id, venture_id, platform, title, updated_at")
      .eq("organization_id", orgId)
      .eq("status", "publish_failed")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(10);
    if (ventureId) failedQ = failedQ.eq("venture_id", ventureId);

    // Paused ventures.
    let pausedQ = supabase
      .from("venture_social_settings")
      .select("venture_id, paused, publishing_enabled, updated_at")
      .eq("organization_id", orgId)
      .or("paused.eq.true,publishing_enabled.eq.false")
      .limit(20);
    if (ventureId) pausedQ = pausedQ.eq("venture_id", ventureId);

    // High-confidence learnings.
    let learningQ = supabase
      .from("content_learnings")
      .select("id, venture_id, observed_metric, confidence, sample_size, recommendation, valid_from")
      .eq("organization_id", orgId)
      .is("superseded_by", null)
      .gte("confidence", 0.7)
      .gte("sample_size", 5)
      .order("confidence", { ascending: false, nullsFirst: false })
      .limit(10);
    if (ventureId) learningQ = learningQ.eq("venture_id", ventureId);

    const [approval, scheduled, failed, paused, learning] = await Promise.all([
      approvalQ, scheduledQ, failedQ, pausedQ, learningQ,
    ]);

    const items: ContentOpsBriefItem[] = [];
    for (const r of approval.data ?? []) {
      items.push({
        kind: "awaiting_approval",
        id: r.id, ventureId: r.venture_id,
        title: r.title ?? r.hook ?? "Untitled variant",
        detail: `${r.platform} - awaiting approval`,
        href: `/content-ops/editor/${r.id}`,
        priority: 80, timestamp: r.updated_at,
      });
    }
    for (const r of scheduled.data ?? []) {
      items.push({
        kind: "scheduled_today",
        id: r.id, ventureId: r.venture_id,
        title: r.title ?? "Scheduled post",
        detail: `${r.platform} - ${r.status}`,
        href: `/content-ops/editor/${r.id}`,
        priority: 60, timestamp: r.scheduled_for,
      });
    }
    for (const r of failed.data ?? []) {
      items.push({
        kind: "publication_failed",
        id: r.id, ventureId: r.venture_id,
        title: r.title ?? "Publish failed",
        detail: `${r.platform} - publication failed`,
        href: `/content-ops/editor/${r.id}`,
        priority: 95, timestamp: r.updated_at,
      });
    }
    for (const r of paused.data ?? []) {
      items.push({
        kind: "venture_paused",
        id: r.venture_id, ventureId: r.venture_id,
        title: "Social publishing paused",
        detail: r.paused ? "Emergency pause active" : "Publishing disabled",
        href: "/sam/content",
        priority: 90, timestamp: r.updated_at,
      });
    }
    for (const r of learning.data ?? []) {
      items.push({
        kind: "high_confidence_learning",
        id: r.id, ventureId: r.venture_id,
        title: r.recommendation ?? `Learning: ${r.observed_metric}`,
        detail: `confidence ${(r.confidence ?? 0).toFixed(2)}, n=${r.sample_size}`,
        href: "/sam/content",
        priority: 40, timestamp: r.valid_from,
      });
    }

    return { items: dedupeBriefItems(items, 5) };
  });