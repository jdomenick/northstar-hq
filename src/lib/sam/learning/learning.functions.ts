// Structured learning events. Not model training. Per-organization only.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SamError } from "@/lib/errors";
import { LEARNING_EVENT_SCHEMA_VERSION, RESPONSE_FEEDBACK_VERSION } from "@/lib/constants";

export { LEARNING_EVENT_SCHEMA_VERSION, RESPONSE_FEEDBACK_VERSION };

const EventType = z.enum([
  "recommendation_accepted",
  "recommendation_rejected",
  "recommendation_edited",
  "recommendation_ignored",
  "memory_confirmed",
  "memory_corrected",
  "memory_rejected",
  "memory_disputed",
  "memory_expired",
  "outcome_completed",
  "outcome_failed",
  "outcome_superseded",
]);

export const recordLearningEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        event_type: EventType,
        conversation_id: z.string().uuid().nullable().optional(),
        message_id: z.string().uuid().nullable().optional(),
        invocation_id: z.string().uuid().nullable().optional(),
        memory_item_id: z.string().uuid().nullable().optional(),
        original_payload: z.record(z.string(), z.unknown()).optional(),
        revised_payload: z.record(z.string(), z.unknown()).nullable().optional(),
        outcome_status: z.string().max(80).nullable().optional(),
        feedback_text: z.string().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("sam_learning_events").insert({
      organization_id: data.organizationId,
      user_id: userId,
      conversation_id: data.conversation_id ?? null,
      message_id: data.message_id ?? null,
      invocation_id: data.invocation_id ?? null,
      memory_item_id: data.memory_item_id ?? null,
      event_type: data.event_type,
      original_payload: (data.original_payload ?? {}) as never,
      revised_payload: (data.revised_payload ?? null) as never,
      outcome_status: data.outcome_status ?? null,
      feedback_text: data.feedback_text ?? null,
    });
    if (error) throw new SamError("learning_persistence_failed", error.message);
    return { ok: true };
  });

export const submitResponseFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        messageId: z.string().uuid(),
        conversationId: z.string().uuid().nullable().optional(),
        feedback_type: z.enum([
          "helpful",
          "not_helpful",
          "partially_helpful",
          "incorrect",
          "missing_context",
        ]),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("sam_response_feedback")
      .upsert(
        {
          organization_id: data.organizationId,
          message_id: data.messageId,
          conversation_id: data.conversationId ?? null,
          user_id: userId,
          feedback_type: data.feedback_type,
          note: data.note ?? null,
        },
        { onConflict: "message_id,user_id" },
      );
    if (error) throw new SamError("learning_persistence_failed", error.message);
    return { ok: true };
  });

export const listResponseFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid(), conversationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("sam_response_feedback")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("conversation_id", data.conversationId);
    return rows ?? [];
  });