// Outbound webhook CRUD + test delivery.
//
// All secrets stored as ciphertext via encryptSecret. Send via signPayload
// (HMAC-SHA256 hex) in X-NorthStar-Signature header.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OrgOnly = z.object({ organizationId: z.string().uuid() });
const UpsertIn = z.object({
  organizationId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  targetUrl: z.string().url(),
  eventTypes: z.array(z.string().min(1).max(80)).default([]),
  enabled: z.boolean().default(true),
  secret: z.string().min(8).max(512).optional().nullable(),
});
const IdIn = z.object({ organizationId: z.string().uuid(), id: z.string().uuid() });

export interface WebhookRow {
  id: string;
  name: string;
  description: string | null;
  targetUrl: string;
  eventTypes: string[];
  enabled: boolean;
  hasSecret: boolean;
  lastDeliveryAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  lastErrorAt: string | null;
  createdAt: string;
}

export const listWebhooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => OrgOnly.parse(v))
  .handler(async ({ data, context }): Promise<WebhookRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("integration_webhooks")
      .select("id, name, description, target_url, event_types, enabled, secret_ciphertext, last_delivery_at, last_status_code, last_error, last_error_at, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      targetUrl: r.target_url,
      eventTypes: r.event_types ?? [],
      enabled: r.enabled,
      hasSecret: !!r.secret_ciphertext,
      lastDeliveryAt: r.last_delivery_at,
      lastStatusCode: r.last_status_code,
      lastError: r.last_error,
      lastErrorAt: r.last_error_at,
      createdAt: r.created_at,
    }));
  });

export const upsertWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => UpsertIn.parse(v))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { encryptSecret } = await import("@/lib/crypto/secrets.server");
    const secretCipher = data.secret ? encryptSecret(data.secret) : null;
    if (data.id) {
      const patch: Record<string, unknown> = {
        name: data.name,
        description: data.description ?? null,
        target_url: data.targetUrl,
        event_types: data.eventTypes,
        enabled: data.enabled,
      };
      if (data.secret !== undefined && data.secret !== null) patch.secret_ciphertext = secretCipher;
      const { error } = await context.supabase
        .from("integration_webhooks")
        .update(patch)
        .eq("id", data.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("integration_webhooks")
      .insert({
        organization_id: data.organizationId,
        name: data.name,
        description: data.description ?? null,
        target_url: data.targetUrl,
        event_types: data.eventTypes,
        enabled: data.enabled,
        secret_ciphertext: secretCipher,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdIn.parse(v))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("integration_webhooks")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdIn.parse(v))
  .handler(async ({ data, context }): Promise<{ ok: boolean; statusCode: number | null; error: string | null; latencyMs: number }> => {
    const t0 = Date.now();
    const { data: row, error: readErr } = await context.supabase
      .from("integration_webhooks")
      .select("target_url, secret_ciphertext")
      .eq("id", data.id)
      .eq("organization_id", data.organizationId)
      .single();
    if (readErr || !row) throw new Error(readErr?.message ?? "webhook_not_found");
    const { decryptSecret, signPayload } = await import("@/lib/crypto/secrets.server");
    const secret = row.secret_ciphertext ? decryptSecret(row.secret_ciphertext) : null;
    const bodyStr = JSON.stringify({ event: "northstar.webhook.test", data: { at: new Date().toISOString() } });
    const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "NorthStarLabs/1.0" };
    if (secret) headers["X-NorthStar-Signature"] = `sha256=${signPayload(secret, bodyStr)}`;
    let statusCode: number | null = null;
    let error: string | null = null;
    try {
      const resp = await fetch(row.target_url, { method: "POST", headers, body: bodyStr });
      statusCode = resp.status;
      if (!resp.ok) error = `HTTP ${resp.status}`;
    } catch (e) {
      error = (e as Error).message;
    }
    const now = new Date().toISOString();
    const ok = !error;
    await context.supabase
      .from("integration_webhooks")
      .update({
        last_delivery_at: now,
        last_status_code: statusCode,
        last_error: error,
        last_error_at: error ? now : null,
      })
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    await context.supabase.from("integration_webhook_deliveries").insert({
      organization_id: data.organizationId,
      webhook_id: data.id,
      event_type: "northstar.webhook.test",
      status_code: statusCode,
      error,
      delivered_at: now,
    });
    return { ok, statusCode, error, latencyMs: Date.now() - t0 };
  });