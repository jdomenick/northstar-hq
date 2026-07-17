// The nine deterministic pre-publish gates for Content Operations.
//
// These gates are enforced BEFORE any provider adapter is contacted. Each
// returns a plain result so the caller (job handler or dry-run tool) can
// record exactly which gate rejected the item.
//
// Gates:
//   1. autonomy_ok        - venture autonomy not emergency-paused; platform not paused
//   2. kill_switch_ok     - no active org/platform/venture kill switch
//   3. approval_ok        - content approval_status='approved' and matches current content_version
//   4. duplicate_ok       - no other row shares duplicate_fingerprint (excluding this row)
//   5. idempotency_ok     - item has no external_post_id yet and status not already 'published'
//   6. credentials_ok     - provider credentials valid + publication identity matches
//   7. content_bounds_ok  - platform-specific size limits respected
//   8. schedule_ok        - either scheduled_for in past or explicit manual trigger
//   9. armed_ok           - platform publish path is armed (env flag)
//
// A single failing gate short-circuits publishing. Order is stable so
// operators can reason about which gate fired first.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { findExactDuplicate } from "@/lib/social/deduplication.server";
import {
  checkApproval,
  checkContentBounds,
  checkIdempotency,
  checkSchedule,
  PUBLISH_GATES_VERSION as PURE_VERSION,
  type PublishGateCode as PureGateCode,
  type PublishGateFailure as PureGateFailure,
} from "./publish-gates-pure";

export { checkApproval, checkContentBounds, checkIdempotency, checkSchedule };

type SB = SupabaseClient<Database>;

export type PublishGateCode = PureGateCode;
export type PublishGateFailure = PureGateFailure;

export interface PublishGateOutcome {
  ok: boolean;
  failure?: PublishGateFailure;
  passed: PublishGateCode[];
}

export interface ContentItemForPublish {
  id: string;
  organization_id: string;
  venture_id: string;
  platform: string;
  status: string;
  approval_status: string;
  approved_content_version: number | null;
  content_version: number;
  external_post_id: string | null;
  duplicate_fingerprint: string;
  scheduled_for: string | null;
  body: string;
  newsletter_subject: string | null;
}

export interface PublishGateInput {
  supabase: SB;
  item: ContentItemForPublish;
  trigger: "scheduled" | "manual";
  now?: Date;
}

function fail(gate: PublishGateCode, reason: string, details?: Record<string, unknown>): PublishGateOutcome {
  return { ok: false, failure: { gate, reason, details }, passed: [] };
}

function pass(passed: PublishGateCode[]): PublishGateOutcome {
  return { ok: true, passed };
}

// Pure checks moved to ./publish-gates-pure. Re-exported above.

export async function evaluatePublishGates(input: PublishGateInput): Promise<PublishGateOutcome> {
  const { supabase, item, trigger, now = new Date() } = input;
  const passed: PublishGateCode[] = [];

  const { data: autonomy, error: autErr } = await supabase
    .from("content_ops_autonomy")
    .select("mode, emergency_pause, platform_pauses")
    .eq("organization_id", item.organization_id)
    .eq("venture_id", item.venture_id)
    .maybeSingle();
  if (autErr) return fail("autonomy_ok", `read_error: ${autErr.message}`);
  if (!autonomy) return fail("autonomy_ok", "autonomy_row_missing");
  if (autonomy.emergency_pause) return fail("autonomy_ok", "emergency_pause_active");
  const platformPauses = (autonomy.platform_pauses ?? {}) as Record<string, boolean>;
  if (platformPauses[item.platform] === true) return fail("autonomy_ok", "platform_paused");
  passed.push("autonomy_ok");

  const { data: switches, error: swErr } = await supabase
    .from("content_ops_kill_switches")
    .select("scope, scope_ref, venture_id, active")
    .eq("organization_id", item.organization_id)
    .eq("active", true);
  if (swErr) return fail("kill_switch_ok", `read_error: ${swErr.message}`);
  for (const s of switches ?? []) {
    if (s.scope === "organization") return fail("kill_switch_ok", "org_kill_switch_active");
    if (s.scope === "platform" && s.scope_ref === item.platform)
      return fail("kill_switch_ok", "platform_kill_switch_active", { platform: item.platform });
    if (s.scope === "venture" && s.venture_id === item.venture_id)
      return fail("kill_switch_ok", "venture_kill_switch_active");
  }
  passed.push("kill_switch_ok");

  const approvalFail = checkApproval(item);
  if (approvalFail) return { ok: false, failure: approvalFail, passed };
  passed.push("approval_ok");

  const dup = await findExactDuplicate(supabase, item.organization_id, item.duplicate_fingerprint, item.id);
  if (dup)
    return {
      ok: false,
      failure: {
        gate: "duplicate_ok",
        reason: "duplicate_content_exists",
        details: { matchedContentItemId: dup },
      },
      passed,
    };
  passed.push("duplicate_ok");

  const idemFail = checkIdempotency(item);
  if (idemFail) return { ok: false, failure: idemFail, passed };
  passed.push("idempotency_ok");

  if (item.platform === "beehiiv") {
    const { validateBeehiivCredentials } = await import("@/lib/social/providers/beehiiv");
    const v = await validateBeehiivCredentials();
    if (!v.configured || !v.reachable) {
      return { ok: false, failure: { gate: "credentials_ok", reason: v.message }, passed };
    }
    passed.push("credentials_ok");
  } else {
    return {
      ok: false,
      failure: { gate: "credentials_ok", reason: `platform_not_supported_in_6a:${item.platform}` },
      passed,
    };
  }

  const boundsFail = checkContentBounds(item);
  if (boundsFail) return { ok: false, failure: boundsFail, passed };
  passed.push("content_bounds_ok");

  const schedFail = checkSchedule(item, trigger, now);
  if (schedFail) return { ok: false, failure: schedFail, passed };
  passed.push("schedule_ok");

  if (process.env.BEEHIIV_PUBLISH_ARMED !== "true") {
    return { ok: false, failure: { gate: "armed_ok", reason: "publish_disarmed" }, passed };
  }
  passed.push("armed_ok");

  return pass(passed);
}

export const PUBLISH_GATES_VERSION = PURE_VERSION;