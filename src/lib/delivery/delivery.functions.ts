import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DELIVERY_STAGES, MILESTONE_STATUSES } from "./client-delivery";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);

/* --------------------------------- client -------------------------------- */

export const getClientDeliveryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mod = await import("./client-delivery.server");
    return mod.loadClientDelivery(context.supabase, context.userId);
  });

export const getDeliverableUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const mod = await import("./client-delivery.server");
    return {
      url: await mod.createDeliverableDownloadUrl(context.supabase, context.userId, data.documentId),
    };
  });

export const decideDeliverableFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        documentId: uuid,
        decision: z.enum(["approved", "revision_requested"]),
        reason: text(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./client-delivery.server");
    return mod.decideDeliverable(context.supabase, context.userId, data);
  });

/* -------------------------------- operator ------------------------------- */

export const getOperatorDeliveryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: uuid, clientId: uuid }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./client-delivery.server");
    return mod.loadOperatorDelivery(
      context.supabase,
      data.organizationId,
      data.clientId,
      context.userId,
    );
  });

export const saveDeliveryVisibilityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        projectId: uuid,
        clientId: uuid,
        client_visible: z.boolean(),
        client_title: text(200),
        client_summary: text(2000),
        client_stage: z.enum(DELIVERY_STAGES),
        client_stage_label: text(80),
        client_next_action: text(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./client-delivery.server");
    const { organizationId, ...rest } = data;
    await mod.saveDeliveryVisibility(context.supabase, organizationId, context.userId, rest);
    return { ok: true as const };
  });

export const upsertMilestoneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        id: uuid.optional(),
        projectId: uuid,
        clientId: uuid,
        title: text(200).min(1),
        description: text(2000),
        status: z.enum(MILESTONE_STATUSES),
        target_date: z.string().date().nullable(),
        requires_client_action: z.boolean(),
        client_visible: z.boolean(),
        sort_order: z.number().int().min(0).max(999),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./client-delivery.server");
    const { organizationId, ...rest } = data;
    await mod.upsertMilestone(context.supabase, organizationId, context.userId, rest);
    return { ok: true as const };
  });

export const deleteMilestoneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: uuid, milestoneId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const mod = await import("./client-delivery.server");
    await mod.deleteMilestone(context.supabase, data.organizationId, context.userId, data.milestoneId);
    return { ok: true as const };
  });

export const shareDeliverableFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        documentId: uuid,
        clientId: uuid,
        projectId: uuid,
        milestoneId: uuid.nullable(),
        versionLabel: text(40),
        requiresClientReview: z.boolean(),
        finalize: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./client-delivery.server");
    const { organizationId, ...rest } = data;
    await mod.shareDeliverable(context.supabase, organizationId, context.userId, rest);
    return { ok: true as const };
  });