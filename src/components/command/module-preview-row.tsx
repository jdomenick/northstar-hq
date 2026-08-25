// Lower module preview row: CAM, CCM, NorthStar CRM, Operations Center,
// SAM Core.
//
// Every card reads the live read-through module dashboard, plus HQ-native
// automation records for Operations. Nothing here is sampled. When a source
// answered but did not report a metric the card shows a real zero and the
// status chip plus source note carry the truthful state of the connection.

import { MiniAreaChart, MiniBarChart } from "@/components/command/charts";
import { MiniStat, Panel } from "@/components/command/dash-ui";
import { SourceNote, StatusChip } from "@/components/command/source-state";
import {
  formatCents,
  formatCount,
  type ModuleDashboard,
  type ModuleSource,
  type TrendPoint,
} from "@/lib/module-reporting/types";

const MODULE_APP_URLS = {
  cam: "https://camleadconversion.lovable.app",
  ccm: "https://communicationmanager.lovable.app",
  crm: "https://northstar-connect-suite.lovable.app",
} as const;

export interface OperationsSnapshot {
  automations: number;
  jobs24h: number;
  failed24h: number;
  approvals: number;
  series: number[];
}

const ZERO_SERIES = new Array<number>(12).fill(0);

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

/** Real points when the source reported a series, otherwise a flat zero line. */
function seriesFrom(points: TrendPoint[]): number[] {
  return points.length >= 2 ? points.map((p) => p.value) : ZERO_SERIES;
}

function chipOf<T>(source: ModuleSource<T> | undefined) {
  if (!source) return null;
  return <StatusChip status={source.status} title={source.reason ?? undefined} />;
}

const count = (v: number | null | undefined) => formatCount(v ?? 0) ?? "0";
const cents = (v: number | null | undefined) => formatCents(v ?? 0) ?? "$0";

export function ModulePreviewRow({
  dashboard,
  operations,
}: {
  dashboard?: ModuleDashboard;
  operations?: OperationsSnapshot;
}) {
  const cam = dashboard?.cam;
  const ccm = dashboard?.ccm;
  const crm = dashboard?.crm;
  const sam = dashboard?.sam;

  const camStats = [
    { label: "Leads", value: count(cam?.data?.leads) },
    { label: "Qualified", value: count(cam?.data?.qualifiedLeads) },
    { label: "CPL", value: cents(cam?.data?.cplCents) },
  ];

  const ccmStats = [
    { label: "Conversations", value: count(ccm?.data?.conversations) },
    { label: "Appointments", value: count(ccm?.data?.appointments) },
    {
      label: "Avg Response",
      value: `${Math.round((ccm?.data?.avgResponseSeconds ?? 0) / 60)}m`,
    },
  ];

  const crmStats = [
    { label: "Customers", value: count(crm?.data?.customers) },
    { label: "Open Deals", value: count(crm?.data?.openDeals) },
    { label: "Pipeline", value: cents(crm?.data?.pipelineValueCents) },
  ];

  const samStats = [
    { label: "Status", value: sam?.data?.status ?? "Offline" },
    { label: "Consumers", value: count(sam?.data?.consumers) },
    { label: "Events", value: count(sam?.data?.events) },
    { label: "Success", value: `${(sam?.data?.successRatePct ?? 0).toFixed(1)}%` },
  ];

  const crmStages =
    (crm?.data?.stages.length ?? 0) > 0
      ? (crm?.data?.stages ?? [])
      : [{ label: "No deals", value: 0 }];

  const opsStats = [
    { label: "Automations", value: String(operations?.automations ?? 0) },
    { label: "Jobs (24h)", value: String(operations?.jobs24h ?? 0) },
    { label: "Approvals", value: String(operations?.approvals ?? 0) },
    { label: "Failed Workflows", value: String(operations?.failed24h ?? 0) },
  ];

  return (
    <div id="modules" className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
      <Panel
        id="cam"
        title="CAM Dashboard"
        action={
          <div className="flex items-center gap-1.5">
            {chipOf(cam)}
            <ExternalModuleLink href={MODULE_APP_URLS.cam}>Open</ExternalModuleLink>
          </div>
        }
        bodyClassName="p-2.5"
      >
        <StatGrid stats={camStats} />
        <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Leads Over Time
        </div>
        <MiniAreaChart series={seriesFrom(cam?.data?.trend ?? [])} />
        {cam && <SourceNote source={cam} />}
      </Panel>

      <Panel
        id="ccm"
        title="CCM Dashboard"
        action={
          <div className="flex items-center gap-1.5">
            {chipOf(ccm)}
            <ExternalModuleLink href={MODULE_APP_URLS.ccm}>Open</ExternalModuleLink>
          </div>
        }
        bodyClassName="p-2.5"
      >
        <StatGrid stats={ccmStats} />
        <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Conversations Over Time
        </div>
        <MiniAreaChart series={seriesFrom(ccm?.data?.trend ?? [])} />
        {ccm && <SourceNote source={ccm} />}
      </Panel>

      <Panel
        id="crm"
        title="NorthStar CRM"
        action={
          <div className="flex items-center gap-1.5">
            {chipOf(crm)}
            <ExternalModuleLink href={MODULE_APP_URLS.crm}>Open</ExternalModuleLink>
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
        bodyClassName="p-2.5"
        action={<InternalModuleLink href="/sam/control">Open</InternalModuleLink>}
      >
        <StatGrid stats={opsStats} cols={2} />
        <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Job Volume (24h)
        </div>
        <MiniAreaChart series={operations?.series ?? ZERO_SERIES} height={54} />
        <p className="mt-1.5 text-[9.5px] text-muted-foreground">
          NorthStar automation records, last 24 hours.
        </p>
      </Panel>

      <Panel
        id="sam-core"
        title="System / SAM Core"
        bodyClassName="p-2.5"
        action={
          <div className="flex items-center gap-1.5">
            {chipOf(sam)}
            <InternalModuleLink href="/sam">Open</InternalModuleLink>
          </div>
        }
      >
        <StatGrid stats={samStats} cols={2} />
        {sam && <SourceNote source={sam} />}
      </Panel>
    </div>
  );
}

function ExternalModuleLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-[4px] px-1 py-0.5 text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      {children}
    </a>
  );
}

function InternalModuleLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      className="rounded-[4px] px-1 py-0.5 text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      {children}
    </a>
  );
}
