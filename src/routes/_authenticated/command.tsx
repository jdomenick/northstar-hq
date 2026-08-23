import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bell, Download } from "lucide-react";
import { useOrg } from "@/lib/org-context";
import { cn } from "@/lib/utils";
import { KpiCard, MiniStat, Panel } from "@/components/command/dash-ui";
import { DONUT_COLORS, DonutChart, TrendChart } from "@/components/command/charts";
import { ClientWorkspacePanel } from "@/components/command/client-workspace-panel";
import { ModulePreviewRow } from "@/components/command/module-preview-row";
import { Delta } from "@/components/command/dash-ui";
import {
  DEMO_COMMAND_KPIS,
  DEMO_OPERATIONAL_CARDS,
  DEMO_REVENUE_BY_SOURCE,
  DEMO_REVENUE_TREND,
  DEMO_TOP_CLIENTS,
} from "@/lib/command/demo-data";
import { deriveClientHealth, money, useCommandOverview } from "@/lib/command/hooks";

export const Route = createFileRoute("/_authenticated/command")({
  component: CommandPage,
  head: () => ({
    meta: [
      { title: "Command Center | NorthStar" },
      {
        name: "description",
        content:
          "The primary internal NorthStar Command Center across clients, modules, revenue, operations, and SAM Core.",
      },
      { property: "og:title", content: "Command Center | NorthStar" },
      {
        property: "og:description",
        content:
          "The primary internal NorthStar Command Center across clients, modules, revenue, operations, and SAM Core.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const DATE_RANGES = [
  { value: "mtd", label: "Month to date" },
  { value: "30d", label: "Last 30 days" },
  { value: "qtd", label: "Quarter to date" },
  { value: "ytd", label: "Year to date" },
];

function selectClass() {
  return "h-7 rounded-[6px] border border-border/70 bg-card/60 px-2 text-[11px] text-foreground outline-none hover:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary";
}

function CommandPage() {
  const { activeOrgId } = useOrg();
  const q = useCommandOverview(activeOrgId);
  const [clientFilter, setClientFilter] = useState("all");
  const [range, setRange] = useState("mtd");

  const d = q.data;
  const clients = d?.clients.data ?? [];
  const health = useMemo(() => (d ? deriveClientHealth(d) : []), [d]);

  const activeClients = clients.filter((c) => c.status === "active");
  const jobs = d?.jobs24h.data ?? [];
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const connections = d?.connections.data ?? [];
  const brokenConnections = connections.filter(
    (c) => c.status === "error" || Boolean(c.last_error_at),
  );
  const approvals = (d?.approvals.data ?? []).filter(
    (t) => t.requires_approval && !t.approved_at,
  );
  const openAlerts = failedJobs.length + brokenConnections.length;

  const selectedClientName =
    clientFilter === "all"
      ? undefined
      : (clients.find((c) => c.id === clientFilter)?.name ?? undefined);

  function exportCsv() {
    const rows = [
      ["Client", "Status", "Current issue", "MRR (cents)"],
      ...health.map((c) => [
        c.name,
        c.status,
        c.issue ?? "",
        String(c.mrrCents ?? 0),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `northstar-command-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!activeOrgId) {
    return (
      <div className="p-4 text-[12.5px] text-muted-foreground">
        Select an organization to open the Command Center.
      </div>
    );
  }

  const donutTotal = DEMO_REVENUE_BY_SOURCE.reduce((n, s) => n + s.value, 0);

  return (
    <div className="min-w-0 px-2.5 pb-6 pt-2.5 md:px-3">
      {/* Header row */}
      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-[7px] border border-border/70 bg-card/50 px-3 py-2">
        <div className="min-w-0">
          <h1 className="truncate font-display text-[17px] leading-none text-foreground">
            Command Center
          </h1>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Overview
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label="Client filter"
            className={selectClass()}
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Date range"
            className={selectClass()}
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-border/70 bg-card/60 px-2.5 text-[11px] text-foreground hover:border-primary/40"
          >
            <Download className="h-3 w-3" strokeWidth={1.9} />
            Export
          </button>
          <Link
            to="/labs/mission-control"
            aria-label={`Notifications, ${approvals.length} waiting`}
            className="relative grid h-7 w-7 place-items-center rounded-[6px] border border-border/70 bg-card/60 text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={1.9} />
            {approvals.length > 0 && (
              <span className="absolute -right-1 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-destructive px-1 text-[8px] font-semibold text-destructive-foreground">
                {approvals.length}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Top section: Command Center + Client Workspace */}
      <div className="grid min-w-0 gap-2.5 xl:grid-cols-[1.18fr_1fr]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {/* KPI row */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
              Portfolio metrics
            </span>
            <DemoBadge />
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 2xl:grid-cols-6">
            {DEMO_COMMAND_KPIS.map((k) => (
              <KpiCard
                key={k.key}
                label={k.label}
                value={k.value}
                delta={k.delta}
                series={k.series}
              />
            ))}
            <KpiCard
              label="Active Clients"
              value={q.isLoading ? "—" : String(activeClients.length)}
              hint={`${clients.length} on record`}
            />
            <KpiCard
              label="Open Alerts"
              value={q.isLoading ? "—" : String(openAlerts)}
              tone={openAlerts > 0 ? "alert" : "default"}
              hint={`${failedJobs.length} failures · ${brokenConnections.length} integrations`}
            />
          </div>

          {/* Charts + top clients */}
          <div className="grid min-w-0 gap-2.5 lg:grid-cols-[1.25fr_0.85fr_1.15fr]">
            <Panel title="Revenue Trend" subtitle="Trailing 12 months" demo bodyClassName="p-2.5">
              <TrendChart data={DEMO_REVENUE_TREND} valuePrefix="$" />
            </Panel>

            <Panel title="Revenue by Source" demo bodyClassName="p-2.5">
              <DonutChart data={DEMO_REVENUE_BY_SOURCE} height={104} />
              <ul className="mt-1.5 space-y-[3px]">
                {DEMO_REVENUE_BY_SOURCE.map((s, i) => (
                  <li key={s.name} className="flex items-center gap-1.5 text-[10px]">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {s.name}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {Math.round((s.value / donutTotal) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Top Clients by Revenue" demo bodyClassName="p-0">
              <table className="w-full table-fixed text-left text-[11px]">
                <thead className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="px-3 py-1.5 font-medium">Client</th>
                    <th className="px-2 py-1.5 text-right font-medium">Leads</th>
                    <th className="px-2 py-1.5 text-right font-medium">Revenue</th>
                    <th className="px-3 py-1.5 text-right font-medium">Chg</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_TOP_CLIENTS.map((c) => (
                    <tr key={c.name} className="border-b border-border/30 last:border-0">
                      <td className="truncate px-3 py-[7px] text-foreground">{c.name}</td>
                      <td className="px-2 py-[7px] text-right tabular-nums text-muted-foreground">
                        {c.leads}
                      </td>
                      <td className="px-2 py-[7px] text-right tabular-nums text-foreground">
                        {c.revenue}
                      </td>
                      <td className="px-3 py-[7px] text-right">
                        <Delta value={c.delta} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          {/* Operational cards */}
          <div id="alerts" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 2xl:grid-cols-5">
            {DEMO_OPERATIONAL_CARDS.map((c) => {
              const live =
                c.key === "approvals"
                  ? { value: String(approvals.length), demo: false }
                  : c.key === "failed"
                    ? { value: String(failedJobs.length), demo: false }
                    : null;
              return (
                <div
                  key={c.key}
                  className="rounded-[7px] border border-border/70 bg-card/60 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <MiniStat
                      label={c.label}
                      value={live ? live.value : c.value}
                      tone={live && live.value === "0" ? "default" : c.tone}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        c.tone === "ok" && "bg-success",
                        c.tone === "warn" && "bg-warning",
                        c.tone === "alert" && "bg-destructive",
                      )}
                    />
                    <span className="truncate text-[9.5px] text-muted-foreground">
                      {c.detail}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real client health, sourced from live records */}
          <Panel
            title="Client Health"
            subtitle="Live records"
            bodyClassName="p-0"
            action={
              <Link
                to="/clients"
                className="text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
              >
                All clients
              </Link>
            }
          >
            {q.isLoading ? (
              <div className="px-3 py-3 text-[11px] text-muted-foreground">Loading…</div>
            ) : health.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-muted-foreground">
                No clients on record yet.
              </div>
            ) : (
              <table className="w-full table-fixed text-left text-[11px]">
                <thead className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="px-3 py-1.5 font-medium">Client</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                    <th className="px-2 py-1.5 font-medium">Current issue</th>
                    <th className="px-3 py-1.5 text-right font-medium">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {health.slice(0, 6).map((c) => (
                    <tr key={c.id} className="border-b border-border/30 last:border-0">
                      <td className="truncate px-3 py-[7px]">
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: c.id }}
                          className="text-foreground underline-offset-4 hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-2 py-[7px] text-muted-foreground">{c.status}</td>
                      <td className="truncate px-2 py-[7px] text-muted-foreground">
                        {c.issue ?? "Nothing outstanding"}
                      </td>
                      <td className="px-3 py-[7px] text-right tabular-nums text-foreground">
                        {c.mrrCents ? money(c.mrrCents) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <ClientWorkspacePanel clientName={selectedClientName} />
      </div>

      {/* Lower module preview row */}
      <div className="mt-2.5">
        <ModulePreviewRow />
      </div>
    </div>
  );
}
