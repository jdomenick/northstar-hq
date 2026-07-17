import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LIMITS } from "@/lib/constants";
import { SamError, toSamError, SAM_ERROR_MESSAGES } from "@/lib/errors";

const AskInput = z.object({
  conversationId: z.string().uuid().nullable(),
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid().nullable().optional(),
  message: z.string(),
  title: z.string().optional(),
});

function sanitizeError(e: unknown) {
  const sam = toSamError(e);
  return { code: sam.code, message: SAM_ERROR_MESSAGES[sam.code] };
}

// ---------------------------------------------------------------------------
// askSam — the primary read-only SAM entrypoint.
// ---------------------------------------------------------------------------
export const askSam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!data.message || !data.message.trim()) {
      throw new SamError("message_empty");
    }
    if (data.message.length > LIMITS.sam.maxMessageChars) {
      throw new SamError("message_too_long");
    }

    // 1. Membership verification — client cannot forge the org id.
    const { data: mem, error: memErr } = await supabase
      .from("organization_members")
      .select("role, status")
      .eq("organization_id", data.organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr || !mem || mem.status !== "active") {
      throw new SamError("membership_unavailable");
    }

    // 2. Rate limit (daily authoritative counter).
    const today = new Date().toISOString().slice(0, 10);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: counter } = await supabaseAdmin
      .from("sam_rate_counters")
      .select("count")
      .eq("organization_id", data.organizationId)
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle();
    if (counter && counter.count >= LIMITS.sam.perUserPerDay) {
      throw new SamError("rate_limit_exceeded");
    }

    // 3. Ensure conversation exists in this org.
    let conversationId = data.conversationId;
    if (conversationId) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, organization_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv || conv.organization_id !== data.organizationId) {
        throw new SamError("conversation_not_found");
      }
    } else {
      const title =
        data.title?.slice(0, 80) ||
        data.message.slice(0, 60).replace(/\s+/g, " ").trim() ||
        "New SAM conversation";
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          organization_id: data.organizationId,
          venture_id: data.ventureId ?? null,
          created_by: userId,
          title,
          conversation_type: "sam",
        })
        .select("id")
        .single();
      if (convErr || !newConv) throw new SamError("conversation_not_found", convErr?.message);
      conversationId = newConv.id;
    }

    // 4. Load recent conversation history for context (RLS-scoped).
    const { data: historyRows } = await supabase
      .from("conversation_messages")
      .select("role, content, status")
      .eq("conversation_id", conversationId)
      .eq("status", "complete")
      .order("created_at", { ascending: true })
      .limit(LIMITS.sam.maxHistoryMessages);
    const history = (historyRows ?? [])
      .filter((r) => r.role === "user" || r.role === "operator")
      .map((r) => ({
        role: (r.role === "operator" ? "assistant" : "user") as "user" | "assistant",
        content: r.content,
      }));

    // 5. Persist the user message immediately.
    const { data: userMsg, error: userMsgErr } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: conversationId,
        organization_id: data.organizationId,
        role: "user",
        content: data.message,
        created_by: userId,
        status: "complete",
      })
      .select("id")
      .single();
    if (userMsgErr || !userMsg) {
      throw new SamError("unknown_error", userMsgErr?.message);
    }

    // 6. Load SAM settings (fall back to defaults).
    const { data: settingsRow } = await supabase
      .from("sam_settings")
      .select("enabled, response_style, challenge_level, include_citations, show_confidence, allow_memory_proposals, include_founder_memory, include_org_memory, include_venture_memory")
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (settingsRow && settingsRow.enabled === false) {
      throw new SamError("sam_disabled");
    }
    const settings = {
      response_style: (settingsRow?.response_style ?? "balanced") as
        | "concise"
        | "balanced"
        | "detailed",
      challenge_level: (settingsRow?.challenge_level ?? "balanced") as
        | "supportive"
        | "balanced"
        | "direct",
      include_founder_memory: settingsRow?.include_founder_memory ?? true,
      include_org_memory: settingsRow?.include_org_memory ?? true,
      include_venture_memory: settingsRow?.include_venture_memory ?? true,
    };
    const allowMemoryProposals = settingsRow?.allow_memory_proposals ?? true;

    // 7. Run the pipeline (lazy import — server-only module graph).
    const { runPipeline, writeAudit } = await import("./pipeline.server");
    let result;
    let samMessageId: string | null = null;
    try {
      result = await runPipeline(supabase, {
        orgId: data.organizationId,
        userId,
        conversationId,
        message: data.message,
        history,
        ventureId: data.ventureId ?? null,
        settings,
      });
    } catch (e) {
      // Mark user message as failed-context anchor; do not fabricate a SAM
      // reply.
      await supabase
        .from("conversation_messages")
        .update({ status: "failed" })
        .eq("id", userMsg.id);
      const safe = sanitizeError(e);
      return {
        ok: false as const,
        conversationId,
        error: safe,
      };
    }

    // 8. Persist SAM message.
    const metadata = JSON.parse(JSON.stringify({
      intent: result.intent,
      confidence: result.confidence,
      citations: result.response.citations,
      hrefs: result.hrefs,
      response: result.response,
      provider: result.provider,
      pipeline_version: "sam.pipeline.v1.0.0",
      prompt_version: "sam.prompt.v1.0.0",
      constitution_version: "sam.constitution.v1.0.0",
      latency_ms: result.usage.latencyMs,
      input_tokens: result.usage.inputTokens ?? null,
      output_tokens: result.usage.outputTokens ?? null,
      truncations: result.context.truncations,
    }));

    const { data: samMsg, error: samMsgErr } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: conversationId,
        organization_id: data.organizationId,
        role: "operator",
        content: result.response.answer,
        created_by: userId,
        status: "complete",
        metadata,
      })
      .select("id")
      .single();
    if (samMsgErr || !samMsg) {
      throw new SamError("unknown_error", samMsgErr?.message);
    }
    samMessageId = samMsg.id;

    // 8b. Persist memory proposals (never confirmed).
    let proposalIds: string[] = [];
    if (allowMemoryProposals) {
      try {
        const { persistProposals } = await import("./memory/proposals.server");
        proposalIds = await persistProposals(supabase, {
          orgId: data.organizationId,
          userId,
          conversationId,
          messageId: userMsg.id,
          ventureId: data.ventureId ?? null,
          message: data.message,
        });
      } catch {
        // Best-effort: proposal failure never blocks the reply.
      }
    }

    // 9. Audit (delivery-blocking). Failure ⇒ throw and hide sanitized error.
    try {
      await writeAudit(supabase, {
        orgId: data.organizationId,
        userId,
        conversationId,
        messageId: samMessageId,
        intent: result.intent,
        ventureId: data.ventureId ?? null,
        context: result.context,
        confidence: result.confidence,
        citations: result.response.citations,
        providerId: result.provider.id,
        modelId: result.provider.modelId,
        latencyMs: result.usage.latencyMs,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        status: "ok",
        citationLineage: result.response.citations.map((c) => ({
          entity_type: c.entity_type,
          entity_id: c.entity_id,
          kind: c.kind,
        })),
      });
    } catch (e) {
      // Roll back the SAM message: audit is required per ADR-0008.
      await supabase.from("conversation_messages").delete().eq("id", samMessageId);
      const safe = sanitizeError(new SamError("audit_persistence_failed", (e as Error).message));
      return { ok: false as const, conversationId, error: safe };
    }

    // 10. Bump rate counter (best-effort).
    await supabaseAdmin
      .from("sam_rate_counters")
      .upsert(
        {
          organization_id: data.organizationId,
          user_id: userId,
          day: today,
          count: (counter?.count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id,day" },
      );

    return {
      ok: true as const,
      conversationId,
      messageId: samMessageId,
      response: result.response,
      confidence: result.confidence,
      citations: result.response.citations,
      hrefs: result.hrefs,
      intent: result.intent,
      provider: result.provider,
      usage: result.usage,
      truncations: result.context.truncations,
      memoryProposalIds: proposalIds,
    };
  });

// ---------------------------------------------------------------------------
// listConversations — organization-scoped SAM conversations.
// ---------------------------------------------------------------------------
export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("conversations")
      .select("id, title, updated_at, venture_id, deleted_at")
      .eq("organization_id", data.organizationId)
      .eq("conversation_type", "sam")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50);
    return rows ?? [];
  });

// ---------------------------------------------------------------------------
// loadConversation — messages for one conversation.
// ---------------------------------------------------------------------------
export const loadConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ conversationId: z.string().uuid(), organizationId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: conv } = await context.supabase
      .from("conversations")
      .select("id, title, venture_id, organization_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || conv.organization_id !== data.organizationId) {
      throw new SamError("conversation_not_found");
    }
    const { data: messages } = await context.supabase
      .from("conversation_messages")
      .select("id, role, content, status, metadata, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    return { conversation: conv, messages: messages ?? [] };
  });

// ---------------------------------------------------------------------------
// renameConversation
// ---------------------------------------------------------------------------
export const renameConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        organizationId: z.string().uuid(),
        title: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversations")
      .update({ title: data.title })
      .eq("id", data.conversationId)
      .eq("organization_id", data.organizationId);
    if (error) throw new SamError("unknown_error", error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// archiveConversation (soft delete)
// ---------------------------------------------------------------------------
export const archiveConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ conversationId: z.string().uuid(), organizationId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.conversationId)
      .eq("organization_id", data.organizationId);
    if (error) throw new SamError("unknown_error", error.message);
    return { ok: true };
  });