// Immutable schedule audit log helpers. Every scheduling mutation MUST call
// writeScheduleAudit exactly once from its server function so operators can
// reconstruct the history of any content item.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { SCHEDULER_VERSION } from "./timezone";

type SB = SupabaseClient<Database>;

export type ScheduleAuditAction =
  | "schedule_created"
  | "schedule_changed"
  | "schedule_removed"
  | "publication_canceled"
  | "publication_paused"
  | "publication_resumed"
  | "retry_requested"
  | "publish_now_requested"
  | "worker_claimed"
  | "publication_succeeded"
  | "publication_failed"
  | "emergency_pause_engaged"
  | "emergency_pause_lifted";

export interface WriteScheduleAuditInput {
  organizationId: string;
  ventureId: string;
  contentItemId?: string | null;
  automationJobId?: string | null;
  action: ScheduleAuditAction;
  actorUserId: string | null;
  actorType?: "user" | "worker" | "scheduler" | "system";
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeScheduleAudit(
  supabase: SB,
  input: WriteScheduleAuditInput,
): Promise<void> {
  await supabase.from("content_ops_schedule_audit").insert({
    organization_id: input.organizationId,
    venture_id: input.ventureId,
    content_item_id: input.contentItemId ?? null,
    automation_job_id: input.automationJobId ?? null,
    action: input.action,
    actor_user_id: input.actorUserId,
    actor_type: input.actorType ?? "user",
    old_value: (input.oldValue ?? null) as Json,
    new_value: (input.newValue ?? null) as Json,
    reason: input.reason ?? null,
    metadata: (input.metadata ?? {}) as Json,
    policy_version: SCHEDULER_VERSION,
  });
}
