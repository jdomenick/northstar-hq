import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { CONTENT_OPS_LIMITS } from "./constants";

export const listLearnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    ventureId: (input as { ventureId: string }).ventureId,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: rows, error } = await context.supabase
      .from("content_learnings")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .order("computed_at", { ascending: false })
      .limit(CONTENT_OPS_LIMITS.maxListPageSize);
    if (error) throw new ContentOpsError("unknown", error.message);
    return rows ?? [];
  });