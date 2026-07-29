import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listClientIdentityFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), clientId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ops = await import("./operations.server");
    await ops.requireOrgAdmin(context.supabase, data.organizationId, context.userId);
    return ops.loadClientIdentity(context.supabase, data.organizationId, data.clientId);
  });

export const inviteClientUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        clientId: z.string().uuid(),
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(255),
        role: z.enum(["client_admin", "client_user"]),
        origin: z.string().url().max(255),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ops = await import("./operations.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ops.requireOrgAdmin(context.supabase, data.organizationId, context.userId);
    return ops.createInvitation(context.supabase, supabaseAdmin, context.userId, data);
  });

export const resendClientInvitationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        invitationId: z.string().uuid(),
        origin: z.string().url().max(255),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ops = await import("./operations.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ops.requireOrgAdmin(context.supabase, data.organizationId, context.userId);
    return ops.resendInvitation(
      context.supabase,
      supabaseAdmin,
      context.userId,
      data.invitationId,
      data.origin,
    );
  });

export const revokeClientInvitationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), invitationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ops = await import("./operations.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ops.requireOrgAdmin(context.supabase, data.organizationId, context.userId);
    await ops.revokeInvitation(context.supabase, supabaseAdmin, context.userId, data.invitationId);
    return { ok: true as const };
  });

export const setClientAccountStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        accountId: z.string().uuid(),
        status: z.enum(["active", "deactivated"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ops = await import("./operations.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ops.requireOrgAdmin(context.supabase, data.organizationId, context.userId);
    await ops.setAccountStatus(
      context.supabase,
      supabaseAdmin,
      context.userId,
      data.accountId,
      data.status,
    );
    return { ok: true as const };
  });

export const removeClientAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), accountId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ops = await import("./operations.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ops.requireOrgAdmin(context.supabase, data.organizationId, context.userId);
    await ops.removeAccount(context.supabase, supabaseAdmin, context.userId, data.accountId);
    return { ok: true as const };
  });

/* ------------------------------- client self ---------------------------- */

export const getMyClientContextFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ops = await import("./operations.server");
    return ops.loadClientContext(context.supabase, context.userId);
  });

export const updateMyClientProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        first_name: z.string().trim().min(1).max(80),
        last_name: z.string().trim().min(1).max(80),
        phone: z.string().trim().max(40).nullable(),
        preferred_contact_method: z.enum(["email", "phone", "sms"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ops = await import("./operations.server");
    await ops.updateOwnProfile(context.supabase, context.userId, data);
    return { ok: true as const };
  });

export const recordClientSessionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ event: z.enum(["client_login", "client_logout"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ops = await import("./operations.server");
    await ops.recordSessionEvent(context.supabase, context.userId, data.event);
    return { ok: true as const };
  });