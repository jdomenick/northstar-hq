// Narrow, non-arbitrary graph server fns. There is intentionally no raw
// query endpoint  -  clients cannot ask for arbitrary traversals.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SamError } from "@/lib/errors";
import { getEntityNeighbors, getVentureGraph } from "./projection.server";
import {
  getRelatedEntities as traverseRelated,
  getUpstreamDependencies as traverseUpstream,
  getDownstreamImpact as traverseDownstream,
} from "./traversal.server";
import { SAM_GRAPH_LIMITS } from "@/lib/constants";

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

const TraversalInput = z.object({
  organizationId: z.string().uuid(),
  entityType: EntityType,
  entityId: z.string().uuid(),
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(SAM_GRAPH_LIMITS.maxDepth)
    .optional(),
});

async function assertMemberOrThrow(
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>,
  orgId: string,
  userId: string,
) {
  const { data: mem } = await supabase
    .from("organization_members")
    .select("status")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem || mem.status !== "active") throw new SamError("membership_unavailable");
}

export const getRelatedEntities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TraversalInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMemberOrThrow(context.supabase, data.organizationId, context.userId);
    return traverseRelated(
      context.supabase,
      data.organizationId,
      { type: data.entityType, id: data.entityId },
      data.maxDepth ?? 2,
    );
  });

export const getUpstreamDependencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TraversalInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMemberOrThrow(context.supabase, data.organizationId, context.userId);
    return traverseUpstream(
      context.supabase,
      data.organizationId,
      { type: data.entityType, id: data.entityId },
      data.maxDepth ?? SAM_GRAPH_LIMITS.maxDepth,
    );
  });

export const getDownstreamImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TraversalInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertMemberOrThrow(context.supabase, data.organizationId, context.userId);
    return traverseDownstream(
      context.supabase,
      data.organizationId,
      { type: data.entityType, id: data.entityId },
      data.maxDepth ?? SAM_GRAPH_LIMITS.maxDepth,
    );
  });