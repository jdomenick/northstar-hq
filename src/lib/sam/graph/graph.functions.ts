// Narrow, non-arbitrary graph server fns. There is intentionally no raw
// query endpoint — clients cannot ask for arbitrary traversals.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SamError } from "@/lib/errors";
import { getEntityNeighbors, getVentureGraph } from "./projection.server";

const EntityType = z.enum([
  "venture",
  "project",
  "task",
  "goal",
  "decision",
  "commitment",
  "knowledge",
  "document",
  "memory",
]);

export const getNeighbors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        entityType: EntityType,
        entityId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("organization_members")
      .select("status")
      .eq("organization_id", data.organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem || mem.status !== "active") throw new SamError("membership_unavailable");
    return getEntityNeighbors(supabase, data.organizationId, {
      type: data.entityType,
      id: data.entityId,
    });
  });

export const getVentureGraphFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid(), ventureId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("organization_members")
      .select("status")
      .eq("organization_id", data.organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem || mem.status !== "active") throw new SamError("membership_unavailable");
    return getVentureGraph(supabase, data.organizationId, data.ventureId);
  });