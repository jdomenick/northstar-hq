/**
 * Client deployment server API.
 *
 * Every function is organization scoped and protected by the existing auth
 * middleware plus the shared membership check. Reads require an active member,
 * mutations require admin or owner (matching the RLS policies already on
 * `client_module_connections`).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MODULE_KEYS } from "@/lib/module-reporting/types";
import {
  buildDeploymentSummary,
  PROVISIONING_STATUSES,
  type ClientModuleInstallation,
  type DeploymentSummary,
  type ModuleKey,
  type ProvisioningStatus,
} from "./types";

const moduleEnum = z.enum(["cam", "ccm", "crm", "sam"]);

const scopeInput = z.object({
  organizationId: z.string().uuid(),
  northstarClientId: z.string().uuid(),
});

const upsertInput = scopeInput.extend({
  module: moduleEnum,
  externalId: z.string().trim().min(1).max(200),
  externalName: z.string().trim().max(200).nullable().optional(),
  endpointUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^https?:\/\//, "Endpoint must start with http:// or https://")
    .nullable()
    .optional(),
  configuration: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum(["not_configured", "pending", "active", "degraded", "failed", "disabled"]).optional(),
});

const statusInput = scopeInput.extend({
  module: moduleEnum,
  status: z.enum(["not_configured", "pending", "active", "degraded", "failed", "disabled"]),
});

export interface ClientDeploymentResult {
  northstarClientId: string;
  clientName: string | null;
  installations: ClientModuleInstallation[];
  summary: DeploymentSummary;
  /** Boolean only. The credential itself is never sent to the browser. */
  reportingCredentialConfigured: boolean;
  /** True when the caller may change mappings. */
  canManage: boolean;
}

/** Reads client + installations + derived summary in one round trip. */
export const getClientDeployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scopeInput.parse(input))
  .handler(async ({ data, context }): Promise<ClientDeploymentResult> => {
    const { requireMembership } = await import("@/lib/content-ops/membership.server");
    const { role } = await requireMembership(
      context.supabase,
      context.userId,
      data.organizationId,
      null,
      "member",
    );

    const { CONNECTION_COLUMNS, completeInstallations, reportingCredentialConfigured } =
      await import("./deployment.server");

    const { data: client, error: clientError } = await context.supabase
      .from("revenue_clients")
      .select("id,name")
      .eq("organization_id", data.organizationId)
      .eq("id", data.northstarClientId)
      .maybeSingle();
    if (clientError) throw new Error(`Client read failed: ${clientError.message}`);

    const { data: rows, error } = await context.supabase
      .from("client_module_connections")
      .select(CONNECTION_COLUMNS)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.northstarClientId);
    if (error) throw new Error(`Module mapping read failed: ${error.message}`);

    const installations = completeInstallations(
      data.organizationId,
      data.northstarClientId,
      (rows ?? []) as never,
    );
    const credential = await reportingCredentialConfigured();

    return {
      northstarClientId: data.northstarClientId,
      clientName: client?.name ?? null,
      installations,
      summary: buildDeploymentSummary(
        {
          clientExists: Boolean(client),
          reportingCredentialConfigured: credential,
          installations,
        },
        data.northstarClientId,
      ),
      reportingCredentialConfigured: credential,
      canManage: role === "admin" || role === "owner",
    };
  });

/** List installations only. Same scoping, lighter payload. */
export const listClientModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scopeInput.parse(input))
  .handler(async ({ data, context }): Promise<ClientModuleInstallation[]> => {
    const { requireMembership } = await import("@/lib/content-ops/membership.server");
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    const { CONNECTION_COLUMNS, completeInstallations } = await import("./deployment.server");
    const { data: rows, error } = await context.supabase
      .from("client_module_connections")
      .select(CONNECTION_COLUMNS)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.northstarClientId);
    if (error) throw new Error(`Module mapping read failed: ${error.message}`);
    return completeInstallations(data.organizationId, data.northstarClientId, (rows ?? []) as never);
  });

/** Create or update the mapping between a NorthStar client and a module tenant. */
export const upsertClientModuleMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertInput.parse(input))
  .handler(async ({ data, context }): Promise<ClientModuleInstallation> => {
    const { requireMembership } = await import("@/lib/content-ops/membership.server");
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "admin");
    const { CONNECTION_COLUMNS, toInstallation } = await import("./deployment.server");

    const status: ProvisioningStatus = data.status ?? "pending";
    const { data: row, error } = await context.supabase
      .from("client_module_connections")
      .upsert(
        {
          organization_id: data.organizationId,
          client_id: data.northstarClientId,
          module: data.module,
          external_id: data.externalId.trim(),
          external_name: data.externalName?.trim() || null,
          endpoint_url: data.endpointUrl?.trim() || null,
          provisioning_status: status,
          active: status !== "disabled",
          metadata: (data.configuration ?? {}) as never,
        },
        { onConflict: "client_id,module" },
      )
      .select(CONNECTION_COLUMNS)
      .single();
    if (error) throw new Error(`Mapping save failed: ${error.message}`);
    return toInstallation(row as never);
  });

/** Enable, disable, or otherwise set the operator-declared module status. */
export const setClientModuleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusInput.parse(input))
  .handler(async ({ data, context }): Promise<ClientModuleInstallation> => {
    const { requireMembership } = await import("@/lib/content-ops/membership.server");
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "admin");
    const { CONNECTION_COLUMNS, toInstallation } = await import("./deployment.server");
    const { data: row, error } = await context.supabase
      .from("client_module_connections")
      .update({ provisioning_status: data.status, active: data.status !== "disabled" })
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.northstarClientId)
      .eq("module", data.module)
      .select(CONNECTION_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(`Status update failed: ${error.message}`);
    if (!row) throw new Error("No mapping exists for this module. Map an external ID first.");
    return toInstallation(row as never);
  });

/** Remove a module mapping entirely. */
export const removeClientModuleMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scopeInput.extend({ module: moduleEnum }).parse(input))
  .handler(async ({ data, context }): Promise<{ removed: boolean }> => {
    const { requireMembership } = await import("@/lib/content-ops/membership.server");
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "admin");
    const { error } = await context.supabase
      .from("client_module_connections")
      .delete()
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.northstarClientId)
      .eq("module", data.module);
    if (error) throw new Error(`Mapping removal failed: ${error.message}`);
    return { removed: true };
  });

export interface ModuleHealthResult {
  module: ModuleKey;
  ok: boolean;
  httpStatus: number | null;
  checkedAt: string;
  error: string | null;
  status: ProvisioningStatus;
}

const healthInput = scopeInput.extend({ module: moduleEnum.nullable().optional() });

/**
 * Runs a real reporting call per mapped module and persists the observed
 * result. Modules with no mapping are reported as not configured and never
 * marked healthy.
 */
export const runClientModuleHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => healthInput.parse(input))
  .handler(async ({ data, context }): Promise<ModuleHealthResult[]> => {
    const { requireMembership } = await import("@/lib/content-ops/membership.server");
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    const { CONNECTION_COLUMNS, checkModuleHealth, toInstallation } = await import(
      "./deployment.server"
    );

    const { data: rows, error } = await context.supabase
      .from("client_module_connections")
      .select(CONNECTION_COLUMNS)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.northstarClientId);
    if (error) throw new Error(`Module mapping read failed: ${error.message}`);

    const targets = ((rows ?? []) as never as Parameters<typeof toInstallation>[0][])
      .map(toInstallation)
      .filter((i) => (data.module ? i.module === data.module : true));

    if (targets.length === 0) {
      const requested = data.module ? [data.module] : MODULE_KEYS;
      return requested.map((module) => ({
        module,
        ok: false,
        httpStatus: null,
        checkedAt: new Date().toISOString(),
        error: "No external tenant ID is mapped for this module.",
        status: "not_configured" as ProvisioningStatus,
      }));
    }

    // Health writes are a system observation, not an operator edit, so they run
    // with elevated rights after membership is verified.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { samObservation } = await import("./sam-deployment");
    const { ccmObservation } = await import("./ccm-deployment");
    const { crmObservation } = await import("./crm-deployment");
    const { camObservation } = await import("./cam-deployment");

    return Promise.all(
      targets.map(async (install): Promise<ModuleHealthResult> => {
        const appId =
          install.module === "sam" && typeof install.configuration.application_id === "string"
            ? (install.configuration.application_id as string)
            : null;
        const tenantSlug =
          install.module === "ccm" && typeof install.configuration.tenant_slug === "string"
            ? (install.configuration.tenant_slug as string)
            : null;
        const internalDeployment =
          install.module === "crm" && install.configuration.internal_deployment === true;
        const outcome = await checkModuleHealth({
          module: install.module,
          externalId: install.externalId,
          endpointUrl: install.endpointUrl,
          northstarClientId: data.northstarClientId,
          applicationId: appId,
          tenantSlug,
          internalDeployment,
        });

        // A source that reports its own deployment status is authoritative;
        // otherwise the status is inferred from whether the call succeeded.
        const observed: ProvisioningStatus =
          outcome.reportedStatus ??
          (outcome.ok ? "active" : install.lastSuccessAt ? "degraded" : "failed");
        const nextStatus: ProvisioningStatus =
          install.status === "disabled" ? "disabled" : observed;

        const lastSuccessAt = outcome.ok
          ? (outcome.reportedLastSuccessAt ?? outcome.checkedAt)
          : (outcome.reportedLastSuccessAt ?? install.lastSuccessAt);

        const metadata = outcome.samDeployment
          ? {
              ...install.configuration,
              sam_deployment: samObservation(outcome.samDeployment),
            }
          : outcome.ccmDeployment
            ? {
                ...install.configuration,
                ccm_deployment: ccmObservation(outcome.ccmDeployment),
              }
            : outcome.crmDeployment
              ? {
                  ...install.configuration,
                  crm_deployment: crmObservation(outcome.crmDeployment, { internalDeployment }),
                }
              : outcome.camDeployment
                ? {
                    ...install.configuration,
                    cam_deployment: camObservation(outcome.camDeployment),
                  }
                : null;

        await supabaseAdmin
          .from("client_module_connections")
          .update({
            last_health_check_at: outcome.checkedAt,
            last_success_at: lastSuccessAt,
            last_error: outcome.error,
            provisioning_status: nextStatus,
            ...(metadata ? { metadata: metadata as never } : {}),
          })
          .eq("id", install.id as string);

        return {
          module: install.module,
          ok: outcome.ok,
          httpStatus: outcome.httpStatus,
          checkedAt: outcome.checkedAt,
          error: outcome.error,
          status: nextStatus,
        };
      }),
    );
  });

export const PROVISIONING_STATUS_VALUES = PROVISIONING_STATUSES;
