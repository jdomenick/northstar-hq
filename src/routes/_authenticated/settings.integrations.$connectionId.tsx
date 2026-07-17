import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ChevronLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import {
  EditorialSkeleton,
  EmptyEditorialState,
  ErrorLine,
  HairlineSection,
  Ledger,
  MetadataRow,
  SectionLabel,
  StatusLine,
  type StatusTone,
} from "@/components/editorial";
import { useOrg } from "@/lib/org-context";
import {
  archiveWebsiteConnection,
  getWebsiteConnection,
  runWebsiteDiscoveryNow,
  updateConnectionAutomation,
} from "@/lib/integrations/website.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/integrations/$connectionId")({
  component: ConnectionDetail,
  head: () => ({ meta: [{ title: "Connection - Automation - Northstar" }] }),
});

const DISCOVERY_TONE: Record<string, StatusTone> = {
  pending: "muted",
  running: "attention",
  completed: "positive",
  failed: "critical",
};

const RUN_TONE: Record<string, StatusTone> = {
  running: "attention",
  succeeded: "positive",
  failed: "critical",
  canceled: "muted",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "-";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

function ConnectionDetail() {
  const { connectionId } = Route.useParams();
  const { activeOrgId } = useOrg();
  const nav = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(getWebsiteConnection);
  const runFn = useServerFn(runWebsiteDiscoveryNow);
  const modeFn = useServerFn(updateConnectionAutomation);
  const archiveFn = useServerFn(archiveWebsiteConnection);

  const q = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["website-connection", activeOrgId, connectionId],
    queryFn: () =>
      getFn({ data: { organizationId: activeOrgId!, connectionId } }),
  });

  const runNow = useMutation({
    mutationFn: () =>
      runFn({ data: { organizationId: activeOrgId!, connectionId } }),
    onSuccess: () => {
      toast.success("Discovery started");
      qc.invalidateQueries({ queryKey: ["website-connection", activeOrgId, connectionId] });
      qc.invalidateQueries({ queryKey: ["website-connections", activeOrgId] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to run"),
  });

  const setMode = useMutation({
    mutationFn: (mode: string) =>
      modeFn({
        data: {
          organizationId: activeOrgId!,
          connectionId,
          automationMode: mode as "manual" | "scheduled" | "paused",
        },
      }),
    onSuccess: () => {
      toast.success("Automation updated");
      qc.invalidateQueries({ queryKey: ["website-connection", activeOrgId, connectionId] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const archive = useMutation({
    mutationFn: () =>
      archiveFn({ data: { organizationId: activeOrgId!, connectionId } }),
    onSuccess: () => {
      toast.success("Archived");
      nav({ to: "/settings/integrations" });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed"),
  });

  if (q.isLoading) {
    return (
      <PageBody>
        <EditorialSkeleton rows={4} />
      </PageBody>
    );
  }
  if (q.error) {
    return (
      <PageBody>
        <ErrorLine message={(q.error as Error).message} />
      </PageBody>
    );
  }
  if (!q.data) {
    return (
      <PageBody>
        <p className="text-[14px] italic text-foreground/70">Connection not found.</p>
      </PageBody>
    );
  }

  const { connection, sources, runs } = q.data;
  const lastRun = runs[0];
  const successfulRuns = runs.filter((r) => r.status === "succeeded").length;
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const isRunning = connection.discovery_status === "running";

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/settings/integrations"
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.22em] text-foreground/60 hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Automation
          </Link>
        </div>
      </div>
      <PageHeader
        eyebrow="Connection"
        title={connection.display_name}
        description={connection.homepage_url ?? "No homepage recorded."}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => runNow.mutate()}
              disabled={isRunning || runNow.isPending}
              className="inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:border-foreground/30 disabled:bg-foreground/30"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", (isRunning || runNow.isPending) && "animate-spin")}
                strokeWidth={1.5}
              />
              {isRunning ? "Running." : "Run discovery"}
            </button>
            <button
              onClick={() => {
                if (!confirm("Archive this connection?")) return;
                archive.mutate();
              }}
              className="inline-flex items-center gap-1.5 border border-foreground/25 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-foreground/70 hover:border-foreground hover:text-foreground"
            >
              <Archive className="h-3.5 w-3.5" strokeWidth={1.5} /> Archive
            </button>
          </div>
        }
      />
      <PageBody>
        <div className="mb-10 flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusLine tone={DISCOVERY_TONE[connection.discovery_status] ?? "neutral"}>
            Discovery {connection.discovery_status}
          </StatusLine>
          <StatusLine tone={connection.status === "archived" ? "muted" : "positive"}>
            {connection.status}
          </StatusLine>
          <span className="text-[11px] uppercase tracking-[0.22em] text-foreground/55">
            Mode - {connection.automation_mode}
          </span>
          {connection.discovery_error_code && (
            <span className="text-[11px] uppercase tracking-[0.22em] text-[oklch(0.5_0.18_27)]">
              Last error - {connection.discovery_error_code}
            </span>
          )}
        </div>

        <HairlineSection label="Health">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <StatBlock label="Sources discovered" value={sources.length} />
            <StatBlock label="Total runs" value={runs.length} />
            <StatBlock label="Successful" value={successfulRuns} tone="positive" />
            <StatBlock
              label="Failed"
              value={failedRuns}
              tone={failedRuns > 0 ? "critical" : "muted"}
            />
          </div>
        </HairlineSection>

        <HairlineSection label="Schedule">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <label className="block">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
                Automation mode
              </div>
              <select
                value={connection.automation_mode}
                onChange={(e) => setMode.mutate(e.target.value)}
                disabled={setMode.isPending}
                className="w-full border-b border-foreground/30 bg-transparent px-1 py-2 text-[14px] text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
              >
                <option value="manual">Manual - never runs on its own</option>
                <option value="scheduled">Scheduled - runs periodically</option>
                <option value="paused">Paused - held until resumed</option>
              </select>
            </label>
            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
                Last successful sync
              </div>
              <div className="border-b border-foreground/25 py-2 text-[14px] tabular-nums text-foreground">
                {formatDateTime(connection.last_successful_sync_at)}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
                Discovery completed
              </div>
              <div className="border-b border-foreground/25 py-2 text-[14px] tabular-nums text-foreground">
                {formatDateTime(connection.discovery_completed_at)}
              </div>
            </div>
          </div>
          {isRunning && (
            <p className="mt-6 text-[13px] italic text-foreground/70">
              Discovery is running now. Refresh in a moment to see results.
            </p>
          )}
        </HairlineSection>

        <HairlineSection label="Run history" action={<span>{runs.length}</span>}>
          {runs.length === 0 ? (
            <p className="text-[13.5px] italic text-foreground/60">
              No runs recorded. Start one from the header to discover sources.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-t border-foreground/15 text-[13px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.22em] text-foreground/55">
                    <th className="border-b border-foreground/15 py-2 pr-6 text-left font-medium">Started</th>
                    <th className="border-b border-foreground/15 py-2 pr-6 text-left font-medium">Trigger</th>
                    <th className="border-b border-foreground/15 py-2 pr-6 text-left font-medium">Status</th>
                    <th className="border-b border-foreground/15 py-2 pr-6 text-right font-medium">Duration</th>
                    <th className="border-b border-foreground/15 py-2 pr-6 text-right font-medium">Found</th>
                    <th className="border-b border-foreground/15 py-2 pr-6 text-right font-medium">Created</th>
                    <th className="border-b border-foreground/15 py-2 pr-6 text-right font-medium">Skipped</th>
                    <th className="border-b border-foreground/15 py-2 text-left font-medium">Failure</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b border-foreground/10">
                      <td className="py-3 pr-6 tabular-nums text-foreground/85">
                        {formatDateTime(r.started_at)}
                      </td>
                      <td className="py-3 pr-6 text-foreground/70">{r.trigger_type}</td>
                      <td className="py-3 pr-6">
                        <StatusLine tone={RUN_TONE[r.status] ?? "neutral"}>{r.status}</StatusLine>
                      </td>
                      <td className="py-3 pr-6 text-right tabular-nums text-foreground/70">
                        {formatDuration(r.duration_ms)}
                      </td>
                      <td className="py-3 pr-6 text-right tabular-nums text-foreground/70">
                        {r.records_discovered ?? 0}
                      </td>
                      <td className="py-3 pr-6 text-right tabular-nums text-foreground/70">
                        {r.records_created ?? 0}
                      </td>
                      <td className="py-3 pr-6 text-right tabular-nums text-foreground/70">
                        {r.records_skipped ?? 0}
                      </td>
                      <td className="py-3 text-[12px] text-[oklch(0.5_0.18_27)]">
                        {r.failure_code ?? ""}
                        {r.failure_message ? ` - ${r.failure_message}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </HairlineSection>

        <HairlineSection label="Discovered sources" action={<span>{sources.length}</span>}>
          {sources.length === 0 ? (
            <EmptyEditorialState
              eyebrow="Nothing yet"
              title="No sources discovered."
              description="Run discovery to catalog pages from this connection."
            />
          ) : (
            <Ledger className="border-t border-foreground/15">
              {sources.map((s, i) => (
                <li key={s.id} className="py-4">
                  <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-4 md:gap-6">
                    <span className="pt-1 font-display text-[14px] leading-none text-foreground/40 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
                        {s.page_type ?? "page"}
                        {s.category ? ` - ${s.category}` : ""}
                      </div>
                      <div className="mt-1 truncate text-[14.5px] text-foreground">
                        {s.title ?? s.source_url}
                      </div>
                      <a
                        href={s.source_url ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-[12px] italic text-foreground/60 underline-offset-4 hover:underline"
                      >
                        {s.source_url}
                      </a>
                    </div>
                    <div className="shrink-0 text-right text-[11px] uppercase tracking-[0.18em] text-foreground/60">
                      <div className="tabular-nums">
                        Relevance {(s.relevance_score ?? 0).toFixed(2)}
                      </div>
                      <div className="mt-1 tabular-nums text-foreground/45">
                        HTTP {s.http_status ?? "-"}
                      </div>
                      <div className="mt-1 text-foreground/45">
                        {s.sync_enabled ? "Sync on" : "Sync off"}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </Ledger>
          )}
        </HairlineSection>

        <HairlineSection label="Last run detail">
          {!lastRun ? (
            <p className="text-[13.5px] italic text-foreground/60">No runs yet.</p>
          ) : (
            <MetadataRow
              items={[
                { label: "Started", value: formatDateTime(lastRun.started_at) },
                { label: "Completed", value: formatDateTime(lastRun.completed_at) },
                { label: "Duration", value: formatDuration(lastRun.duration_ms) },
                {
                  label: "Status",
                  value: (
                    <StatusLine tone={RUN_TONE[lastRun.status] ?? "neutral"}>
                      {lastRun.status}
                    </StatusLine>
                  ),
                },
              ]}
            />
          )}
        </HairlineSection>
      </PageBody>
    </div>
  );
}

function StatBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: StatusTone;
}) {
  const toneClass =
    tone === "critical"
      ? "text-[oklch(0.5_0.18_27)]"
      : tone === "positive"
        ? "text-[oklch(0.5_0.14_150)]"
        : tone === "attention"
          ? "text-[oklch(0.55_0.14_65)]"
          : tone === "muted"
            ? "text-foreground/40"
            : "text-foreground";
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-foreground/55">
        {label}
      </div>
      <div className={`mt-3 font-display text-[36px] leading-none tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}