import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scope = z.object({
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const getClientPreviewContextFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const mod = await import("./preview.server");
    const ctx = await mod.requireClientPreviewAccess(
      context.supabase,
      data.organizationId,
      data.clientId,
      context.userId,
    );
    return { company: ctx.company, account: ctx.account };
  });

export const getClientPreviewWorkspaceFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const mod = await import("./preview.server");
    return mod.previewWorkspace(
      context.supabase,
      data.organizationId,
      data.clientId,
      context.userId,
    );
  });

export const getClientPreviewDeliveryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const mod = await import("./preview.server");
    return mod.previewDelivery(context.supabase, data.organizationId, data.clientId, context.userId);
  });

export const getClientPreviewReportFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const mod = await import("./preview.server");
    return mod.previewExecutiveReport(
      context.supabase,
      data.organizationId,
      data.clientId,
      context.userId,
    );
  });
