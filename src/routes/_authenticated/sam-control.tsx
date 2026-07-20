import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import { getSamControlSnapshot } from "@/lib/sam-control/snapshot.functions";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  ListChecks,
  Plug,
  ShieldAlert,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/sam-control")({
  head: () => ({
    meta: [
      { title: "SAM Mega Control Panel - NorthStar Labs" },
      { name: "description", content: "Live visualization of SAM automation, queues, approvals, blockers, and founder controls." },
    ],
  }),
  component: SamControlPage,
});

function SamControlPage() {
  const { activeOrgId } = useOrg();
  const fn = useServerFn(getSamControlSnapshot);
  const q = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["sam-control-snapshot", activeOrgId],
    queryFn: () => fn({ data: { organizationId: activeOrgId! } }),
    refetchInterval: 15000,
  });

  return (
    <AppShell>
      <PageHeader
        title="SAM Mega Control Panel"
        description="One pane of glass across automation, executive intelligence, operators, ventures, approvals, blockers, integrations, and founder controls."
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 space-y-6">
        {!activeOrgId ? (
          <Empty label="Select an organization to load the control panel." />
        ) : q.isLoading ? (
          <Empty label="Loading live snapshot..." />
        ) : q.error ? (
          <Empty label="Failed to load snapshot." tone="danger" />
        ) : q.data ? (
          <Panel data={q.data} />
        ) : null}
      </div>
    </AppShell>
  );
}

type SnapshotData = NonNullable<ReturnType<typeof useQuery<any, any, any, any>>["data"]> extends infer T ? T : any;

function Panel({ data }: { data: any }) {
  const c = data.counts ?? {};
  const jobsQueued = (c.jobs?.queued ?? 0) + (c.jobs?.available ?? 0);
  const jobsRunning = c.jobs?.running ?? 0;
  const jobsFailed = c.jobs?.failed ?? 0;
  const jobsCompleted = c.jobs?.completed ?? 0;
  const health = data.health;
  const healthScore =
    typeof health?.score === "number"
      ? Math.round(health.score)
      : null;

  return (
    <>
      {/* Executive KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Kpi icon={Gauge} label="Health" value={healthScore == null ? "-" : `${healthScore}`} tone="primary" />
        <Kpi icon={Zap} label="Running" value={jobsRunning} />
        <Kpi icon={Clock} label="Queued" value={jobsQueued} />
        <Kpi icon={AlertTriangle} label="Failed" value={jobsFailed} tone={jobsFailed ? "danger" : "muted"} />
        <Kpi icon={CheckCircle2} label="Completed" value={jobsCompleted} tone="success" />
        <Kpi icon={ListChecks} label="Approvals" value={c.pendingApprovals ?? 0} tone={c.pendingApprovals ? "warning" : "muted"} />
        <Kpi icon={ShieldAlert} label="Blockers" value={(c.blockedConnections ?? 0) + (c.activeKillSwitches ?? 0)} tone={((c.blockedConnections ?? 0) + (c.activeKillSwitches ?? 0)) ? "danger" : "muted"} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Live Automation + Queue */}
        <Card title="Live Automation" icon={Activity} className="xl:col-span-2">
          <QueueStrip counts={c.jobs ?? {}} />
          <div className="mt-4">
            <SectionLabel>Recent jobs</SectionLabel>
            <JobsTable rows={data.jobs ?? []} />
          </div>
        </Card>

        {/* Executive */}
        <Card title="Executive Dashboard" icon={Sparkles}>
          {health ? (
            <div>
              <div className="text-[42px] font-display leading-none text-foreground">
                {healthScore ?? "-"}
              </div>
              <div className="mt-1 text-[11.5px] uppercase tracking-[0.18em] text-muted-foreground">
                Executive Health · {new Date(health.computed_at).toLocaleString()}
              </div>
              {health.breakdown && typeof health.breakdown === "object" ? (
                <ul className="mt-4 space-y-1.5">
                  {Object.entries(health.breakdown as Record<string, any>).slice(0, 6).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between text-[12px]">
                      <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                      <span className="font-mono">{typeof v === "number" ? Math.round(v) : String(v)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <Empty label="No health snapshot yet." small />
          )}
          <div className="mt-5">
            <SectionLabel>Open insights ({data.insights?.length ?? 0})</SectionLabel>
            <ul className="mt-2 space-y-1.5 max-h-64 overflow-auto">
              {(data.insights ?? []).slice(0, 12).map((i: any) => (
                <li key={i.id} className="flex items-start gap-2 text-[12px]">
                  <SeverityDot severity={i.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">{i.title}</div>
                    <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">{i.kind} · {i.status}</div>
                  </div>
                </li>
              ))}
              {!(data.insights ?? []).length && <EmptyLi>No insights.</EmptyLi>}
            </ul>
          </div>
        </Card>

        {/* Operator */}
        <Card title="Operator Dashboard" icon={Users}>
          <div className="grid grid-cols-3 gap-2 text-center">
            {["queued", "in_progress", "blocked"].map((s) => (
              <div key={s} className="rounded-md border border-border/60 bg-card/40 p-2.5">
                <div className="text-[18px] font-display">{c.operatorTasks?.[s] ?? 0}</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{s.replace("_", " ")}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <SectionLabel>Recent tasks</SectionLabel>
            <ul className="mt-2 space-y-1.5 max-h-72 overflow-auto">
              {(data.operatorTasks ?? []).slice(0, 15).map((t: any) => (
                <li key={t.id} className="flex items-start gap-2 text-[12px]">
                  <StatusPill status={t.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">{t.title ?? t.kind}</div>
                    <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">{t.kind}</div>
                  </div>
                </li>
              ))}
              {!(data.operatorTasks ?? []).length && <EmptyLi>No operator tasks.</EmptyLi>}
            </ul>
          </div>
        </Card>

        {/* Ventures */}
        <Card title="Venture Dashboard" icon={Building2}>
          <ul className="space-y-1.5 max-h-96 overflow-auto">
            {(data.ventures ?? []).map((v: any) => (
              <li key={v.id} className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 px-3 py-2 text-[12.5px]">
                <div className="min-w-0">
                  <div className="truncate text-foreground">{v.name}</div>
                  <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">{v.stage ?? v.status ?? "-"}</div>
                </div>
              </li>
            ))}
            {!(data.ventures ?? []).length && <EmptyLi>No ventures.</EmptyLi>}
          </ul>
        </Card>

        {/* Approvals */}
        <Card title="Approvals" icon={ListChecks}>
          <ul className="space-y-1.5 max-h-96 overflow-auto">
            {(data.approvals ?? []).map((a: any) => (
              <li key={a.id} className="rounded-md border border-border/40 bg-card/40 px-3 py-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <StatusPill status={a.status} />
                  <span className="text-[10.5px] text-muted-foreground">{new Date(a.requested_at ?? a.decided_at ?? Date.now()).toLocaleString()}</span>
                </div>
                {a.notes ? <div className="mt-1 truncate text-muted-foreground">{a.notes}</div> : null}
              </li>
            ))}
            {!(data.approvals ?? []).length && <EmptyLi>No approvals pending.</EmptyLi>}
          </ul>
        </Card>

        {/* Blockers */}
        <Card title="Blockers" icon={ShieldAlert}>
          <BlockerList data={data} />
        </Card>

        {/* Integrations */}
        <Card title="Integration Dashboard" icon={Plug} className="xl:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(data.integrations ?? []).map((i: any) => (
              <div key={i.id} className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 px-3 py-2 text-[12.5px]">
                <div className="min-w-0">
                  <div className="truncate text-foreground">{i.display_name ?? i.provider}</div>
                  <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">{i.provider}</div>
                </div>
                <StatusPill status={i.status} />
              </div>
            ))}
            {!(data.integrations ?? []).length && <EmptyLi>No integrations.</EmptyLi>}
          </div>
        </Card>

        {/* Founder Controls */}
        <Card title="Founder Controls" icon={ShieldAlert}>
          <SectionLabel>Kill switches</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {(data.killSwitches ?? []).slice(0, 8).map((k: any) => (
              <li key={k.id} className="flex items-center justify-between text-[12px]">
                <span className="truncate text-foreground">{k.target ?? k.scope}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] uppercase tracking-[0.16em]", k.engaged ? "bg-[oklch(0.5_0.18_27)]/15 text-[oklch(0.72_0.18_27)]" : "bg-secondary/60 text-muted-foreground")}>
                  {k.engaged ? "Engaged" : "Off"}
                </span>
              </li>
            ))}
            {!(data.killSwitches ?? []).length && <EmptyLi>None.</EmptyLi>}
          </ul>
          <div className="mt-4">
            <SectionLabel>Autonomy modes</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {(data.autonomy ?? []).slice(0, 8).map((a: any) => (
                <li key={a.id} className="flex items-center justify-between text-[12px]">
                  <span className="truncate text-muted-foreground">{a.scope}</span>
                  <span className="font-mono text-foreground">{a.mode}</span>
                </li>
              ))}
              {!(data.autonomy ?? []).length && <EmptyLi>Defaults.</EmptyLi>}
            </ul>
          </div>
        </Card>

        {/* Monitoring */}
        <Card title="Monitoring" icon={Cpu}>
          <SectionLabel>Recent SAM invocations</SectionLabel>
          <ul className="mt-2 space-y-1.5 max-h-56 overflow-auto">
            {(data.invocations ?? []).slice(0, 10).map((i: any) => (
              <li key={i.id} className="flex items-center justify-between text-[12px]">
                <span className="truncate text-muted-foreground">{i.model ?? "-"}</span>
                <span className="font-mono text-foreground">{i.latency_ms ?? "-"}ms · {i.status}</span>
              </li>
            ))}
            {!(data.invocations ?? []).length && <EmptyLi>Idle.</EmptyLi>}
          </ul>
          <div className="mt-4">
            <SectionLabel>Workflow runs</SectionLabel>
            <ul className="mt-2 space-y-1.5 max-h-56 overflow-auto">
              {(data.workflowRuns ?? []).slice(0, 10).map((r: any) => (
                <li key={r.id} className="flex items-center justify-between text-[12px]">
                  <span className="truncate text-foreground">{r.workflow}</span>
                  <StatusPill status={r.status} />
                </li>
              ))}
              {!(data.workflowRuns ?? []).length && <EmptyLi>None.</EmptyLi>}
            </ul>
          </div>
        </Card>

        {/* Live Execution Timeline */}
        <Card title="Live Execution Timeline" icon={Activity} className="xl:col-span-3">
          <ul className="relative border-l border-border/50 pl-4 space-y-2 max-h-[520px] overflow-auto">
            {(data.activity ?? []).map((e: any) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
                <div className="text-[12.5px] text-foreground">{humanizeAction(e.action)}</div>
                <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  {e.entity_type} · {new Date(e.created_at).toLocaleString()}
                </div>
              </li>
            ))}
            {!(data.activity ?? []).length && <EmptyLi>No activity yet.</EmptyLi>}
          </ul>
        </Card>
      </div>
    </>
  );
}

function humanizeAction(a: string) {
  return (a ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Card({ title, icon: Icon, children, className }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border/50 bg-card/50 p-5", className)}>
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <h2 className="font-display text-[15px] tracking-tight text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Icon, label, value, tone = "default" }: { icon: any; label: string; value: any; tone?: "default" | "primary" | "success" | "warning" | "danger" | "muted" }) {
  const toneCls =
    tone === "primary" ? "text-primary" :
    tone === "success" ? "text-[oklch(0.72_0.14_155)]" :
    tone === "warning" ? "text-[oklch(0.78_0.14_85)]" :
    tone === "danger" ? "text-[oklch(0.72_0.18_27)]" :
    tone === "muted" ? "text-muted-foreground" :
    "text-foreground";
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3 w-3" strokeWidth={2} />
        {label}
      </div>
      <div className={cn("mt-1 font-display text-[26px] leading-none", toneCls)}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{children}</div>;
}

function EmptyLi({ children }: { children: React.ReactNode }) {
  return <li className="text-[11.5px] text-muted-foreground italic">{children}</li>;
}

function Empty({ label, tone, small }: { label: string; tone?: "danger"; small?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border/40 bg-card/30 px-5 text-center text-muted-foreground",
      small ? "py-6 text-[12px]" : "py-16 text-[13px]",
      tone === "danger" && "text-[oklch(0.72_0.18_27)] border-[oklch(0.5_0.18_27)]/40")}>
      {label}
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const s = (status ?? "unknown").toLowerCase();
  const cls =
    s === "completed" || s === "connected" || s === "approved" || s === "done" || s === "succeeded"
      ? "bg-[oklch(0.72_0.14_155)]/15 text-[oklch(0.78_0.14_155)]"
      : s === "running" || s === "in_progress" || s === "testing"
        ? "bg-primary/15 text-primary"
        : s === "failed" || s === "error" || s === "blocked" || s === "rejected"
          ? "bg-[oklch(0.5_0.18_27)]/15 text-[oklch(0.78_0.18_27)]"
          : s === "pending" || s === "queued" || s === "available" || s === "requested"
            ? "bg-[oklch(0.78_0.14_85)]/15 text-[oklch(0.82_0.14_85)]"
            : "bg-secondary/60 text-muted-foreground";
  return <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] uppercase tracking-[0.14em]", cls)}>{s.replace(/_/g, " ")}</span>;
}

function SeverityDot({ severity }: { severity?: string | null }) {
  const s = (severity ?? "info").toLowerCase();
  const cls =
    s === "critical" ? "bg-[oklch(0.6_0.2_27)]" :
    s === "high" ? "bg-[oklch(0.7_0.18_40)]" :
    s === "medium" ? "bg-[oklch(0.78_0.14_85)]" :
    s === "low" ? "bg-[oklch(0.72_0.14_155)]" :
    "bg-muted-foreground";
  return <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", cls)} />;
}

function QueueStrip({ counts }: { counts: Record<string, number> }) {
  const buckets: { key: string; label: string; tone: string }[] = [
    { key: "queued", label: "Queued", tone: "bg-[oklch(0.78_0.14_85)]" },
    { key: "available", label: "Available", tone: "bg-[oklch(0.78_0.14_85)]/70" },
    { key: "running", label: "Running", tone: "bg-primary" },
    { key: "completed", label: "Completed", tone: "bg-[oklch(0.72_0.14_155)]" },
    { key: "failed", label: "Failed", tone: "bg-[oklch(0.6_0.2_27)]" },
    { key: "cancelled", label: "Cancelled", tone: "bg-muted-foreground/50" },
  ];
  const total = Math.max(1, buckets.reduce((s, b) => s + (counts[b.key] ?? 0), 0));
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/40">
        {buckets.map((b) => {
          const v = counts[b.key] ?? 0;
          const pct = (v / total) * 100;
          if (!pct) return null;
          return <div key={b.key} className={cn("h-full", b.tone)} style={{ width: `${pct}%` }} title={`${b.label}: ${v}`} />;
        })}
      </div>
      <div className="mt-2 grid grid-cols-3 md:grid-cols-6 gap-2">
        {buckets.map((b) => (
          <div key={b.key} className="flex items-center gap-1.5 text-[11px]">
            <span className={cn("h-1.5 w-1.5 rounded-full", b.tone)} />
            <span className="text-muted-foreground">{b.label}</span>
            <span className="ml-auto font-mono text-foreground">{counts[b.key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobsTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <EmptyLi>No jobs recorded.</EmptyLi>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <tr className="border-b border-border/40">
            <th className="py-1.5 text-left font-normal">Job</th>
            <th className="py-1.5 text-left font-normal">Status</th>
            <th className="py-1.5 text-left font-normal">Attempt</th>
            <th className="py-1.5 text-left font-normal">Started</th>
            <th className="py-1.5 text-left font-normal">Error</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((j) => (
            <tr key={j.id} className="border-b border-border/20">
              <td className="py-1.5 truncate max-w-[240px] text-foreground">{j.job_type}</td>
              <td className="py-1.5"><StatusPill status={j.status} /></td>
              <td className="py-1.5 font-mono text-muted-foreground">{j.attempt_number}/{j.max_attempts}</td>
              <td className="py-1.5 text-muted-foreground">{j.started_at ? new Date(j.started_at).toLocaleTimeString() : "-"}</td>
              <td className="py-1.5 text-[oklch(0.78_0.18_27)] truncate max-w-[200px]">{j.error_code ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockerList({ data }: { data: any }) {
  const failedJobs = (data.jobs ?? []).filter((j: any) => j.status === "failed").slice(0, 6);
  const blockedTasks = (data.operatorTasks ?? []).filter((t: any) => t.status === "blocked").slice(0, 6);
  const brokenConn = (data.integrations ?? []).filter((c: any) => c.status === "error" || c.status === "blocked").slice(0, 6);
  const engagedKills = (data.killSwitches ?? []).filter((k: any) => k.engaged).slice(0, 6);
  const empty = !failedJobs.length && !blockedTasks.length && !brokenConn.length && !engagedKills.length;
  if (empty) return <div className="rounded-md border border-[oklch(0.72_0.14_155)]/30 bg-[oklch(0.72_0.14_155)]/5 p-3 text-[12px] text-[oklch(0.82_0.14_155)]">No active blockers.</div>;
  return (
    <div className="space-y-3">
      {failedJobs.length ? (
        <div>
          <SectionLabel>Failed jobs</SectionLabel>
          <ul className="mt-1 space-y-1 text-[12px]">
            {failedJobs.map((j: any) => (
              <li key={j.id} className="flex items-center justify-between">
                <span className="truncate text-foreground">{j.job_type}</span>
                <span className="text-[oklch(0.78_0.18_27)] font-mono text-[11px]">{j.error_code ?? "error"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {blockedTasks.length ? (
        <div>
          <SectionLabel>Blocked operator tasks</SectionLabel>
          <ul className="mt-1 space-y-1 text-[12px]">
            {blockedTasks.map((t: any) => (
              <li key={t.id} className="truncate text-foreground">{t.title ?? t.kind}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {brokenConn.length ? (
        <div>
          <SectionLabel>Broken integrations</SectionLabel>
          <ul className="mt-1 space-y-1 text-[12px]">
            {brokenConn.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className="truncate text-foreground">{c.display_name ?? c.provider}</span>
                <StatusPill status={c.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {engagedKills.length ? (
        <div>
          <SectionLabel>Kill switches engaged</SectionLabel>
          <ul className="mt-1 space-y-1 text-[12px]">
            {engagedKills.map((k: any) => (
              <li key={k.id} className="truncate text-foreground">{k.target ?? k.scope}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}