import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);

const companySchema = z.object({
  legal_business_name: text(160),
  operating_name: text(160),
  primary_phone: text(40),
  primary_email: z.union([z.literal(""), z.string().trim().email().max(255)]),
  website_url: text(255),
  address_line1: text(200),
  address_line2: text(200),
  city: text(120),
  region: text(120),
  postal_code: text(30),
  country: text(120),
  service_area: text(1000),
  business_hours: text(1000),
  primary_contact_name: text(160),
  primary_contact_email: z.union([z.literal(""), z.string().trim().email().max(255)]),
  primary_contact_phone: text(40),
  billing_contact_name: text(160),
  billing_contact_email: z.union([z.literal(""), z.string().trim().email().max(255)]),
  billing_contact_phone: text(40),
  preferred_communication_method: z.enum(["email", "phone", "sms"]),
});

/* --------------------------------- client -------------------------------- */

export const getClientWorkspaceFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await import("./workspace.server");
    return ws.loadClientWorkspace(context.supabase, context.userId);
  });

export const saveClientCompanyProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companySchema.parse(d))
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    await ws.saveCompanyProfile(context.supabase, context.userId, data);
    return { ok: true as const };
  });

export const submitOnboardingItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        itemId: uuid,
        status: z.enum(["in_progress", "submitted"]),
        response: text(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    await ws.submitOnboardingItem(context.supabase, context.userId, data);
    return { ok: true as const };
  });

export const registerClientUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        documentId: uuid.nullable(),
        onboardingItemId: uuid.nullable(),
        title: text(200).min(1),
        storagePath: z.string().trim().min(1).max(500),
        fileName: text(255).min(1),
        fileSize: z.number().int().nonnegative().max(50 * 1024 * 1024),
        fileType: text(160),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    return ws.registerClientUpload(context.supabase, context.userId, data);
  });

export const getClientDocumentUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    return { url: await ws.createDocumentDownloadUrl(context.supabase, context.userId, data.documentId) };
  });

/* -------------------------------- operator ------------------------------- */

const orgClient = z.object({ organizationId: uuid, clientId: uuid });

export const getOperatorClientWorkspaceFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgClient.parse(d))
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    return ws.loadOperatorWorkspace(
      context.supabase,
      data.organizationId,
      data.clientId,
      context.userId,
    );
  });

export const seedClientChecklistFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgClient.parse(d))
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    return ws.seedChecklist(context.supabase, data.organizationId, data.clientId, context.userId);
  });

export const upsertOnboardingItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        id: uuid.optional(),
        clientId: uuid,
        title: text(200).min(1),
        item_type: z.enum([
          "company_information",
          "contact_information",
          "service_area",
          "business_hours",
          "brand_assets",
          "system_access",
          "existing_software",
          "required_document",
          "approval",
          "other",
        ]),
        owner: z.enum(["client", "northstar"]),
        instructions: text(2000),
        is_required: z.boolean(),
        requires_review: z.boolean(),
        requires_document: z.boolean(),
        due_at: z.string().datetime().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    const { organizationId, ...rest } = data;
    await ws.upsertOnboardingItem(context.supabase, organizationId, context.userId, rest);
    return { ok: true as const };
  });

export const reviewOnboardingItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        itemId: uuid,
        decision: z.enum(["approved", "needs_revision", "blocked", "not_applicable"]),
        note: text(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    await ws.reviewOnboardingItem(context.supabase, data.organizationId, context.userId, {
      itemId: data.itemId,
      decision: data.decision,
      note: data.note,
    });
    return { ok: true as const };
  });

export const requestClientDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        clientId: uuid,
        title: text(200).min(1),
        instructions: text(2000),
        isRequired: z.boolean(),
        onboardingItemId: uuid.nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    const { organizationId, ...rest } = data;
    await ws.requestDocument(context.supabase, organizationId, context.userId, rest);
    return { ok: true as const };
  });

export const reviewClientDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        documentId: uuid,
        decision: z.enum(["approved", "needs_revision", "archived"]),
        note: text(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    await ws.reviewDocument(context.supabase, data.organizationId, context.userId, {
      documentId: data.documentId,
      decision: data.decision,
      note: data.note,
    });
    return { ok: true as const };
  });

export const setClientDocumentVisibilityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        documentId: uuid,
        visibility: z.enum(["internal_only", "client_visible"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    await ws.setDocumentVisibility(context.supabase, data.organizationId, context.userId, {
      documentId: data.documentId,
      visibility: data.visibility,
    });
    return { ok: true as const };
  });

export const registerOperatorUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        clientId: uuid,
        title: text(200).min(1),
        storagePath: z.string().trim().min(1).max(500),
        fileName: text(255).min(1),
        fileSize: z.number().int().nonnegative().max(50 * 1024 * 1024),
        fileType: text(160),
        visibility: z.enum(["internal_only", "client_visible"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    const { organizationId, ...rest } = data;
    await ws.registerOperatorUpload(context.supabase, organizationId, context.userId, rest);
    return { ok: true as const };
  });

export const getOperatorDocumentUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: uuid, documentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    return {
      url: await ws.createOperatorDownloadUrl(
        context.supabase,
        data.organizationId,
        context.userId,
        data.documentId,
      ),
    };
  });

export const postClientNoticeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        clientId: uuid,
        title: text(200).min(1),
        body: text(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await import("./workspace.server");
    await ws.postClientNotice(context.supabase, data.organizationId, context.userId, {
      clientId: data.clientId,
      title: data.title,
      body: data.body,
    });
    return { ok: true as const };
  });