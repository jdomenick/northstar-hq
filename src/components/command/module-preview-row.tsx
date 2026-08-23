// Lower module preview row: CAM, CCM, NorthStar CRM, Operations Center,
// SAM Core. Each card is data driven so a real source can replace the
// centralized demo dataset without touching this layout.

import { Link } from "@tanstack/react-router";
import { MiniAreaChart, MiniBarChart } from "@/components/command/charts";
import { MiniStat, Panel } from "@/components/command/dash-ui";
import {
  DEMO_CAM,
  DEMO_CCM,
  DEMO_CRM,
  DEMO_OPERATIONS,
  DEMO_SAM_CORE,
} from "@/lib/command/demo-data";

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

export function ModulePreviewRow() {
  return (
    <div id="modules" className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
      <Panel
        id="cam"
        title="CAM Dashboard"
        demo
        bodyClassName="p-2.5"
        action={<ModuleLink to="/sam/content">Open</ModuleLink>}
      >
        <StatGrid stats={DEMO_CAM.stats} />
        <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Leads Over Time
        </div>
        <MiniAreaChart series={DEMO_CAM.series} />
      </Panel>

      <Panel
        id="ccm"
        title="CCM Dashboard"
        demo
        bodyClassName="p-2.5"
        action={<ModuleLink to="/sam/content">Open</ModuleLink>}
      >
        <StatGrid stats={DEMO_CCM.stats} />
        <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Conversations Over Time
        </div>
        <MiniAreaChart series={DEMO_CCM.series} />
      </Panel>

      <Panel
        id="crm"
        title="NorthStar CRM"
        demo
        bodyClassName="p-2.5"
        action={<ModuleLink to="/clients">Open</ModuleLink>}
      >
        <StatGrid stats={DEMO_CRM.stats} />
        <div className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Deals by Stage
        </div>
        <MiniBarChart data={DEMO_CRM.stages} height={84} />
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
        demo
        bodyClassName="p-2.5"
        action={<ModuleLink to="/sam">Open</ModuleLink>}
      >
        <StatGrid stats={DEMO_SAM_CORE.stats} cols={2} />
      </Panel>
    </div>
  );
}

function ModuleLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
    >
      {children}
    </Link>
  );
}
