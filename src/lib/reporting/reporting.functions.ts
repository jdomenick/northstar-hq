import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { METRIC_UNITS } from "./types";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);

/* --------------------------------- client -------------------------------- */

export const getClientExecutiveReportFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mod = await import("./reporting.server");
    return mod.loadClientExecutiveReport(context.supabase, context.userId);
  });

/* -------------------------------- operator ------------------------------- */

export const getOperatorExecutiveReportFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: uuid, clientId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const mod = await import("./reporting.server");
    return mod.loadOperatorExecutiveReport(
      context.supabase,
      data.organizationId,
      data.clientId,
      context.userId,
    );
  });

export const publishExecutiveReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        clientId: uuid,
        summary: text(4000),
        businessNotes: text(4000),
        highlights: z.array(text(240).min(1)).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./reporting.server");
    const { organizationId, ...rest } = data;
    return mod.publishExecutiveReport(context.supabase, organizationId, context.userId, rest);
  });

export const upsertOutcomeMetricFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        clientId: uuid,
        metricKey: z
          .string()
          .trim()
          .min(2)
          .max(60)
          .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores."),
        label: text(80).min(2),
        value: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
        unit: z.enum(METRIC_UNITS),
        periodStart: z.string().date().nullable(),
        periodEnd: z.string().date().nullable(),
        sourceLabel: text(160),
        clientVisible: z.boolean(),
        sortOrder: z.number().int().min(0).max(999),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./reporting.server");
    const { organizationId, ...rest } = data;
    await mod.upsertOutcomeMetric(context.supabase, organizationId, context.userId, rest);
    return { ok: true as const };
  });

export const deleteOutcomeMetricFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: uuid, metricId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const mod = await import("./reporting.server");
    await mod.deleteOutcomeMetric(
      context.supabase,
      data.organizationId,
      context.userId,
      data.metricId,
    );
    return { ok: true as const };
  });