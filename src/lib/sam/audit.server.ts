import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  CONSTITUTION_VERSION,
  PIPELINE_VERSION,
  PROMPT_VERSION,
  CONFIDENCE_METHOD,
  WEIGHTS_VERSION,
} from "./constitution";
import type { AssembledContext } from "./context-builder.server";
import type { ConfidenceObject } from "./confidence";
import type { SamCitation } from "./schema";

export interface AuditWriteInput {
  orgId: string;
  userId: string;
  conversationId: string;
  messageId: string | null;
  intent: string;
  ventureId?: string | null;
  context: AssembledContext;
  confidence?: ConfidenceObject;
  citations: SamCitation[];
  providerId: string;
  modelId: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  status: "ok" | "error";
  errorCode?: string | null;
}

export async function writeAudit(
  supabase: SupabaseClient<Database>,
  input: AuditWriteInput,
): Promise<{ invocationId: string | null }> {
  // Use supabase (authenticated) client; RLS policies allow org members SELECT
  // only, but INSERT is limited to service_role. Load admin lazily inside the
  // server-fn handler graph.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const finishedAt = new Date().toISOString();

  const { data: inv, error } = await supabaseAdmin
    .from("sam_invocations")
    .insert({
      organization_id: input.orgId,
      actor_user_id: input.userId,
      conversation_id: input.conversationId,
      message_id: input.messageId,
      intent: input.intent,
      surface: "sam_chat",
      scope: { ventureId: input.ventureId ?? null },
      prompt_version: PROMPT_VERSION,
      constitution_version: CONSTITUTION_VERSION,
      pipeline_version: PIPELINE_VERSION,
      strategy: "single_pass",
      confidence_method: CONFIDENCE_METHOD,
      weights_version: WEIGHTS_VERSION,
      finished_at: finishedAt,
      status: input.status,
      rollup_confidence: input.confidence?.score ?? null,
      rollup_confidence_band: input.confidence?.band ?? null,
      citation_count: input.citations.length,
      context_counts: input.context.counts,
      truncations: input.context.truncations,
      latency_ms: input.latencyMs,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      error_code: input.errorCode ?? null,
    })
    .select("id")
    .single();

  if (error || !inv) {
    throw new Error(`Audit write failed: ${error?.message ?? "unknown"}`);
  }

  const invocationId = inv.id;

  // Context refs
  const refs: Array<{
    invocation_id: string;
    organization_id: string;
    source: string;
    entity_type: string;
    entity_id: string | null;
    role: string;
  }> = [];
  const push = (source: string, type: string, ids: string[]) => {
    for (const id of ids) {
      refs.push({
        invocation_id: invocationId,
        organization_id: input.orgId,
        source,
        entity_type: type,
        entity_id: id,
        role: "input",
      });
    }
  };
  push("graph", "venture", input.context.ventures.map((v) => v.id));
  push("graph", "project", input.context.projects.map((v) => v.id));
  push("graph", "goal", input.context.goals.map((v) => v.id));
  push("graph", "decision", input.context.decisions.map((v) => v.id));
  push("graph", "commitment", input.context.commitments.map((v) => v.id));
  push("knowledge", "knowledge_record", input.context.knowledge.map((v) => v.id));
  push("document", "document", input.context.documents.map((v) => v.id));

  if (refs.length) {
    await supabaseAdmin.from("sam_invocation_context_refs").insert(refs);
  }

  await supabaseAdmin.from("sam_invocation_provider_calls").insert({
    invocation_id: invocationId,
    organization_id: input.orgId,
    provider_id: input.providerId,
    model_id: input.modelId,
    prompt_version: PROMPT_VERSION,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    latency_ms: input.latencyMs,
    status: input.status,
    error_code: input.errorCode ?? null,
  });

  return { invocationId };
}