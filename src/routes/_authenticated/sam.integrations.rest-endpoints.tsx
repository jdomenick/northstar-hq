import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import {
  listRestEndpoints,
  upsertRestEndpoint,
  deleteRestEndpoint,
  testRestEndpoint,
  type RestEndpointRow,
} from "@/lib/integrations/rest-endpoints.functions";

export const Route = createFileRoute("/_authenticated/sam/integrations/rest-endpoints")({
  component: RestEndpointsPage,
  head: () => ({
    meta: [
      { title: "Custom REST API - NorthStar Labs" },
      { name: "description", content: "Reusable REST endpoints SAM can call with stored auth." },
    ],
  }),
});

type Draft = Partial<RestEndpointRow> & { authConfig?: Record<string, string> };

function RestEndpointsPage() {
  const { activeOrgId } = useOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listRestEndpoints);
  const upsertFn = useServerFn(upsertRestEndpoint);
  const delFn = useServerFn(deleteRestEndpoint);
  const testFn = useServerFn(testRestEndpoint);

  const q = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["rest-endpoints", activeOrgId],
    queryFn: () => listFn({ data: { organizationId: activeOrgId! } }),
  });

  const [editing, setEditing] = useState<Draft | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!activeOrgId) return;
      await upsertFn({
        data: {
          organizationId: activeOrgId,
          id: d.id,
          name: d.name ?? "",
          description: d.description ?? null,
          baseUrl: d.baseUrl ?? "",
          method: (d.method as "GET") ?? "GET",
          authType: (d.authType as "none") ?? "none",
          authConfig: d.authConfig && Object.keys(d.authConfig).length > 0 ? d.authConfig : null,
          defaultHeaders: d.defaultHeaders ?? {},
          defaultQueryParams: d.defaultQueryParams ?? {},
          timeoutMs: d.timeoutMs ?? 15000,
          enabled: d.enabled ?? true,
        },
      });
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["rest-endpoints", activeOrgId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { organizationId: activeOrgId!, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rest-endpoints", activeOrgId] }),
  });

  const test = useMutation({
    mutationFn: (id: string) => testFn({ data: { organizationId: activeOrgId!, id } }),
    onSuccess: (r, id) => {
      setTestResult((p) => ({
        ...p,
        [id]: r.ok ? `OK ${r.statusCode ?? ""} in ${r.latencyMs}ms` : `Failed: ${r.error ?? "unknown"}`,
      }));
      qc.invalidateQueries({ queryKey: ["rest-endpoints", activeOrgId] });
    },
  });

  const rows = q.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Integrations / Automation"
        title="Custom REST API"
        description="Reusable REST endpoints SAM can call with stored auth (bearer, header, basic, or query param). Auth values are encrypted at rest."
      />
      <PageBody>
        <div className="mb-6 flex items-center justify-between">
          <Link to="/sam/integrations" className="text-[12px] text-muted-foreground hover:text-foreground">← Back to Integrations</Link>
          <button
            className="rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90"
            onClick={() => setEditing({ name: "", baseUrl: "", method: "GET", authType: "none", defaultHeaders: {}, defaultQueryParams: {}, timeoutMs: 15000, enabled: true, authConfig: {} })}
          >
            New endpoint
          </button>
        </div>

        {editing ? (
          <RestForm value={editing} onChange={setEditing} onSave={() => save.mutate(editing)} onCancel={() => setEditing(null)} saving={save.isPending} />
        ) : null}

        <Section title={`Configured (${rows.length})`}>
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-border/60 bg-card/50 px-4 py-6 text-center text-[13px] text-muted-foreground">
              No REST endpoints configured.
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl border border-border/60 bg-card/50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${r.enabled ? "bg-[oklch(0.72_0.14_155)]" : "bg-muted-foreground/60"}`} />
                        <div className="text-[14px] font-medium text-foreground">{r.name}</div>
                        <span className="rounded border border-border/50 px-1.5 py-0 font-mono text-[10.5px] text-foreground/70">{r.method}</span>
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{r.authType.replace("_", " ")}</span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[12px] text-muted-foreground">{r.baseUrl}</div>
                      {r.description ? <div className="mt-1 text-[12.5px] text-muted-foreground">{r.description}</div> : null}
                      <div className="mt-2 grid grid-cols-2 gap-x-4 text-[11.5px] text-muted-foreground">
                        <div>Auth stored: {r.hasAuthConfig ? "yes" : "no"}</div>
                        <div>Timeout: {r.timeoutMs}ms</div>
                        {r.lastSuccessAt ? <div>Last success: {new Date(r.lastSuccessAt).toLocaleString()}</div> : null}
                        {r.lastError ? <div className="col-span-2 text-[oklch(0.5_0.18_27)]">Last error: {r.lastError}</div> : null}
                        {testResult[r.id] ? <div className="col-span-2 text-foreground/80">Test: {testResult[r.id]}</div> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button className="rounded-md border border-border px-2 py-1 text-[11.5px] hover:bg-secondary/60" onClick={() => setEditing({ ...r, authConfig: {} })}>Edit</button>
                      <button className="rounded-md border border-border px-2 py-1 text-[11.5px] hover:bg-secondary/60 disabled:opacity-50" disabled={test.isPending} onClick={() => test.mutate(r.id)}>Test</button>
                      <button className="rounded-md border border-[oklch(0.5_0.18_27)]/30 px-2 py-1 text-[11.5px] text-[oklch(0.5_0.18_27)] hover:bg-[oklch(0.5_0.18_27)]/5" onClick={() => { if (confirm(`Delete "${r.name}"?`)) remove.mutate(r.id); }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </PageBody>
    </div>
  );
}

function RestForm({ value, onChange, onSave, onCancel, saving }: {
  value: Draft;
  onChange: (v: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const ac = value.authConfig ?? {};
  const authType = value.authType ?? "none";
  const setAc = (patch: Record<string, string>) => onChange({ ...value, authConfig: { ...ac, ...patch } });
  return (
    <Section title={value.id ? "Edit endpoint" : "New endpoint"}>
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-card/50 p-4 md:grid-cols-2">
        <label className="text-[12px] text-muted-foreground">
          Name
          <input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground" value={value.name ?? ""} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </label>
        <label className="text-[12px] text-muted-foreground">
          Method
          <select className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground" value={value.method ?? "GET"} onChange={(e) => onChange({ ...value, method: e.target.value })}>
            {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="text-[12px] text-muted-foreground md:col-span-2">
          Base URL
          <input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={value.baseUrl ?? ""} onChange={(e) => onChange({ ...value, baseUrl: e.target.value })} />
        </label>
        <label className="text-[12px] text-muted-foreground md:col-span-2">
          Description
          <input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground" value={value.description ?? ""} onChange={(e) => onChange({ ...value, description: e.target.value })} />
        </label>
        <label className="text-[12px] text-muted-foreground">
          Auth type
          <select className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground" value={authType} onChange={(e) => onChange({ ...value, authType: e.target.value, authConfig: {} })}>
            <option value="none">None</option>
            <option value="bearer">Bearer token</option>
            <option value="api_key_header">API key (header)</option>
            <option value="basic">Basic auth</option>
            <option value="query_param">Query parameter</option>
          </select>
        </label>
        <label className="text-[12px] text-muted-foreground">
          Timeout (ms)
          <input type="number" min={1000} max={60000} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground" value={value.timeoutMs ?? 15000} onChange={(e) => onChange({ ...value, timeoutMs: Number(e.target.value) })} />
        </label>

        {authType === "bearer" ? (
          <label className="text-[12px] text-muted-foreground md:col-span-2">
            Bearer token
            <input type="password" className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={ac.token ?? ""} onChange={(e) => setAc({ token: e.target.value })} />
          </label>
        ) : null}
        {authType === "api_key_header" ? (
          <>
            <label className="text-[12px] text-muted-foreground">Header name<input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={ac.header ?? ""} onChange={(e) => setAc({ header: e.target.value })} /></label>
            <label className="text-[12px] text-muted-foreground">Value<input type="password" className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={ac.value ?? ""} onChange={(e) => setAc({ value: e.target.value })} /></label>
          </>
        ) : null}
        {authType === "basic" ? (
          <>
            <label className="text-[12px] text-muted-foreground">Username<input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={ac.username ?? ""} onChange={(e) => setAc({ username: e.target.value })} /></label>
            <label className="text-[12px] text-muted-foreground">Password<input type="password" className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={ac.password ?? ""} onChange={(e) => setAc({ password: e.target.value })} /></label>
          </>
        ) : null}
        {authType === "query_param" ? (
          <>
            <label className="text-[12px] text-muted-foreground">Param name<input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={ac.param ?? ""} onChange={(e) => setAc({ param: e.target.value })} /></label>
            <label className="text-[12px] text-muted-foreground">Value<input type="password" className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={ac.value ?? ""} onChange={(e) => setAc({ value: e.target.value })} /></label>
          </>
        ) : null}

        <label className="flex items-center gap-2 text-[12px] text-muted-foreground md:col-span-2">
          <input type="checkbox" checked={value.enabled ?? true} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
          Enabled
        </label>

        <div className="flex items-center justify-end gap-2 md:col-span-2">
          <button className="rounded-md border border-border px-3 py-1.5 text-[12px]" onClick={onCancel}>Cancel</button>
          <button disabled={saving || !value.name || !value.baseUrl} className="rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90 disabled:opacity-50" onClick={onSave}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Section>
  );
}