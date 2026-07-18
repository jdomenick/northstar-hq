// SAM pipeline orchestrator. Runs the deterministic stages defined in
// docs/sam/01-pipeline.md around a single provider call.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildContext, serializeContext, type AssembledContext } from "./context-builder.server";
import { classifyIntent, type SamIntent } from "./intent";
import { selectProvider } from "./providers/registry.server";
import { buildSystemPrompt, PROMPT_VERSION } from "./constitution";
import { getCompanyConstitution } from "./company-constitution.server";
import { SamResponseSchema, type SamResponse } from "./schema";
import { computeConfidence, type ConfidenceObject } from "./confidence";
import { verifyCitations, citationHref } from "./citations";
import { writeAudit } from "./audit.server";
import { SamError, toSamError } from "@/lib/errors";
import { LIMITS } from "@/lib/constants";

export interface RunPipelineInput {
  orgId: string;
  userId: string;
  conversationId: string;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  ventureId?: string | null;
  settings: {
    response_style: "concise" | "balanced" | "detailed";
    challenge_level: "supportive" | "balanced" | "direct";
    include_founder_memory?: boolean;
    include_org_memory?: boolean;
    include_venture_memory?: boolean;
  };
}

export interface PipelineResult {
  response: SamResponse;
  confidence: ConfidenceObject;
  intent: SamIntent;
  context: AssembledContext;
  provider: { id: string; modelId: string };
  usage: { inputTokens?: number; outputTokens?: number; latencyMs: number };
  hrefs: Record<string, string | null>;
}

export async function runPipeline(
  supabase: SupabaseClient<Database>,
  input: RunPipelineInput,
): Promise<PipelineResult> {
  // 1. Intent
  const intent = classifyIntent(input.message);

  // 2-6. Context assembly (bounded, RLS-scoped)
  let context: AssembledContext;
  try {
    context = await buildContext(supabase, input.orgId, {
      intent,
      ventureId: input.ventureId ?? null,
      userId: input.userId,
      memoryToggles: {
        founder: input.settings.include_founder_memory ?? true,
        org: input.settings.include_org_memory ?? true,
        venture: input.settings.include_venture_memory ?? true,
      },
    });
  } catch (e) {
    throw new SamError("context_assembly_failed", (e as Error).message);
  }

  // 7. Reasoning  -  single-pass structured call through PAL
  const provider = selectProvider(intent);
  const meta = provider.getModelMetadata();

  const companyConstitution = await getCompanyConstitution(input.orgId);
  const system = buildSystemPrompt({
    orgName: context.org?.name ?? "your organization",
    founderName: context.founder?.preferred_name ?? context.founder?.full_name ?? null,
    responseStyle: input.settings.response_style,
    challengeLevel: input.settings.challenge_level,
    companyConstitution,
  });

  const contextBlock = serializeContext(context);
  const trimmedHistory = input.history.slice(-LIMITS.sam.maxHistoryMessages);
  const messages = [
    ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user" as const,
      content: [
        `INTENT: ${intent}`,
        contextBlock,
        "",
        "USER QUESTION:",
        input.message,
      ].join("\n"),
    },
  ];

  let providerResult;
  try {
    providerResult = await provider.generateStructuredResponse<SamResponse>({
      promptVersion: PROMPT_VERSION,
      system,
      messages,
      responseSchema: SamResponseSchema,
      metadata: { orgId: input.orgId, intent },
      maxOutputTokens: 2048,
    });
  } catch (e) {
    throw toSamError(e);
  }

  // 8. Validate structured response
  const parsed = SamResponseSchema.safeParse(providerResult.content);
  if (!parsed.success) {
    throw new SamError("invalid_structured_response");
  }
  const response = parsed.data;

  // 9-10. Citation verification (RLS-backed) + href resolution
  const verifiedCitations = verifyCitations(response, context);
  response.citations = verifiedCitations;
  const hrefs: Record<string, string | null> = {};
  for (const c of verifiedCitations) {
    hrefs[`${c.entity_type}:${c.entity_id}`] = citationHref(c.entity_type, c.entity_id);
  }

  // 11. Deterministic confidence  -  Northstar owns the score
  const confidence = computeConfidence(response, context);

  return {
    response,
    confidence,
    intent,
    context,
    provider: { id: meta.providerId, modelId: meta.modelId },
    usage: providerResult.usage,
    hrefs,
  };
}

// Convenience audit wrapper  -  pipeline callers hand us the message id after
// persistence so the invocation row can link back.
export { writeAudit };