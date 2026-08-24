// Operator settings: module reporting connection status plus per-client
// external ID mapping for CAM, CCM, NorthStar CRM and SAM Core.
//
// HQ stores only the mapping. No source data is copied into this project.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/command/dash-ui";
import { StatusChip } from "@/components/command/source-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useClientModuleConnections,
  useDeleteModuleConnection,
  useModuleEnvStatus,
  useModuleProbe,
  useSaveModuleConnection,
} from "@/lib/command/module-hooks";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "@/lib/module-reporting/types";

// Each source scopes reporting with its own parameter, so the mapping label
// names the exact value the source expects.
const ID_HINT: Record<ModuleKey, string> = {
  cam: "CAM client (organization slug or UUID)",
  ccm: "CCM tenant_id (UUID)",
  crm: "CRM business_id (UUID or slug)",
  sam: "SAM organization_id (UUID)",
};

export function ModuleConnectionsCard({
  organizationId,
  clients,
}: {
  organizationId: string;
  clients: { id: string; name: string }[];
}) {
  const env = useModuleEnvStatus(Boolean(organizationId));
  const mappings = useClientModuleConnections(organizationId);
  const save = useSaveModuleConnection();
  const remove = useDeleteModuleConnection();

  const probe = useModuleProbe();

  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Partial<Record<ModuleKey, string>>>({});
  const [samAppDraft, setSamAppDraft] = useState<string | null>(null);

  const current = useMemo(() => {
    const map = new Map<
      ModuleKey,
      { id: string; externalId: string; metadata: Record<string, unknown> | null }
    >();
    for (const row of mappings.data ?? []) {
      if (row.client_id === clientId) {
        map.set(row.module, {
          id: row.id,
          externalId: row.external_id,
          metadata: row.metadata ?? null,
        });
      }
    }
    return map;
  }, [mappings.data, clientId]);

  const savedSamApp = (() => {
    const meta = current.get("sam")?.metadata;
    const value = meta && typeof meta.application_id === "string" ? meta.application_id : "";
    return value;
  })();
  const samAppValue = samAppDraft ?? savedSamApp;

  async function onSave(module: ModuleKey) {
    const value = (drafts[module] ?? current.get(module)?.externalId ?? "").trim();
    if (!clientId) {
      toast.error("Select a client first.");
      return;
    }
    if (!value) {
      toast.error(`Enter the ${ID_HINT[module]}.`);
      return;
    }
    try {
      await save.mutateAsync({
        organizationId,
        clientId,
        module,
        externalId: value,
        metadata:
          module === "sam"
            ? samAppValue.trim()
              ? { application_id: samAppValue.trim() }
              : {}
            : (current.get(module)?.metadata ?? {}),
      });
      setDrafts((d) => ({ ...d, [module]: undefined }));
      if (module === "sam") setSamAppDraft(null);
      toast.success(`${MODULE_LABELS[module]} mapping saved.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the mapping.");
    }
  }

  async function onRemove(module: ModuleKey) {
    const row = current.get(module);
    if (!row) return;
    try {
      await remove.mutateAsync(row.id);
      toast.success(`${MODULE_LABELS[module]} mapping removed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the mapping.");
    }
  }

  return (
    <Panel title="Module Reporting Connections" subtitle="CAM, CCM, CRM, SAM Core" bodyClassName="p-3">
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        NorthStar HQ reads reporting live from each product. Nothing is copied into HQ. A module
        shows data only when its reporting URL and shared secret are configured and the selected
        client has an external ID mapped.
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Scope values differ per source: CAM uses <code>client</code>, CCM uses{" "}
        <code>tenant_id</code>, CRM uses <code>business_id</code>, SAM Core uses{" "}
        <code>organization_id</code> plus an optional <code>application_id</code>.
      </p>

      {/* Environment status */}
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {(env.data ?? MODULE_KEYS.map((m) => ({
          module: m,
          urlEnv: "",
          urlConfigured: false,
          secretConfigured: false,
          urlSource: "default" as const,
          secretSource: null,
        }))).map((s) => {
          const ready = s.urlConfigured && s.secretConfigured;
          return (
            <div
              key={s.module}
              className="rounded-[6px] border border-border/70 bg-card/50 px-2.5 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-foreground">
                  {MODULE_LABELS[s.module]}
                </span>
                <StatusChip status={ready ? "ok" : "not_connected"} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {ready
                  ? `Endpoint ${s.urlSource === "env" ? "override" : "default"}, credential from ${s.secretSource === "vault" ? "vault" : "environment"}`
                  : !s.urlConfigured
                    ? "Reporting URL missing"
                    : "Shared reporting credential missing"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Client mapping */}
      <div className="mt-4">
        <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Client
        </label>
        <select
          aria-label="Client to map"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setDrafts({});
          }}
          className="mt-1 h-8 w-full max-w-sm rounded-[6px] border border-border/70 bg-card/60 px-2 text-[12px] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          {clients.length === 0 && <option value="">No clients on record</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="mt-2.5 space-y-2">
          {MODULE_KEYS.map((module) => {
            const existing = current.get(module);
            const value = drafts[module] ?? existing?.externalId ?? "";
            return (
              <div key={module} className="flex flex-wrap items-center gap-2">
                <span className="w-28 shrink-0 text-[11.5px] text-foreground">
                  {MODULE_LABELS[module]}
                </span>
                <Input
                  aria-label={ID_HINT[module]}
                  placeholder={ID_HINT[module]}
                  value={value}
                  onChange={(e) => setDrafts((d) => ({ ...d, [module]: e.target.value }))}
                  className="h-8 max-w-xs text-[12px]"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={save.isPending || !clientId}
                  onClick={() => void onSave(module)}
                >
                  Save
                </Button>
                {existing && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => void onRemove(module)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-28 shrink-0 text-[11.5px] text-muted-foreground">
              SAM application
            </span>
            <Input
              aria-label="SAM application_id (optional UUID)"
              placeholder="SAM application_id (optional)"
              value={samAppValue}
              onChange={(e) => setSamAppDraft(e.target.value)}
              className="h-8 max-w-xs text-[12px]"
            />
            <span className="text-[10.5px] text-muted-foreground">
              Saved with the SAM mapping.
            </span>
          </div>
        </div>

        <div className="mt-4 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={probe.isPending || !organizationId}
              onClick={() =>
                probe.mutate({ organizationId, clientId: clientId || null })
              }
            >
              {probe.isPending ? "Probing sources..." : "Probe source endpoints"}
            </Button>
            <span className="text-[10.5px] text-muted-foreground">
              Server-side call to all four endpoints. Returns status and counts only.
            </span>
          </div>

          {probe.isError && (
            <p className="mt-2 text-[11px] text-destructive">
              {probe.error instanceof Error ? probe.error.message : "Probe failed."}
            </p>
          )}

          {probe.data && (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
              {probe.data.map((row) => (
                <div
                  key={row.module}
                  className="rounded-[6px] border border-border/70 bg-card/50 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-foreground">
                      {MODULE_LABELS[row.module]}
                    </span>
                    <StatusChip status={row.live ? "ok" : "unavailable"} />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {row.live
                      ? `HTTP ${row.httpStatus ?? 200} - ${row.version ?? "no version"}`
                      : (row.reason ?? "No response")}
                  </div>
                  {row.live && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {Object.entries(row.counts)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
