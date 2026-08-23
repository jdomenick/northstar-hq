// Unified Client Workspace panel rendered beside the Command Center.
// Data driven: every prop can be bound to a real client source later.

import {
  Calendar,
  DollarSign,
  MessageSquare,
  Megaphone,
  Users,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Delta, KpiCard, Panel, StatusDot } from "@/components/command/dash-ui";
import {
  DEMO_CHANNEL_PERFORMANCE,
  DEMO_JOURNEY,
  DEMO_RECENT_ACTIVITY,
  DEMO_WORKSPACE_CLIENT,
  DEMO_WORKSPACE_KPIS,
} from "@/lib/command/demo-data";

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

export function ClientWorkspacePanel({ clientName }: { clientName?: string }) {
  const name = clientName ?? DEMO_WORKSPACE_CLIENT;
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Panel
        title={`Client Workspace - ${name}`}
        subtitle="Unified View"
        demo
        bodyClassName="p-2.5"
      >
        {/* Outcome journey */}
        <div className="flex min-w-0 items-stretch gap-1">
          {DEMO_JOURNEY.map((step, i) => {
            const Icon = JOURNEY_ICONS[step.key] ?? Users;
            return (
              <div key={step.key} className="flex min-w-0 flex-1 items-center gap-1">
                <div className="min-w-0 flex-1 rounded-[6px] border border-border/60 bg-background/40 px-1.5 py-1.5 text-center">
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
                  <div className="truncate font-display text-[11.5px] leading-tight text-foreground tabular-nums">
                    {step.value}
                  </div>
                </div>
                {i < DEMO_JOURNEY.length - 1 && (
                  <ChevronRight
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 text-muted-foreground/60"
                    strokeWidth={2}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* KPI row */}
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-5">
          {DEMO_WORKSPACE_KPIS.map((k) => (
            <KpiCard
              key={k.key}
              label={k.label}
              value={k.value}
              delta={k.delta}
              series={k.series}
            />
          ))}
        </div>
      </Panel>

      <div className="grid min-w-0 gap-2.5 lg:grid-cols-[1.35fr_1fr]">
        <Panel title="Channel Performance (MTD)" demo bodyClassName="p-0">
          <table className="w-full text-left text-[11px]">
            <thead className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="px-3 py-1.5 font-medium">Channel</th>
                <th className="px-2 py-1.5 text-right font-medium">Leads</th>
                <th className="px-2 py-1.5 text-right font-medium">Appts</th>
                <th className="px-2 py-1.5 text-right font-medium">Revenue</th>
                <th className="px-3 py-1.5 text-right font-medium">Chg</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_CHANNEL_PERFORMANCE.map((r) => (
                <tr key={r.channel} className="border-b border-border/30 last:border-0">
                  <td className="truncate px-3 py-1.5 text-foreground">{r.channel}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {r.leads}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {r.appts}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
                    {r.revenue}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Delta value={r.delta} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Recent Activity" demo bodyClassName="p-0">
          <ul className="divide-y divide-border/30">
            {DEMO_RECENT_ACTIVITY.map((a) => (
              <li key={a.title + a.meta} className="flex items-start gap-2 px-3 py-[7px]">
                <StatusDot tone={a.tone} />
                <div className="min-w-0">
                  <div className="truncate text-[11px] text-foreground">{a.title}</div>
                  <div className="truncate text-[9.5px] text-muted-foreground">{a.meta}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
