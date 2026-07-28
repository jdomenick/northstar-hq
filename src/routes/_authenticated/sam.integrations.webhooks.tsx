import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import {
  listWebhooks,
  upsertWebhook,
  deleteWebhook,
  testWebhook,
  type WebhookRow,
} from "@/lib/integrations/webhooks.functions";

export const Route = createFileRoute("/_authenticated/sam/integrations/webhooks")({
  component: WebhooksPage,
  head: () => ({
    meta: [
      { title: "Outbound Webhooks - NorthStar Labs" },
      { name: "description", content: "Signed HTTP webhooks NorthStar sends to external systems on SAM events." },
    ],
  }),
});

function WebhooksPage() {
  const { activeOrgId } = useOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listWebhooks);
  const upsertFn = useServerFn(upsertWebhook);
  const delFn = useServerFn(deleteWebhook);
  const testFn = useServerFn(testWebhook);

  const q = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["webhooks", activeOrgId],
    queryFn: () => listFn({ data: { organizationId: activeOrgId! } }),
  });

  const [editing, setEditing] = useState<Partial<WebhookRow> & { secret?: string } | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async (r: typeof editing) => {
      if (!r || !activeOrgId) return;
      await upsertFn({
        data: {
          organizationId: activeOrgId,
          id: r.id,
          name: r.name ?? "",
          description: r.description ?? null,
          targetUrl: r.targetUrl ?? "",
          eventTypes: r.eventTypes ?? [],
          enabled: r.enabled ?? true,
          secret: r.secret || undefined,
        },
      });
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["webhooks", activeOrgId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { organizationId: activeOrgId!, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks", activeOrgId] }),
  });

  const test = useMutation({
    mutationFn: (id: string) => testFn({ data: { organizationId: activeOrgId!, id } }),
    onSuccess: (r, id) => {
      setTestResult((p) => ({
        ...p,
        [id]: r.ok ? `OK ${r.statusCode ?? ""} in ${r.latencyMs}ms` : `Failed: ${r.error ?? "unknown"}`,
      }));
      qc.invalidateQueries({ queryKey: ["webhooks", activeOrgId] });
    },
  });

  const rows = q.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Integrations / Automation"
        title="Outbound Webhooks"
        description="Signed HTTP webhooks NorthStar sends to external systems on SAM events. Payloads are signed with HMAC-SHA256 in X-NorthStar-Signature."
      />
      <PageBody>
        <div className="mb-6 flex items-center justify-between">
          <Link to="/sam/integrations" className="text-[12px] text-muted-foreground hover:text-foreground">← Back to Integrations</Link>
          <button
            className="rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90"
            onClick={() => setEditing({ name: "", targetUrl: "", eventTypes: [], enabled: true })}
          >
            New webhook
          </button>
        </div>

        {editing ? <WebhookForm value={editing} onChange={setEditing} onSave={() => save.mutate(editing)} onCancel={() => setEditing(null)} saving={save.isPending} /> : null}

        <Section title={`Configured (${rows.length})`}>
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-border/60 bg-card/50 px-4 py-6 text-center text-[13px] text-muted-foreground">
              No webhooks configured. Add one to receive SAM events at an external URL.
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
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{r.enabled ? "Enabled" : "Disabled"}</div>
                      </div>
                      <div className="mt-1 truncate font-mono text-[12px] text-muted-foreground">{r.targetUrl}</div>
                      {r.description ? <div className="mt-1 text-[12.5px] text-muted-foreground">{r.description}</div> : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.eventTypes.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground italic">No event filter (all events)</span>
                        ) : (
                          r.eventTypes.map((e) => (
                            <span key={e} className="rounded-full border border-border/50 px-2 py-0.5 text-[11px] text-foreground/80">{e}</span>
                          ))
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 text-[11.5px] text-muted-foreground">
                        <div>Secret: <span className={r.hasSecret ? "text-foreground/80" : "text-[oklch(0.75_0.15_75)]"}>{r.hasSecret ? "stored" : "none"}</span></div>
                        <div>Last delivery: {r.lastDeliveryAt ? new Date(r.lastDeliveryAt).toLocaleString() : "never"}</div>
                        {r.lastError ? <div className="col-span-2 text-[oklch(0.5_0.18_27)]">Last error: {r.lastError}</div> : null}
                        {testResult[r.id] ? <div className="col-span-2 text-foreground/80">Test: {testResult[r.id]}</div> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button className="rounded-md border border-border px-2 py-1 text-[11.5px] hover:bg-secondary/60" onClick={() => setEditing({ ...r, secret: "" })}>Edit</button>
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

function WebhookForm({ value, onChange, onSave, onCancel, saving }: {
  value: Partial<WebhookRow> & { secret?: string };
  onChange: (v: Partial<WebhookRow> & { secret?: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const evText = (value.eventTypes ?? []).join(", ");
  return (
    <Section title={value.id ? "Edit webhook" : "New webhook"}>
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-card/50 p-4 md:grid-cols-2">
        <label className="text-[12px] text-muted-foreground">
          Name
          <input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground" value={value.name ?? ""} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </label>
        <label className="text-[12px] text-muted-foreground">
          Target URL (https)
          <input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={value.targetUrl ?? ""} onChange={(e) => onChange({ ...value, targetUrl: e.target.value })} />
        </label>
        <label className="text-[12px] text-muted-foreground md:col-span-2">
          Description
          <input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground" value={value.description ?? ""} onChange={(e) => onChange({ ...value, description: e.target.value })} />
        </label>
        <label className="text-[12px] text-muted-foreground md:col-span-2">
          Event types (comma-separated, empty = all)
          <input className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={evText} onChange={(e) => onChange({ ...value, eventTypes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </label>
        <label className="text-[12px] text-muted-foreground md:col-span-2">
          Signing secret {value.id ? "(leave blank to keep existing)" : "(required to sign payloads)"}
          <input type="password" className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground" value={value.secret ?? ""} onChange={(e) => onChange({ ...value, secret: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <input type="checkbox" checked={value.enabled ?? true} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
          Enabled
        </label>
        <div className="flex items-center justify-end gap-2 md:col-span-2">
          <button className="rounded-md border border-border px-3 py-1.5 text-[12px]" onClick={onCancel}>Cancel</button>
          <button disabled={saving || !value.name || !value.targetUrl} className="rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90 disabled:opacity-50" onClick={onSave}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Section>
  );
}