// Unified Client Workspace panel rendered beside the Command Center.
//
// The outcome journey, KPI row, channel table and activity feed are built
// entirely from live CAM, CCM, CRM and SAM Core reads plus HQ-native revenue.
// A source that answered without a metric is shown as a real zero. A source
// that could not be reached keeps its truthful status and reason instead of
// a number.

import {
  Calendar,
  ChevronRight,
  DollarSign,
  MessageSquare,
  Megaphone,
  Users,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DetailSheet, type DetailPayload } from "@/components/command/detail-sheet";
import { Delta, KpiCard, Panel, StatusDot } from "@/components/command/dash-ui";
import { StatusChip } from "@/components/command/source-state";
import {
  MODULE_LABELS,
  buildOutcomeJourney,
  countLive,
  formatCents,
  formatCount,
  mergeActivity,
  mergeChannelPerformance,
  type ModuleDashboard,
} from "@/lib/module-reporting/types";

const JOURNEY_ICONS: Record<string, typeof Users> = {
  acquisition: Megaphone,
  leads: Users,
  conversations: MessageSquare,
  appointments: Calendar,
  sales: ShoppingCart,
  revenue: DollarSign,
};

const JOURNEY_ACCENT: Record<string, string> = {
  acquisition: "text-chart-1 border-chart-1/40",
  leads: "text-chart-2 border-chart-2/40",
  conversations: "text-chart-3 border-chart-3/40",
  appointments: "text-chart-4 border-chart-4/40",
  sales: "text-chart-5 border-chart-5/40",
  revenue: "text-primary border-primary/40",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "No timestamp";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "No timestamp";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / (60 * 24))}d ago`;
}

export function ClientWorkspacePanel({
  clientName,
  dashboard,
  hqRevenueCents = null,
  clientScoped = false,
}: {
  clientName?: string;
  dashboard?: ModuleDashboard;
  hqRevenueCents?: number | null;
  clientScoped?: boolean;
}) {
  const name = clientName ?? "Portfolio";
  const [detail, setDetail] = useState<DetailPayload | null>(null);

  const liveCount = dashboard ? countLive(dashboard) : 0;
  const journey = dashboard ? buildOutcomeJourney(dashboard, hqRevenueCents ?? 0) : [];
  const channels = dashboard ? mergeChannelPerformance(dashboard) : [];
  const activity = dashboard ? mergeActivity(dashboard) : [];

  const num = (v: number | null | undefined) => formatCount(v ?? 0) ?? "0";
  const cents = (v: number | null | undefined) => formatCents(v ?? 0) ?? "$0";

  const kpis: { key: string; label: string; value: string; series?: number[]; note: string }[] =
    dashboard
      ? [
          {
            key: "leads",
            label: "Leads",
            value: num(dashboard.cam.data?.leads),
            series: (dashboard.cam.data?.trend ?? []).map((p) => p.value),
            note: dashboard.cam.reason ?? "Read live from CAM.",
          },
          {
            key: "conversations",
            label: "Conversations",
            value: num(dashboard.ccm.data?.conversations),
            series: (dashboard.ccm.data?.trend ?? []).map((p) => p.value),
            note: dashboard.ccm.reason ?? "Read live from CCM.",
          },
          {
            key: "appointments",
            label: "Appointments",
            value: num(dashboard.ccm.data?.appointments),
            note: dashboard.ccm.reason ?? "Read live from CCM.",
          },
          {
            key: "deals",
            label: "Open Deals",
            value: num(dashboard.crm.data?.openDeals),
            note: dashboard.crm.reason ?? "Read live from NorthStar CRM.",
          },
          {
            key: "revenue",
            label: "Revenue (NorthStar)",
            value: cents(hqRevenueCents),
            note: "Collected invoice payments on NorthStar billing records.",
          },
        ]
      : [];

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Panel
        title={`Client Workspace - ${name}`}
        subtitle={clientScoped ? "Unified View" : "Portfolio view"}
        bodyClassName="p-2.5"
        action={<StatusChip status={liveCount > 0 ? "ok" : "not_connected"} />}
      >
        {/* Outcome journey */}
        <div className="flex min-w-0 items-stretch gap-1">
          {journey.map((step, i, arr) => {
            const Icon = JOURNEY_ICONS[step.key] ?? Users;
            const shown = step.value ?? "0";
            return (
              <div key={step.key} className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  title={step.reason ?? undefined}
                  onClick={() =>
                    setDetail({
                      title: step.label,
                      subtitle: name,
                      value: shown,
                      rows: arr.map((s2) => ({ label: s2.label, value: s2.value ?? "0" })),
                      note:
                        step.reason ??
                        (step.source
                          ? `Source: ${step.source === "hq" ? "NorthStar HQ" : MODULE_LABELS[step.source]}`
                          : undefined),
                    })
                  }
                  className="min-w-0 flex-1 rounded-[6px] border border-border/60 bg-background/40 px-1.5 py-1.5 text-center transition-colors hover:border-primary/50 hover:bg-background/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                  <div
                    className={cn(
                      "mx-auto flex h-6 w-6 items-center justify-center rounded-[5px] border bg-card/60",
                      JOURNEY_ACCENT[step.key],
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </div>
                  <div className="mt-1 truncate text-[8.5px] uppercase tracking-[0.08em] text-muted-foreground">
                    {step.label}
                  </div>
                  <div
                    className={cn(
                      "truncate font-display text-[11.5px] leading-tight tabular-nums",
                      step.value ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {shown}
                  </div>
                </button>
                {i < arr.length - 1 && (
                  <ChevronRight
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 text-muted-foreground/60"
                    strokeWidth={2}
                  />
                )}
              </div>
            );
          })}
          {journey.length === 0 && (
            <p className="w-full py-4 text-center text-[10.5px] text-muted-foreground">
              Reading module sources.
            </p>
          )}
        </div>

        {/* KPI row */}
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => (
            <KpiCard
              key={k.key}
              label={k.label}
              value={k.value}
              {...(k.series ? { series: k.series } : {})}
              onSelect={() =>
                setDetail({
                  title: k.label,
                  subtitle: name,
                  value: k.value,
                  ...(k.series ? { series: k.series } : {}),
                  note: k.note,
                })
              }
            />
          ))}
        </div>
      </Panel>

      <div className="grid min-w-0 gap-2.5 lg:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Channel Performance (MTD)"
          bodyClassName="p-0"
          action={<StatusChip status={dashboard?.cam.status ?? "not_connected"} />}
        >
          <table className="w-full table-fixed text-left text-[11px]">
            <thead className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="px-3 py-1.5 font-medium">Channel</th>
                <th className="w-12 px-2 py-1.5 text-right font-medium">Leads</th>
                <th className="w-12 px-2 py-1.5 text-right font-medium">Appts</th>
                <th className="w-[68px] px-2 py-1.5 text-right font-medium">Revenue</th>
                <th className="w-[54px] px-3 py-1.5 text-right font-medium">Chg</th>
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-[10.5px] text-muted-foreground">
                    {dashboard?.cam.status === "ok"
                      ? "CAM did not report channel performance for this range."
                      : (dashboard?.cam.reason ?? "Channel performance is not available.")}
                  </td>
                </tr>
              ) : (
                channels.map((r) => {
                  const revenue = cents(r.revenueCents);
                  return (
                    <tr
                      key={r.channel}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setDetail({
                          title: r.channel,
                          subtitle: `${name} channel`,
                          value: revenue,
                          ...(r.changePct === null ? {} : { delta: r.changePct }),
                          rows: [
                            { label: "Leads", value: num(r.leads) },
                            { label: "Appointments", value: num(r.appointments) },
                            { label: "Revenue", value: revenue },
                          ],
                          note: "Source: CAM acquisition reporting.",
                        })
                      }
                      className="cursor-pointer border-b border-border/30 last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      <td className="truncate px-3 py-1.5 text-foreground">{r.channel}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {num(r.leads)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {num(r.appointments)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
                        {revenue}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {r.changePct === null ? (
                          <span className="text-[10px] text-muted-foreground">No change data</span>
                        ) : (
                          <Delta value={r.changePct} />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>

        <Panel title="Recent Activity" bodyClassName="p-0">
          {activity.length === 0 ? (
            <p className="px-3 py-3 text-[10.5px] text-muted-foreground">
              No activity reported by the connected modules for this range.
            </p>
          ) : (
            <ul className="divide-y divide-border/30">
              {activity.map((a, i) => (
                <li
                  key={`${a.source}-${a.title}-${i}`}
                  className="flex items-start gap-2 px-3 py-[7px] transition-colors hover:bg-muted/40"
                >
                  <StatusDot tone={a.tone} />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] text-foreground">{a.title}</div>
                    <div className="truncate text-[9.5px] text-muted-foreground">
                      {MODULE_LABELS[a.source]} - {a.meta ?? relativeTime(a.occurredAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <DetailSheet detail={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}
