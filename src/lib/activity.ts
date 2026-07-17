import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Json = Database["public"]["Tables"]["activity_events"]["Insert"]["metadata"];

export type ActivityInput = {
  organizationId: string;
  action: string;
  summary?: string;
  entityType?: string;
  entityId?: string;
  ventureId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Fire-and-forget activity logger. Never blocks the caller's mutation.
 * Silently swallows errors — activity logging is a nice-to-have, not
 * a hard dependency of the underlying mutation.
 */
export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    await supabase.from("activity_events").insert({
      organization_id: input.organizationId,
      actor_user_id: userRes.user?.id ?? null,
      action: input.action,
      summary: input.summary ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      venture_id: input.ventureId ?? null,
      metadata: (input.metadata as Json) ?? null,
    });
  } catch {
    /* swallow */
  }
}