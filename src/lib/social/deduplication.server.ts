// Deterministic duplicate prevention. Provider opinion never replaces this.

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SOCIAL_LIMITS } from "@/lib/constants";
import type { SocialRepostPolicy } from "./publishing.types";
import { DEFAULT_REPOST_POLICY } from "./publishing.types";

type SB = SupabaseClient<Database>;

function normalizeText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\s\p{P}]+/gu, " ")
    .trim();
}

export interface DuplicateFingerprintInput {
  organizationId: string;
  ventureId: string;
  socialAccountId?: string | null;
  campaignId?: string | null;
  platform: string;
  title?: string | null;
  body: string;
  firstComment?: string | null;
  hashtags?: string[];
  linkUrl?: string | null;
  mediaHashes?: string[];
  scheduledWindowStart?: string | null;
}

export function buildDuplicateFingerprint(input: DuplicateFingerprintInput): string {
  const hashtags = (input.hashtags ?? []).map((h) => h.trim().toLowerCase()).sort().join(",");
  const media = (input.mediaHashes ?? []).slice().sort().join(",");
  const bucket = input.scheduledWindowStart
    ? new Date(input.scheduledWindowStart).toISOString().slice(0, 13)
    : "-";
  const payload = [
    input.organizationId, input.ventureId, input.platform,
    input.socialAccountId ?? "-", input.campaignId ?? "-",
    normalizeText(input.title), normalizeText(input.body),
    normalizeText(input.firstComment), hashtags,
    (input.linkUrl ?? "").trim().toLowerCase(), media, bucket,
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export interface DuplicateResult {
  exactMatch: boolean;
  nearMatch: boolean;
  matchedContentItemIds: string[];
  lookbackDays: number;
}

export async function findExactDuplicate(
  supabase: SB, organizationId: string, fingerprint: string, excludeContentItemId?: string,
): Promise<string | null> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SOCIAL_LIMITS.duplicateLookbackDays);
  let q = supabase.from("social_content_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("duplicate_fingerprint", fingerprint)
    .is("deleted_at", null)
    .gte("created_at", cutoff.toISOString())
    .not("status", "in", "(cancelled,archived)")
    .limit(1);
  if (excludeContentItemId) q = q.neq("id", excludeContentItemId);
  const { data, error } = await q;
  if (error) return null;
  return data?.[0]?.id ?? null;
}

export async function evaluateNearDuplicate(
  supabase: SB, organizationId: string,
  input: { platform: string; body: string; ventureId: string; excludeId?: string },
): Promise<string[]> {
  const key = normalizeText(input.body).slice(0, 200);
  if (key.length < 40) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SOCIAL_LIMITS.duplicateLookbackDays);
  let q = supabase.from("social_content_items")
    .select("id, body")
    .eq("organization_id", organizationId)
    .eq("venture_id", input.ventureId)
    .eq("platform", input.platform)
    .is("deleted_at", null)
    .gte("created_at", cutoff.toISOString())
    .limit(50);
  if (input.excludeId) q = q.neq("id", input.excludeId);
  const { data, error } = await q;
  if (error || !data) return [];
  const matches: string[] = [];
  for (const row of data) {
    const other = normalizeText(row.body).slice(0, 200);
    if (other === key) matches.push(row.id);
  }
  return matches;
}

export function isRepostAllowed(policy: SocialRepostPolicy = DEFAULT_REPOST_POLICY): boolean {
  return policy.allowRepost && !policy.requireExplicitApproval;
}