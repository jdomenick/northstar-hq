// Custom REST endpoint CRUD + test call. auth_config stored as ciphertext.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OrgOnly = z.object({ organizationId: z.string().uuid() });
const AuthType = z.enum(["none", "api_key_header", "bearer", "basic", "query_param"]);
const HttpMethod = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

const UpsertIn = z.object({
  organizationId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  baseUrl: z.string().url(),
  method: HttpMethod.default("GET"),
  authType: AuthType.default("none"),
  authConfig: z.record(z.string(), z.string()).optional().nullable(),
  defaultHeaders: z.record(z.string(), z.string()).default({}),
  defaultQueryParams: z.record(z.string(), z.string()).default({}),
  timeoutMs: z.number().int().min(1000).max(60000).default(15000),
  enabled: z.boolean().default(true),
});
const IdIn = z.object({ organizationId: z.string().uuid(), id: z.string().uuid() });

export interface RestEndpointRow {
  id: string;
  name: string;
  description: string | null;
  baseUrl: string;
  method: string;
  authType: string;
  hasAuthConfig: boolean;
  defaultHeaders: Record<string, string>;
  defaultQueryParams: Record<string, string>;
  timeoutMs: number;
  enabled: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  lastStatusCode: number | null;
  createdAt: string;
}

export const listRestEndpoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => OrgOnly.parse(v))
  .handler(async ({ data, context }): Promise<RestEndpointRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("integration_rest_endpoints")
      .select("id, name, description, base_url, method, auth_type, auth_config_ciphertext, default_headers, default_query_params, timeout_ms, enabled, last_success_at, last_error_at, last_error, last_status_code, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      baseUrl: r.base_url,
      method: r.method,
      authType: r.auth_type,
      hasAuthConfig: !!r.auth_config_ciphertext,
      defaultHeaders: (r.default_headers ?? {}) as Record<string, string>,
      defaultQueryParams: (r.default_query_params ?? {}) as Record<string, string>,
      timeoutMs: r.timeout_ms,
      enabled: r.enabled,
      lastSuccessAt: r.last_success_at,
      lastErrorAt: r.last_error_at,
      lastError: r.last_error,
      lastStatusCode: r.last_status_code,
      createdAt: r.created_at,
    }));
  });

export const upsertRestEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => UpsertIn.parse(v))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { encryptSecret } = await import("@/lib/crypto/secrets.server");
    const cipher = data.authConfig ? encryptSecret(JSON.stringify(data.authConfig)) : null;
    if (data.id) {
      const patch = {
        name: data.name,
        description: data.description ?? null,
        base_url: data.baseUrl,
        method: data.method,
        auth_type: data.authType,
        default_headers: data.defaultHeaders,
        default_query_params: data.defaultQueryParams,
        timeout_ms: data.timeoutMs,
        enabled: data.enabled,
        ...(data.authConfig != null ? { auth_config_ciphertext: cipher } : {}),
      };
      const { error } = await context.supabase
        .from("integration_rest_endpoints")
        .update(patch)
        .eq("id", data.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("integration_rest_endpoints")
      .insert({
        organization_id: data.organizationId,
        name: data.name,
        description: data.description ?? null,
        base_url: data.baseUrl,
        method: data.method,
        auth_type: data.authType,
        auth_config_ciphertext: cipher,
        default_headers: data.defaultHeaders,
        default_query_params: data.defaultQueryParams,
        timeout_ms: data.timeoutMs,
        enabled: data.enabled,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteRestEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdIn.parse(v))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("integration_rest_endpoints")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testRestEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdIn.parse(v))
  .handler(async ({ data, context }): Promise<{ ok: boolean; statusCode: number | null; error: string | null; latencyMs: number }> => {
    const t0 = Date.now();
    const { data: row, error: readErr } = await context.supabase
      .from("integration_rest_endpoints")
      .select("base_url, method, auth_type, auth_config_ciphertext, default_headers, default_query_params, timeout_ms")
      .eq("id", data.id)
      .eq("organization_id", data.organizationId)
      .single();
    if (readErr || !row) throw new Error(readErr?.message ?? "endpoint_not_found");
    const { decryptSecret } = await import("@/lib/crypto/secrets.server");
    const authCfg = row.auth_config_ciphertext
      ? (JSON.parse(decryptSecret(row.auth_config_ciphertext)) as Record<string, string>)
      : {};
    const headers: Record<string, string> = { ...((row.default_headers ?? {}) as Record<string, string>) };
    const url = new URL(row.base_url);
    for (const [k, v] of Object.entries((row.default_query_params ?? {}) as Record<string, string>)) {
      url.searchParams.set(k, v);
    }
    if (row.auth_type === "bearer" && authCfg.token) headers["Authorization"] = `Bearer ${authCfg.token}`;
    if (row.auth_type === "api_key_header" && authCfg.header && authCfg.value) headers[authCfg.header] = authCfg.value;
    if (row.auth_type === "basic" && authCfg.username && authCfg.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${authCfg.username}:${authCfg.password}`).toString("base64")}`;
    }
    if (row.auth_type === "query_param" && authCfg.param && authCfg.value) {
      url.searchParams.set(authCfg.param, authCfg.value);
    }
    let statusCode: number | null = null;
    let error: string | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), row.timeout_ms);
      const resp = await fetch(url.toString(), {
        method: row.method,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      statusCode = resp.status;
      if (!resp.ok) error = `HTTP ${resp.status}`;
    } catch (e) {
      error = (e as Error).message;
    }
    const now = new Date().toISOString();
    await context.supabase
      .from("integration_rest_endpoints")
      .update({
        last_success_at: error ? null : now,
        last_error_at: error ? now : null,
        last_error: error,
        last_status_code: statusCode,
      })
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    return { ok: !error, statusCode, error, latencyMs: Date.now() - t0 };
  });