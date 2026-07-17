// Audit contract for the social domain. Reuses the existing activity_events
// table. All metadata passes through a sanitizer that strips credentials,
// tokens, prompts, and raw provider data.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { SOCIAL_AUDIT_VERSION, SOCIAL_LIMITS } from "@/lib/constants";
import { SocialError } from "./errors";

type SB = SupabaseClient<Database>;

export const SOCIAL_AUDIT_EVENTS = [
  "organization_social_settings_updated",
  "publishing_master_switch_enabled",
  "publishing_master_switch_disabled",
  "emergency_stop_enabled",
  "emergency_stop_disabled",
  "venture_social_settings_updated",
  "venture_paused",
  "venture_resumed",
  "social_account_created",
  "social_account_updated",
  "account_publishing_enabled",
  "account_publishing_disabled",
  "brand_profile_created",
  "brand_profile_updated",
  "brand_profile_submitted",
  "brand_profile_approved",
  "brand_profile_activated",
  "brand_profile_superseded",
  "brand_profile_archived",
  "campaign_created",
  "campaign_updated",
  "campaign_approved",
  "campaign_activated",
  "campaign_paused",
  "campaign_resumed",
  "content_plan_created",
  "content_plan_updated",
  "content_plan_approved",
  "content_item_created",
  "content_item_updated",
  "content_version_created",
  "content_submitted_for_review",
  "content_approved",
  "content_rejected",
  "content_changes_requested",
  "content_paused",
  "content_resumed",
  "content_scheduled",
  "content_cancelled",
  "content_archived",
  "publishing_eligibility_evaluated",
  "publication_attempt_created",
  "metrics_snapshot_recorded",
] as const;
export type SocialAuditEvent = (typeof SOCIAL_AUDIT_EVENTS)[number];

const FORBIDDEN = new Set([
  "password","secret","token","access_token","refresh_token","api_key","apikey",
  "authorization","credential","credentials","cookie","provider_payload","provider_raw",
  "stack","stack_trace","reasoning","prompt","system_prompt","raw_response",
]);

function sanitize(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (FORBIDDEN.has(k.toLowerCase())) continue;
    if (v === undefined) continue;
    if (v && typeof v === "object") out[k] = sanitize(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

export interface SocialAuditParams {
  organizationId: string;
  actorId: string | null;
  event: SocialAuditEvent;
  entityType: string;
  entityId: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeSocialAudit(supabase: SB, p: SocialAuditParams): Promise<void> {
  const meta = sanitize(p.metadata);
  const encoded = JSON.stringify(meta);
  if (encoded.length > SOCIAL_LIMITS.maxAuditMetadataBytes) {
    throw new SocialError("social_payload_too_large", "audit metadata exceeds limit");
  }
  const record: Database["public"]["Tables"]["activity_events"]["Insert"] = {
    organization_id: p.organizationId,
    actor_id: p.actorId,
    action: `social.${p.event}`,
    entity_type: p.entityType,
    entity_id: p.entityId,
    metadata: { ...meta, audit_version: SOCIAL_AUDIT_VERSION } as unknown as Json,
  };
  const { error } = await supabase.from("activity_events").insert(record);
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[social-audit]", p.event, error.message);
  }
}