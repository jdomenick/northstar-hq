// Lower module preview row: CAM, CCM, NorthStar CRM, Operations Center,
// SAM Core.
//
// Each module card reads live values from the read-through module dashboard
// when that source returned data. When a source is not connected or is
// unavailable the card keeps the clearly marked demo layout and shows the
// truthful reason. Values are never silently substituted.

import { Link } from "@tanstack/react-router";
import { MiniAreaChart, MiniBarChart } from "@/components/command/charts";
import { MiniStat, Panel } from "@/components/command/dash-ui";
import { SourceNote, StatusChip } from "@/components/command/source-state";
import {
  DEMO_CAM,
  DEMO_CCM,
  DEMO_CRM,
  DEMO_OPERATIONS,
  DEMO_SAM_CORE,
} from "@/lib/command/demo-data";
import {
  formatCents,
  formatCount,
  type ModuleDashboard,
  type ModuleSource,
  type TrendPoint,
} from "@/lib/module-reporting/types";

function StatGrid({
  stats,
  cols = 3,
}: {
  stats: { label: string; value: string }[];
  cols?: number;
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {stats.map((s) => (
        <MiniStat key={s.label} label={s.label} value={s.value} />
      ))}
    </div>
  );
}

function seriesFrom(points: TrendPoint[], fallback: number[]): number[] {
  return points.length >= 2 ? points.map((p) => p.value) : fallback;
}

/** "Live" when the source answered, otherwise the demo marker plus a reason. */
function sourceHeader<T>(source: ModuleSource<T> | undefined) {
  if (!source) return { live: false, chip: null as React.ReactNode };
  return {
    live: source.status === "ok",
    chip: <StatusChip status={source.status} title={source.reason ?? undefined} />,
  };
}

export function ModulePreviewRow({ dashboard }: { dashboard?: ModuleDashboard }) {
  const cam = dashboard?.cam;
  const ccm = dashboard?.ccm;
  const crm = dashboard?.crm;
  const sam = dashboard?.sam;

  const camHead = sourceHeader(cam);
  const ccmHead = sourceHeader(ccm);
  const crmHead = sourceHeader(crm);
  const samHead = sourceHeader(sam);

  const camStats = camHead.live
    ? [
        { label: "Leads", value: formatCount(cam?.data?.leads ?? null) ?? "Not reported" },
        {
          label: "Qualified",
          value: formatCount(cam?.data?.qualifiedLeads ?? null) ?? "Not reported",
        },
        { label: "CPL", value: formatCents(cam?.data?.cplCents ?? null) ?? "Not reported" },
      ]
    : DEMO_CAM.stats;

  const ccmStats = ccmHead.live
    ? [
        {
          label: "Conversations",
          value: formatCount(ccm?.data?.conversations ?? null) ?? "Not reported",
        },
        {
          label: "Appointments",
          value: formatCount(ccm?.data?.appointments ?? null) ?? "Not reported",
        },
        {
          label: "Avg Response",
          value:
            ccm?.data?.avgResponseSeconds == null
              ? "Not reported"
              : `${Math.round(ccm.data.avgResponseSeconds / 60)}m`,
        },
      ]
    : DEMO_CCM.stats;

  const crmStats = crmHead.live
    ? [
        { label: "Customers", value: formatCount(crm?.data?.customers ?? null) ?? "Not reported" },
        { label: "Open Deals", value: formatCount(crm?.data?.openDeals ?? null) ?? "Not reported" },
        {
          label: "Pipeline",
          value: formatCents(crm?.data?.pipelineValueCents ?? null) ?? "Not reported",
        },
      ]
    : DEMO_CRM.stats;

  const samStats = samHead.live
    ? [
        { label: "Status", value: sam?.data?.status ?? "Not reported" },
        { label: "Consumers", value: formatCount(sam?.data?.consumers ?? null) ?? "Not reported" },
        { label: "Events", value: formatCount(sam?.data?.events ?? null) ?? "Not reported" },
        {
          label: "Success",
          value:
            sam?.data?.successRatePct == null
              ? "Not reported"
              : `${sam.data.successRatePct.toFixed(1)}%`,
        },
      ]
    : DEMO_SAM_CORE.stats;

  const crmStages =
    crmHead.live && (crm?.data?.stages.length ?? 0) > 0
      ? (crm?.data?.stages ?? [])
      : DEMO_CRM.stages;


  return (
    <div id="modules" className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
      <Panel
        id="cam"
        title="CAM Dashboard"
        demo={!camHead.live}
        action={
          <div className="flex items-center gap-1.5">
            {camHead.chip}
            <ModuleLink to="/sam/content">Open</ModuleLink>
          </div>
        }
        bodyClassName="p-2.5"
      >
        <StatGrid stats={camStats} />
        <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Leads Over Time
        </div>
        <MiniAreaChart series={seriesFrom(cam?.data?.trend ?? [], DEMO_CAM.series)} />
        {cam && <SourceNote source={cam} />}
      </Panel>

      <Panel
        id="ccm"
        title="CCM Dashboard"
        demo={!ccmHead.live}
        action={
          <div className="flex items-center gap-1.5">
            {ccmHead.chip}
            <ModuleLink to="/sam/content">Open</ModuleLink>
          </div>
        }
        bodyClassName="p-2.5"
      >
        <StatGrid stats={ccmStats} />
        <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Conversations Over Time
        </div>
        <MiniAreaChart series={seriesFrom(ccm?.data?.trend ?? [], DEMO_CCM.series)} />
        {ccm && <SourceNote source={ccm} />}
      </Panel>

      <Panel
        id="crm"
        title="NorthStar CRM"
        demo={!crmHead.live}
        action={
          <div className="flex items-center gap-1.5">
            {crmHead.chip}
            <ModuleLink to="/clients">Open</ModuleLink>
          </div>
        }
        bodyClassName="p-2.5"
      >
        <StatGrid stats={crmStats} />
        <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Deals by Stage
        </div>
        <MiniBarChart data={crmStages} height={84} />
        {crm && <SourceNote source={crm} />}
      </Panel>

      <Panel
        id="operations"
        title="Operations Center"
        demo
        bodyClassName="p-2.5"
        action={<ModuleLink to="/sam/control">Open</ModuleLink>}
      >
        <StatGrid stats={DEMO_OPERATIONS.stats} cols={2} />
        <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          System Load
        </div>
        <MiniAreaChart series={DEMO_OPERATIONS.series} height={54} />
      </Panel>

      <Panel
        id="sam-core"
        title="System / SAM Core"
        demo={!samHead.live}
        bodyClassName="p-2.5"
        action={
          <div className="flex items-center gap-1.5">
            {samHead.chip}
            <ModuleLink to="/sam">Open</ModuleLink>
          </div>
        }
      >
        <StatGrid stats={samStats} cols={2} />
        {sam && <SourceNote source={sam} />}
      </Panel>
    </div>
  );
}

function ModuleLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="rounded-[4px] px-1 py-0.5 text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      {children}
    </Link>
  );
}
