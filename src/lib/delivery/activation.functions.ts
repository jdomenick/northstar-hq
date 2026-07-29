// Executive-only recovery + read surface for delivery activation.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const input = z.object({
  organization_id: z.string().uuid(),
  proposal_id: z.string().uuid(),
});

async function requireExecutive(
  supabase: SupabaseClient<Database>,
  organization_id: string,
  user_id: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_org_role", {
    _org: organization_id,
    _user: user_id,
    _min: "executive",
  });
  if (error) throw new Error("Authorization check failed");
  if (!data) throw new Error("Forbidden: executive role required");
}

/** Manual recovery. Enforces every activation condition, same as the webhook. */
export const retryDeliveryActivationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    await requireExecutive(context.supabase, data.organization_id, context.userId);
    const { activateClientDeliveryFromBilling } = await import("./activation.server");
    return activateClientDeliveryFromBilling(context.supabase, {
      proposal_id: data.proposal_id,
      organization_id: data.organization_id,
      actor_id: context.userId,
    });
  });

/** Delivery project linked to a proposal, if activation already happened. */
export const getDeliveryProjectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("projects")
      .select("id, name, status, start_date, created_source, client_id")
      .eq("organization_id", data.organization_id)
      .eq("proposal_id", data.proposal_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return { project: project ?? null };
  });
