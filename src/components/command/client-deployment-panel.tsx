// Client deployment and integrations section inside the existing Command
// Center client detail flow. Shows real mapping and reporting health only.
// Every status shown is derived from persisted observations, never assumed.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/page-header";
import {
  useClientDeployment,
  useModuleHealthCheck,
  useRemoveModuleMapping,
  useSetModuleStatus,
  useUpsertModuleMapping,
} from "@/lib/client-deployment/hooks";
import {
  MODULE_EXTERNAL_ID_HINT,
  MODULE_LABELS,
  MODULE_PROVISIONING_MODE,
  PROVISIONING_LABELS,
  deriveModuleStatus,
  type ClientModuleInstallation,
  type DeploymentHealth,
  type ProvisioningStatus,
} from "@/lib/client-deployment/types";
import {
  SAM_HEALTH_LABELS,
  SAM_INSTALLATION_LABELS,
  type SamHealthStatus,
  type SamInstallationStatus,
} from "@/lib/client-deployment/sam-deployment";
import {
  CCM_CAPABILITY_KEYS,
  CCM_CAPABILITY_LABELS,
  CCM_CAPABILITY_STATE_LABELS,
  CCM_DEPLOYMENT_STATUS_LABELS,
  type CcmCapabilityState,
  type CcmDeploymentStatus,
} from "@/lib/client-deployment/ccm-deployment";
import {
  CRM_DEPLOYMENT_STATUS_LABELS,
  CRM_READINESS_KEYS,
  CRM_READINESS_LABELS,
  type CrmDeploymentStatus,
} from "@/lib/client-deployment/crm-deployment";
import {
  CAM_CAPABILITY_KEYS,
  CAM_CAPABILITY_LABELS,
  CAM_COUNT_KEYS,
  CAM_COUNT_LABELS,
  CAM_DEPLOYMENT_STATUS_LABELS,
  type CamDeploymentStatus,
} from "@/lib/client-deployment/cam-deployment";

const STATUS_TONE: Record<ProvisioningStatus, string> = {
  not_configured: "text-muted-foreground border-border/70",
  pending: "text-amber-500 border-amber-500/40",
  active: "text-emerald-500 border-emerald-500/40",
  degraded: "text-amber-500 border-amber-500/40",
  failed: "text-destructive border-destructive/40",
  disabled: "text-muted-foreground border-border/70",
};

const HEALTH_LABEL: Record<DeploymentHealth, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  failed: "Failed",
  not_configured: "Not configured",
};

function when(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Never" : d.toLocaleString();
}

function StatusPill({ status }: { status: ProvisioningStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${STATUS_TONE[status]}`}
    >
      {PROVISIONING_LABELS[status]}
    </span>
  );
}

/**
 * CCM reports its own deployment truth through `ccm.deployment.v1`, including
 * per-capability state. Shown as reported, never re-derived here.
 */
function CcmDeploymentDetail({ config }: { config: Record<string, unknown> }) {
  const obs = config["ccm_deployment"];
  if (!obs || typeof obs !== "object" || Array.isArray(obs)) return null;
  const o = obs as Record<string, unknown>;
  const deploymentStatus = o["deployment_status"] as CcmDeploymentStatus | null;
  const caps =
    o["capabilities"] && typeof o["capabilities"] === "object" && !Array.isArray(o["capabilities"])
      ? (o["capabilities"] as Record<string, unknown>)
      : {};

  const capabilityTone: Record<CcmCapabilityState, string> = {
    connected: "text-emerald-500",
    configured: "text-foreground",
    blocked: "text-destructive",
    not_configured: "text-muted-foreground",
  };

  return (
    <div className="space-y-2">
      <dl className="grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Deployment</dt>
          <dd className="truncate text-foreground">
            {deploymentStatus ? CCM_DEPLOYMENT_STATUS_LABELS[deploymentStatus] : "Not reported"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Standalone</dt>
          <dd className="truncate text-foreground">{o["standalone"] === true ? "Yes" : "No"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">NorthStar link</dt>
          <dd className="truncate text-foreground">
            {typeof o["northstar_client_id"] === "string" ? "Stamped" : "Not stamped"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Last success</dt>
          <dd className="truncate text-foreground">
            {when(typeof o["last_success_at"] === "string" ? o["last_success_at"] : null)}
          </dd>
        </div>
      </dl>
      <ul className="grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
        {CCM_CAPABILITY_KEYS.map((key) => {
          const raw = caps[key];
          const state = (typeof raw === "string" ? raw : null) as CcmCapabilityState | null;
          return (
            <li key={key} className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{CCM_CAPABILITY_LABELS[key]}</span>
              <span className={state ? capabilityTone[state] : "text-muted-foreground"}>
                {state ? CCM_CAPABILITY_STATE_LABELS[state] : "Not reported"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * NorthStar CRM reports its own deployment truth through
 * `northstar.crm.deployment.v1`. Readiness is shown exactly as reported, and
 * the tenant-isolation gate is surfaced explicitly so an operator never reads
 * an external CRM deployment as safe before isolation is proven.
 */
function CrmDeploymentDetail({ config }: { config: Record<string, unknown> }) {
  const obs = config["crm_deployment"];
  if (!obs || typeof obs !== "object" || Array.isArray(obs)) return null;
  const o = obs as Record<string, unknown>;
  const status = o["status"] as CrmDeploymentStatus | null;
  const readiness =
    o["readiness"] && typeof o["readiness"] === "object" && !Array.isArray(o["readiness"])
      ? (o["readiness"] as Record<string, unknown>)
      : {};
  const isolated = o["tenant_isolation_verified"] === true;
  const internal = o["internal_deployment"] === true;

  return (
    <div className="space-y-2">
      <dl className="grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Deployment</dt>
          <dd className="truncate text-foreground">
            {status ? CRM_DEPLOYMENT_STATUS_LABELS[status] : "Not reported"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Tenant</dt>
          <dd className="truncate text-foreground">
            {typeof o["tenant"] === "string" ? o["tenant"] : "Not reported"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">NorthStar link</dt>
          <dd className="truncate text-foreground">
            {typeof o["northstar_client_id"] === "string" ? "Stamped" : "Not stamped"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Last success</dt>
          <dd className="truncate text-foreground">
            {when(typeof o["last_success_at"] === "string" ? o["last_success_at"] : null)}
          </dd>
        </div>
      </dl>
      <ul className="grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2 xl:grid-cols-3">
        {CRM_READINESS_KEYS.map((key) => {
          const raw = readiness[key];
          const flag = typeof raw === "boolean" ? raw : null;
          return (
            <li key={key} className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{CRM_READINESS_LABELS[key]}</span>
              <span
                className={
                  flag === true
                    ? "text-emerald-500"
                    : flag === false
                      ? "text-destructive"
                      : "text-muted-foreground"
                }
              >
                {flag === true ? "Ready" : flag === false ? "Blocked" : "Not reported"}
              </span>
            </li>
          );
        })}
      </ul>
      {!isolated && !internal && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          External-client activation is held: CRM has not proven per-business RLS and secure user
          provisioning. Requires setup, not active.
        </p>
      )}
      {!isolated && internal && (
        <p className="text-[11px] text-muted-foreground">
          Internal NorthStar Labs deployment. Not cleared for external multi-client use.
        </p>
      )}
    </div>
  );
}

/**
 * CAM reports deployment truth through its existing HQ dashboard endpoint
 * under `view=deployment`. Capability readiness, detail and counts are shown
 * exactly as reported, never re-derived here.
 */
function CamDeploymentDetail({ config }: { config: Record<string, unknown> }) {
  const obs = config["cam_deployment"];
  if (!obs || typeof obs !== "object" || Array.isArray(obs)) return null;
  const o = obs as Record<string, unknown>;
  const status = o["status"] as CamDeploymentStatus | null;
  const caps =
    o["capabilities"] && typeof o["capabilities"] === "object" && !Array.isArray(o["capabilities"])
      ? (o["capabilities"] as Record<string, unknown>)
      : {};
  const counts =
    o["counts"] && typeof o["counts"] === "object" && !Array.isArray(o["counts"])
      ? (o["counts"] as Record<string, unknown>)
      : {};

  return (
    <div className="space-y-2">
      <dl className="grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Deployment</dt>
          <dd className="truncate text-foreground">
            {status ? CAM_DEPLOYMENT_STATUS_LABELS[status] : "Not reported"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Account</dt>
          <dd className="truncate text-foreground">
            {typeof o["account_status"] === "string" ? o["account_status"] : "Not reported"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">HQ mapping</dt>
          <dd className="truncate text-foreground">
            {o["mapped"] === true ? "Mapped" : "Not mapped"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Last success</dt>
          <dd className="truncate text-foreground">
            {when(typeof o["last_success_at"] === "string" ? o["last_success_at"] : null)}
          </dd>
        </div>
      </dl>
      <ul className="grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2 xl:grid-cols-3">
        {CAM_CAPABILITY_KEYS.map((key) => {
          const raw = caps[key];
          const cap =
            raw && typeof raw === "object" && !Array.isArray(raw)
              ? (raw as Record<string, unknown>)
              : null;
          const ready = cap && typeof cap["ready"] === "boolean" ? (cap["ready"] as boolean) : null;
          const detail = cap && typeof cap["detail"] === "string" ? (cap["detail"] as string) : null;
          return (
            <li key={key} className="flex items-baseline justify-between gap-2">
              <span className="truncate text-muted-foreground" title={detail ?? undefined}>
                {CAM_CAPABILITY_LABELS[key]}
              </span>
              <span
                className={
                  ready === true
                    ? "text-emerald-500"
                    : ready === false
                      ? "text-destructive"
                      : "text-muted-foreground"
                }
                title={detail ?? undefined}
              >
                {ready === true ? "Ready" : ready === false ? "Not ready" : "Not reported"}
              </span>
            </li>
          );
        })}
      </ul>
      <ul className="grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-3">
        {CAM_COUNT_KEYS.map((key) => {
          const value = typeof counts[key] === "number" ? (counts[key] as number) : null;
          return (
            <li key={key} className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{CAM_COUNT_LABELS[key]}</span>
              <span className="text-foreground">
                {value === null ? "Not reported" : value.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * SAM Core reports its own deployment truth through `sam-deployment.v1`. The
 * last observation is persisted on the mapping row, so it is shown as reported
 * rather than re-derived here.
 */
function SamDeploymentDetail({ config }: { config: Record<string, unknown> }) {
  const obs = config["sam_deployment"];
  if (!obs || typeof obs !== "object" || Array.isArray(obs)) return null;
  const o = obs as Record<string, unknown>;
  const installStatus = o["installation_status"] as SamInstallationStatus | null;
  const healthStatus = o["health_status"] as SamHealthStatus | null;
  const capabilities = Array.isArray(o["capabilities"])
    ? (o["capabilities"] as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  const tasks = typeof o["tasks_24h"] === "number" ? o["tasks_24h"] : null;
  const failed = typeof o["failed_tasks_24h"] === "number" ? o["failed_tasks_24h"] : null;

  const facts: Array<[string, string]> = [
    ["Installation", installStatus ? SAM_INSTALLATION_LABELS[installStatus] : "Not reported"],
    ["Reported health", healthStatus ? SAM_HEALTH_LABELS[healthStatus] : "Not reported"],
    ["Registered", o["registered"] === true ? "Yes" : "No"],
    ["Auth ready", o["auth_ready"] === true ? "Yes" : "No"],
    ["Application", typeof o["application_state"] === "string" ? o["application_state"] : "Not reported"],
    ["Tasks 24h", tasks === null ? "Not reported" : `${tasks}${failed === null ? "" : ` (${failed} failed)`}`],
    ["Capabilities", capabilities.length > 0 ? capabilities.join(", ") : "None reported"],
    ["Last activity", when(typeof o["last_activity_at"] === "string" ? o["last_activity_at"] : null)],
  ];

  return (
    <dl className="grid gap-x-6 gap-y-1 text-[11px] sm:grid-cols-2 xl:grid-cols-4">
      {facts.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="truncate text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ClientDeploymentPanel({
  organizationId,
  northstarClientId,
}: {
  organizationId: string;
  northstarClientId: string;
}) {
  const q = useClientDeployment(organizationId, northstarClientId);
  const upsert = useUpsertModuleMapping(organizationId, northstarClientId);
  const setStatus = useSetModuleStatus(organizationId, northstarClientId);
  const remove = useRemoveModuleMapping(organizationId, northstarClientId);
  const health = useModuleHealthCheck(organizationId, northstarClientId);

  const [idDrafts, setIdDrafts] = useState<Record<string, string>>({});
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});

  const installations = useMemo(() => q.data?.installations ?? [], [q.data]);
  const summary = q.data?.summary ?? null;
  const canManage = q.data?.canManage ?? false;

  async function onSave(install: ClientModuleInstallation) {
    const externalId = (idDrafts[install.module] ?? install.externalId ?? "").trim();
    const endpointUrl = (urlDrafts[install.module] ?? install.endpointUrl ?? "").trim();
    if (!externalId) {
      toast.error(`Enter the ${MODULE_EXTERNAL_ID_HINT[install.module]}.`);
      return;
    }
    try {
      await upsert.mutateAsync({
        module: install.module,
        externalId,
        endpointUrl: endpointUrl || null,
        configuration: install.configuration,
        status: install.status === "disabled" ? "disabled" : install.id ? install.status : "pending",
      });
      setIdDrafts((d) => ({ ...d, [install.module]: "" }));
      setUrlDrafts((d) => ({ ...d, [install.module]: "" }));
      toast.success(`${MODULE_LABELS[install.module]} mapping saved.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the mapping.");
    }
  }

  async function onCheck(module?: ClientModuleInstallation["module"]) {
    try {
      const results = await health.mutateAsync({ module: module ?? null });
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        toast.success("All checked modules answered successfully.");
      } else {
        toast.error(
          failed
            .map((r) => `${MODULE_LABELS[r.module]}: ${r.error ?? "no response"}`)
            .join(" | "),
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Health check failed.");
    }
  }

  return (
    <Section
      title="Deployment and integrations"
      hint="CAM, CCM, NorthStar CRM and SAM Core mapped to this client. Status reflects real endpoint checks only."
      action={
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={health.isPending || q.isLoading}
          onClick={() => void onCheck()}
        >
          {health.isPending ? "Checking…" : "Run health check"}
        </Button>
      }
    >
      {q.isLoading ? (
        <p className="text-[12px] text-muted-foreground">Loading deployment state…</p>
      ) : q.isError ? (
        <p className="text-[12px] text-destructive">
          {(q.error as Error)?.message ?? "Deployment state could not be read."}
        </p>
      ) : (
        <div className="space-y-5">
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
            <span className="text-muted-foreground">
              Shared health:{" "}
              <span className="text-foreground">
                {summary ? HEALTH_LABEL[summary.health] : "Unknown"}
              </span>
            </span>
            <span className="text-muted-foreground">
              Modules mapped:{" "}
              <span className="text-foreground">
                {summary?.mappedModules ?? 0} of {installations.length}
              </span>
            </span>
            <span className="text-muted-foreground">
              Reporting credential:{" "}
              <span className="text-foreground">
                {q.data?.reportingCredentialConfigured ? "Configured" : "Not configured"}
              </span>
            </span>
            <span className="text-muted-foreground">
              northstar_client_id: <code className="text-foreground">{northstarClientId}</code>
            </span>
          </div>

          {/* Provisioning checklist */}
          {summary && (
            <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {summary.checklist.map((step, i) => (
                <li
                  key={step.stage}
                  className={`rounded-[6px] border px-2.5 py-2 ${
                    step.state === "done"
                      ? "border-emerald-500/40"
                      : step.state === "blocked"
                        ? "border-destructive/40"
                        : step.state === "current"
                          ? "border-amber-500/40"
                          : "border-border/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-foreground">
                      {i + 1}. {step.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {step.state}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
          )}

          {/* Module rows */}
          <div className="divide-y divide-border/60 rounded-[8px] border border-border/70">
            {installations.map((install) => {
              const effective = deriveModuleStatus(install);
              return (
                <div key={install.module} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-medium text-foreground">
                        {MODULE_LABELS[install.module]}
                      </span>
                      <StatusPill status={effective} />
                      {MODULE_PROVISIONING_MODE[install.module] === "requires_setup" &&
                        effective === "not_configured" && (
                          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            Requires setup
                          </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground">
                      <span>Last check {when(install.lastHealthCheckAt)}</span>
                      <span>Last success {when(install.lastSuccessAt)}</span>
                    </div>
                  </div>

                  {install.module === "sam" && (
                    <SamDeploymentDetail config={install.configuration} />
                  )}

                  {install.module === "ccm" && (
                    <CcmDeploymentDetail config={install.configuration} />
                  )}

                  {install.module === "crm" && (
                    <CrmDeploymentDetail config={install.configuration} />
                  )}

                  {install.module === "cam" && (
                    <CamDeploymentDetail config={install.configuration} />
                  )}

                  {install.lastError && (
                    <p className="text-[11px] text-destructive">{install.lastError}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      aria-label={MODULE_EXTERNAL_ID_HINT[install.module]}
                      placeholder={MODULE_EXTERNAL_ID_HINT[install.module]}
                      disabled={!canManage}
                      value={idDrafts[install.module] ?? install.externalId ?? ""}
                      onChange={(e) =>
                        setIdDrafts((d) => ({ ...d, [install.module]: e.target.value }))
                      }
                      className="h-8 max-w-xs text-[12px]"
                    />
                    <Input
                      aria-label={`${MODULE_LABELS[install.module]} endpoint override`}
                      placeholder="Endpoint override (optional)"
                      disabled={!canManage}
                      value={urlDrafts[install.module] ?? install.endpointUrl ?? ""}
                      onChange={(e) =>
                        setUrlDrafts((d) => ({ ...d, [install.module]: e.target.value }))
                      }
                      className="h-8 max-w-xs text-[12px]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canManage || upsert.isPending}
                      onClick={() => void onSave(install)}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={health.isPending || !install.externalId}
                      onClick={() => void onCheck(install.module)}
                    >
                      Check
                    </Button>
                    {install.id && canManage && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={setStatus.isPending}
                          onClick={() =>
                            void setStatus
                              .mutateAsync({
                                module: install.module,
                                status: install.status === "disabled" ? "pending" : "disabled",
                              })
                              .then(() =>
                                toast.success(
                                  install.status === "disabled"
                                    ? `${MODULE_LABELS[install.module]} enabled.`
                                    : `${MODULE_LABELS[install.module]} disabled.`,
                                ),
                              )
                              .catch((err: unknown) =>
                                toast.error(
                                  err instanceof Error ? err.message : "Status change failed.",
                                ),
                              )
                          }
                        >
                          {install.status === "disabled" ? "Enable" : "Disable"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={remove.isPending}
                          onClick={() =>
                            void remove
                              .mutateAsync({ module: install.module })
                              .then(() => toast.success("Mapping removed."))
                              .catch((err: unknown) =>
                                toast.error(
                                  err instanceof Error ? err.message : "Removal failed.",
                                ),
                              )
                          }
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!canManage && (
            <p className="text-[11px] text-muted-foreground">
              Mapping controls require an organization admin or owner role.
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
