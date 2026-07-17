import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import {
  getWebsiteConnection,
  runWebsiteDiscoveryNow,
  updateConnectionAutomation,
} from "@/lib/integrations/website.functions";

export const Route = createFileRoute("/_authenticated/settings/integrations/$connectionId")({
  component: ConnectionDetail,
  head: () => ({
    meta: [
      { title: "Website connection  -  Northstar" },
      { name: "description", content: "Review discovered pages and manage this website connection." },
    ],
  }),
});

function ConnectionDetail() {
  const { connectionId } = Route.useParams();
  const { activeOrgId } = useOrg();
  const qc = useQueryClient();
  const get = useServerFn(getWebsiteConnection);
  const runNow = useServerFn(runWebsiteDiscoveryNow);
  const updateMode = useServerFn(updateConnectionAutomation);

  const { data, isLoading, refetch } = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["website-connection", activeOrgId, connectionId],
    queryFn: () => get({ data: { organizationId: activeOrgId!, connectionId } }),
  });

  const runMutation = useMutation({
    mutationFn: () => runNow({ data: { organizationId: activeOrgId!, connectionId } }),
    onSuccess: (res) => {
      toast.success(`Discovery complete. ${res.totalCreated} sources catalogued.`);
      qc.invalidateQueries({ queryKey: ["website-connection"] });
      qc.invalidateQueries({ queryKey: ["website-connections"] });
    },
    onError: (err: unknown) => {
      const code = (err as { code?: string; message?: string })?.code ?? (err as { message?: string })?.message ?? "Discovery failed";
      toast.error(String(code));
      refetch();
    },
  });

  const modeMutation = useMutation({
    mutationFn: (mode: "suggest" | "auto_accept" | "off") =>
      updateMode({ data: { organizationId: activeOrgId!, connectionId, automationMode: mode } }),
    onSuccess: () => {
      toast.success("Automation mode updated");
      qc.invalidateQueries({ queryKey: ["website-connection"] });
    },
  });

  if (!activeOrgId || isLoading || !data) {
    return (
      <div>
        <PageHeader eyebrow="Settings / Integrations" title="Loading..." />
      </div>
    );
  }

  const c = data.connection;
  return (
    <div>
      <PageHeader
        eyebrow="Settings / Integrations"
        title={c.display_name}
        description={c.homepage_url ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/settings/integrations"
              className="rounded-md px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              Back
            </Link>
            <button
              disabled={runMutation.isPending || c.discovery_status === "running"}
              onClick={() => runMutation.mutate()}
              className="rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background hover:opacity-90 disabled:opacity-50"
            >
              {runMutation.isPending || c.discovery_status === "running" ? "Discovering..." : "Run discovery now"}
            </button>
          </div>
        }
      />
      <PageBody>
        <Section title="Status">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatusCard label="Discovery" value={c.discovery_status} />
            <StatusCard label="Automation" value={c.automation_mode} />
            <StatusCard label="Last successful sync" value={c.last_successful_sync_at ? new Date(c.last_successful_sync_at).toLocaleString() : "Never"} />
          </div>
          {c.discovery_error_code && (
            <div className="mt-3 rounded-md bg-destructive/10 px-4 py-3 text-[12.5px] text-destructive">
              Last error: {c.discovery_error_code}
            </div>
          )}
        </Section>

        <Section title="Automation mode">
          <div className="flex flex-wrap gap-2">
            {(["suggest", "auto_accept", "off"] as const).map((m) => (
              <button
                key={m}
                onClick={() => modeMutation.mutate(m)}
                disabled={modeMutation.isPending}
                className={
                  c.automation_mode === m
                    ? "rounded-md bg-foreground px-3 py-1.5 text-[12px] text-background"
                    : "rounded-md bg-secondary/60 px-3 py-1.5 text-[12px] text-foreground hover:bg-secondary"
                }
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            Automation applies to future phases. Right now discovery is manual and no operational records are created.
          </p>
        </Section>

        <Section title={`Discovered pages (${data.sources.length})`}>
          {data.sources.length === 0 ? (
            <div className="rounded-xl bg-card/40 p-6 text-[13px] text-muted-foreground">
              No pages discovered yet. Click Run discovery now to begin.
            </div>
          ) : (
            <div className="divide-y divide-border/40 overflow-hidden rounded-xl bg-card/40">
              {data.sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-foreground">{s.title}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.source_url}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded bg-secondary/60 px-1.5 py-0.5">{s.page_type ?? "other"}</span>
                    <span className="rounded bg-secondary/60 px-1.5 py-0.5">{s.category ?? " - "}</span>
                    <span className="tabular-nums">{Number(s.relevance_score ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Recent discovery runs">
          {data.runs.length === 0 ? (
            <div className="rounded-xl bg-card/40 p-6 text-[13px] text-muted-foreground">No runs yet.</div>
          ) : (
            <div className="divide-y divide-border/40 overflow-hidden rounded-xl bg-card/40">
              {data.runs.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3 text-[12px]">
                  <div className="text-foreground">{r.status}</div>
                  <div className="text-muted-foreground">
                    {r.completed_at ? new Date(r.completed_at).toLocaleString() : (r.started_at ? new Date(r.started_at).toLocaleString() : " - ")}
                    {r.records_created != null && (
                      <span className="ml-3">{r.records_created} created / {r.records_discovered} discovered</span>
                    )}
                    {r.failure_code && <span className="ml-3 text-destructive">{r.failure_code}</span>}
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

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/40 px-5 py-4">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className="mt-1 text-[13.5px] text-foreground">{value}</div>
    </div>
  );
}