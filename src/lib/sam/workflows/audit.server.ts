// Workflow audit. Piggybacks on the existing sam_invocations table via the
// service-role client (like SAM chat audit) so every run has a persistent
// trail without a new migration. Hidden reasoning is never stored.

import type { WorkflowAuditMetadata } from "./types";
import { WORKFLOW_AUDIT_VERSION } from "@/lib/constants";

export async function writeWorkflowAudit(meta: WorkflowAuditMetadata): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const scope = {
    ventureId: meta.ventureId,
    periodStart: meta.periodStart,
    periodEnd: meta.periodEnd,
    workflowType: meta.workflowType,
    trigger: meta.trigger,
  };

  await supabaseAdmin.from("sam_invocations").insert({
    organization_id: meta.orgId,
    actor_user_id: meta.userId,
    conversation_id: null as never,
    message_id: null,
    intent: "workflow",
    surface: "workflow_runner",
    scope: scope as never,
    prompt_version: meta.promptVersion,
    constitution_version: meta.constitutionVersion,
    pipeline_version: meta.workflowVersion,
    strategy: "workflow",
    confidence_method: `workflow.${meta.confidenceVersion}`,
    weights_version: meta.confidenceVersion,
    finished_at: new Date().toISOString(),
    status: meta.success ? "ok" : "error",
    error_code: meta.failureCode,
    rollup_confidence: null,
    rollup_confidence_band: null,
    citation_count: meta.citationCount,
    context_counts: meta.countsBeforeTruncation as never,
    truncations: meta.truncations,
    memory_considered_ids: meta.memoryConsideredIds,
    memory_selected_ids: meta.memorySelectedIds,
    memory_excluded_ids: [],
    conflict_count: 0,
    precedence_version: WORKFLOW_AUDIT_VERSION,
    memory_framework_version: WORKFLOW_AUDIT_VERSION,
    confidence_framework_version: meta.confidenceVersion,
  } as never);
}