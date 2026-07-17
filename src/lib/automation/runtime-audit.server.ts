// Runtime audit + event writers. All go through the same
// buildAuditEntry sanitizer so no secret / raw payload leaks.
// service_role writes; never called from browser code.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { buildAuditEntry, buildEventKey } from "./audit.server";
import type { AutomationAuditEvent, AuditMetadata } from "./types";
import type { JobActorType } from "@/lib/constants";

type SB = SupabaseClient<Database>;

export interface WriteEventInput {
  organizationId: string;
  jobId: string;
  event: AutomationAuditEvent | string;
  attemptNumber?: number;
  actorType?: JobActorType;
  actorId?: string | null;
  discriminator?: string;
  metadata?: AuditMetadata;
}

// Writes a sanitized job event; unique on (job_id, event_type, event_key)
// so runner retries idempotently upsert-collapse.
export async function writeJobEvent(supabase: SB, input: WriteEventInput): Promise<void> {
  const eventKey = buildEventKey({
    jobId: input.jobId,
    event: input.event as AutomationAuditEvent,
    attemptNumber: input.attemptNumber,
    discriminator: input.discriminator,
  });
  const entry = buildAuditEntry(input.event as AutomationAuditEvent, input.metadata ?? {});
  await supabase.from("automation_job_events").insert({
    organization_id: input.organizationId,
    job_id: input.jobId,
    event_type: entry.event,
    event_key: eventKey,
    actor_type: input.actorType ?? "worker",
    actor_id: input.actorId ?? null,
    metadata: entry.metadata as unknown as Json,
  });
}
