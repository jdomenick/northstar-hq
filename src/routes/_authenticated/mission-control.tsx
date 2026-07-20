import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Play, Pause, Plus, Circle, CheckCircle2, Clock, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Users, Rocket, Building2, ShieldCheck, GitBranch, Sparkles, ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { atLeast } from "@/lib/permissions";
import {
  useVentures, useProjects, useDecisions, useCommitments, useGoals, useInsights,
} from "@/lib/data-hooks";
import {
  isCommitmentOverdue, isDecisionWaiting, isGoalAtRisk,
} from "@/lib/accountability";
import {
  useRevenueClients, usePipeline, useCashflow, useProposals,
  useOperatorStates, useOperatorTasks, useOperatorAudit,
  useCreateOperatorTask, useUpdateOperatorTaskStatus, useApproveOperatorTask, useSetOperatorPaused,
  summarizeRevenue, formatMoney,
  type OperatorKind, type OperatorTask,
} from "@/lib/mission-control/hooks";

export const Route = createFileRoute("/_authenticated/mission-control")({
  component: MissionControl,
});

function MissionControl() {
  const { user } = useAuth();
  const { activeOrgId, activeMembership } = useOrg();
  const orgName = activeMembership?.organizations?.name ?? "NorthStar Labs";
  const canAdmin = atLeast(activeMembership?.role, "admin");

  const ventures = useVentures(activeOrgId);
  const projects = useProjects(activeOrgId);
  const decisions = useDecisions(activeOrgId);
  const commitments = useCommitments(activeOrgId);
  const goals = useGoals(activeOrgId);
  const insights = useInsights(activeOrgId);
  const clients = useRevenueClients(activeOrgId);
  const pipeline = usePipeline(activeOrgId);
  const cash = useCashflow(activeOrgId, 90);
  const proposals = useProposals(activeOrgId);
  const operators = useOperatorStates(activeOrgId);

  const rev = summarizeRevenue(clients.data ?? [], pipeline.data ?? [], cash.data ?? [], proposals.data ?? []);
  const activeVentures = (ventures.data ?? []).filter((v) => v.status !== "archived" && v.status !== "closed");
  const atRiskProjects = (projects.data ?? []).filter((p) => p.status === "at_risk" || p.status === "blocked");
  const waitingDecisions = (decisions.data ?? []).filter((d) => isDecisionWaiting(d, user?.id ?? null));
  const overdueCommitments = (commitments.data ?? []).filter(isCommitmentOverdue);
  const goalsAtRisk = (goals.data ?? []).filter(isGoalAtRisk);

  return (
    <div className="min-h-screen">
      {/* Header bar */}
      <header className="border-b border-foreground/15 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/60">{orgName} · Mission Control</div>
              <h1 className="mt-2 font-display text-[36px] leading-[1.02] tracking-tight md:text-[52px]">The control room</h1>
            </div>
            <div className="text-right text-[11px] uppercase tracking-[0.22em] text-foreground/60">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-10 md:py-10 space-y-10">
        {/* Top KPI strip */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile label="MRR" value={formatMoney(rev.mrrCents, { compact: true })} sub={`${rev.activeClients} active clients`} />
          <KpiTile label="Pipeline" value={formatMoney(rev.pipelineValueCents, { compact: true })} sub={`${formatMoney(rev.weightedForecastCents, { compact: true })} weighted`} />
          <KpiTile label="Net cash · 30d" value={formatMoney(rev.netCash30Cents, { compact: true })} sub={`${formatMoney(rev.inflow30Cents, { compact: true })} in, ${formatMoney(rev.outflow30Cents, { compact: true })} out`} tone={rev.netCash30Cents < 0 ? "warn" : "ok"} />
          <KpiTile label="Open items" value={String(waitingDecisions.length + overdueCommitments.length + atRiskProjects.length)} sub={`${waitingDecisions.length} decisions · ${overdueCommitments.length} overdue · ${atRiskProjects.length} at risk`} tone={atRiskProjects.length > 0 || overdueCommitments.length > 0 ? "warn" : "ok"} />
        </section>

        {/* Executive layer */}
        <section>
          <SectionHeader title="Executive layer" hint="Read-only reports across the operation" />
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ExecCard title="CEO" subtitle="Strategy & focus" icon={Rocket}
              stats={[
                { label: "Ventures active", value: activeVentures.length },
                { label: "Goals on target", value: (goals.data ?? []).length - goalsAtRisk.length },
                { label: "Goals at risk", value: goalsAtRisk.length, tone: goalsAtRisk.length > 0 ? "warn" : undefined },
              ]}
              detail={(insights.data ?? []).find((i) => i.severity === "opportunity")?.title ?? "No fresh opportunities flagged."}
              link={{ to: "/ventures", label: "Ventures" }}
            />
            <ExecCard title="COO" subtitle="Delivery & operations" icon={Building2}
              stats={[
                { label: "Projects", value: (projects.data ?? []).length },
                { label: "At risk", value: atRiskProjects.length, tone: atRiskProjects.length > 0 ? "warn" : undefined },
                { label: "Overdue commitments", value: overdueCommitments.length, tone: overdueCommitments.length > 0 ? "warn" : undefined },
              ]}
              detail={atRiskProjects[0] ? `Top risk: ${atRiskProjects[0].name}` : "Delivery is clean this week."}
              link={{ to: "/projects", label: "Projects" }}
            />
            <ExecCard title="CRO" subtitle="Revenue & pipeline" icon={DollarSign}
              stats={[
                { label: "MRR", value: formatMoney(rev.mrrCents, { compact: true }) },
                { label: "Pipeline", value: formatMoney(rev.pipelineValueCents, { compact: true }) },
                { label: "Won MTD", value: formatMoney(rev.wonThisMonthCents, { compact: true }) },
              ]}
              detail={rev.mrrCents === 0 && rev.pipelineValueCents === 0
                ? "No revenue data yet. Add clients and deals to activate this module."
                : `${rev.openProposals} open proposals worth ${formatMoney(rev.proposalValueCents, { compact: true })}.`}
              link={{ to: "/revenue", label: "Revenue" }}
            />
            <ExecCard title="CMO" subtitle="Content & audience" icon={Sparkles}
              stats={[
                { label: "Ventures", value: activeVentures.length },
                { label: "Content ops", value: "Live" },
                { label: "Autonomy", value: "Approval-required" },
              ]}
              detail="Content Operations engine wired. Connect social accounts under Integrations to publish live."
              link={{ to: "/integrations", label: "Integrations" }}
            />
            <ExecCard title="CTO" subtitle="Systems & automation" icon={GitBranch}
              stats={[
                { label: "Decisions waiting", value: waitingDecisions.length, tone: waitingDecisions.length > 0 ? "warn" : undefined },
                { label: "Automation", value: "Durable" },
                { label: "SAM MCP", value: "Ready" },
              ]}
              detail="Scheduler on 1-minute tick. SAM MCP client vertical slice deployed."
              link={{ to: "/integrations", label: "Integrations" }}
            />
            <ExecCard title="CFO" subtitle="Cash & runway" icon={ShieldCheck}
              stats={[
                { label: "Net cash · 30d", value: formatMoney(rev.netCash30Cents, { compact: true }), tone: rev.netCash30Cents < 0 ? "warn" : undefined },
                { label: "Inflow · 30d", value: formatMoney(rev.inflow30Cents, { compact: true }) },
                { label: "Outflow · 30d", value: formatMoney(rev.outflow30Cents, { compact: true }) },
              ]}
              detail={cash.data && cash.data.length === 0
                ? "No cashflow entries yet. Add inflows and outflows in Revenue."
                : `${cash.data?.length ?? 0} entries in the last 90 days.`}
              link={{ to: "/revenue", label: "Revenue" }}
            />
          </div>
        </section>

        {/* Operators */}
        <section>
          <SectionHeader title="Autonomous operators" hint="Continuous queues, pause on demand, audit every action" />
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OperatorPanel
              kind="hunter"
              title="Hunter"
              subtitle="Business development"
              purpose="Finds, qualifies, and moves new revenue opportunities."
              orgId={activeOrgId}
              canAdmin={canAdmin}
              states={operators.data ?? []}
            />
            <OperatorPanel
              kind="builder"
              title="Builder"
              subtitle="Client delivery"
              purpose="Moves committed work forward: projects, deliverables, sign-off."
              orgId={activeOrgId}
              canAdmin={canAdmin}
              states={operators.data ?? []}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-foreground/70 pb-2">
      <h2 className="font-display text-[24px] leading-none">{title}</h2>
      {hint && <div className="text-[11px] italic text-foreground/55">{hint}</div>}
    </div>
  );
}

function KpiTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border border-border/70 bg-card p-4">
      <div className="text-[10px] uppercase tracking-[0.22em] text-foreground/55">{label}</div>
      <div className={cn("mt-2 font-display text-[26px] leading-none tabular-nums", tone === "warn" && "text-[oklch(0.5_0.18_27)]")}>{value}</div>
      {sub && <div className="mt-2 text-[11.5px] text-foreground/60">{sub}</div>}
    </div>
  );
}

function ExecCard({
  title, subtitle, icon: Icon, stats, detail, link,
}: {
  title: string; subtitle: string;
  icon: typeof Rocket;
  stats: { label: string; value: string | number; tone?: "warn" }[];
  detail: string;
  link: { to: "/ventures" | "/projects" | "/revenue" | "/integrations"; label: string };
}) {
  return (
    <div className="flex flex-col rounded-md border border-border/70 bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-foreground/70" strokeWidth={1.75} />
            <div className="font-display text-[20px] leading-none">{title}</div>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-foreground/55">{subtitle}</div>
        </div>
        <Link to={link.to} className="text-[10.5px] uppercase tracking-[0.2em] text-foreground/55 hover:text-foreground">
          {link.label} <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <div className={cn("font-display text-[22px] leading-none tabular-nums", s.tone === "warn" && "text-[oklch(0.5_0.18_27)]")}>{s.value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-foreground/55">{s.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-foreground/75">{detail}</p>
    </div>
  );
}

function OperatorPanel({
  kind, title, subtitle, purpose, orgId, canAdmin, states,
}: {
  kind: OperatorKind; title: string; subtitle: string; purpose: string;
  orgId: string | null; canAdmin: boolean;
  states: { kind: OperatorKind; paused: boolean; auto_enabled: boolean; paused_reason: string | null }[];
}) {
  const state = states.find((s) => s.kind === kind);
  const paused = state?.paused ?? true; // default paused (no fake activity)
  const autoEnabled = state?.auto_enabled ?? false;
  const tasks = useOperatorTasks(orgId, kind);
  const audit = useOperatorAudit(orgId, kind, 8);
  const createTask = useCreateOperatorTask(orgId);
  const updateStatus = useUpdateOperatorTaskStatus(orgId);
  const approve = useApproveOperatorTask(orgId);
  const setPaused = useSetOperatorPaused(orgId);
  const [newOpen, setNewOpen] = useState(false);

  const queue = (tasks.data ?? []).filter((t) => t.status === "queued" || t.status === "needs_approval");
  const active = (tasks.data ?? []).filter((t) => t.status === "in_progress");
  const done = (tasks.data ?? []).filter((t) => t.status === "done").slice(0, 5);

  return (
    <div className="rounded-md border border-border/70 bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-display text-[22px] leading-none">{title}</div>
            <Badge variant="outline" className="border-border/70 text-[10px] uppercase tracking-[0.18em]">
              {autoEnabled ? (paused ? "Paused" : "Running") : "Not connected"}
            </Badge>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-foreground/55">{subtitle}</div>
          <p className="mt-2 text-[13px] text-foreground/70">{purpose}</p>
          {!autoEnabled && (
            <p className="mt-2 text-[11.5px] italic text-foreground/55">
              No automation source connected yet. Queue tasks manually below; operators run against manual work only.
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {canAdmin && autoEnabled && (
            <Button
              size="sm"
              variant={paused ? "default" : "outline"}
              onClick={() => setPaused.mutate({ kind, paused: !paused }, {
                onSuccess: () => toast.success(paused ? `${title} resumed` : `${title} paused`),
                onError: (e) => toast.error((e as Error).message),
              })}
            >
              {paused ? <><Play className="mr-1 h-3.5 w-3.5" /> Resume</> : <><Pause className="mr-1 h-3.5 w-3.5" /> Pause</>}
            </Button>
          )}
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" /> Queue task</Button>
            </DialogTrigger>
            <NewTaskDialog kind={kind} onClose={() => setNewOpen(false)} onSubmit={(v) => {
              createTask.mutate(v, {
                onSuccess: () => { toast.success("Task queued"); setNewOpen(false); },
                onError: (e) => toast.error((e as Error).message),
              });
            }} />
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-border/70 p-4 text-center">
        <QueueStat label="Queued" count={queue.length} icon={Clock} />
        <QueueStat label="Active" count={active.length} icon={Circle} />
        <QueueStat label="Done · 24h" count={(tasks.data ?? []).filter((t) => t.status === "done" && t.completed_at && Date.now() - new Date(t.completed_at).getTime() < 86_400_000).length} icon={CheckCircle2} />
      </div>

      <div className="p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/55">Queue</div>
        {queue.length === 0 && active.length === 0 ? (
          <div className="mt-2 py-6 text-center text-[13px] italic text-foreground/55">Queue is empty.</div>
        ) : (
          <ul className="mt-2 divide-y divide-border/60">
            {[...active, ...queue].map((t) => (
              <TaskRow key={t.id} task={t}
                onStart={() => updateStatus.mutate({ id: t.id, kind, status: "in_progress" })}
                onDone={() => updateStatus.mutate({ id: t.id, kind, status: "done" })}
                onApprove={() => approve.mutate({ id: t.id, kind })}
                onCancel={() => updateStatus.mutate({ id: t.id, kind, status: "cancelled" })}
              />
            ))}
          </ul>
        )}
      </div>

      {done.length > 0 && (
        <div className="border-t border-border/70 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/55">Recently completed</div>
          <ul className="mt-2 space-y-1 text-[12.5px] text-foreground/70">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-foreground/40" />
                <span className="truncate">{t.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-border/70 p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/55">Audit</div>
        {(audit.data ?? []).length === 0 ? (
          <div className="mt-2 text-[12px] italic text-foreground/55">No audit events yet.</div>
        ) : (
          <ul className="mt-2 space-y-1 text-[11.5px] text-foreground/65">
            {(audit.data ?? []).map((a) => (
              <li key={a.id} className="flex items-baseline gap-2">
                <span className="tabular-nums text-foreground/45">{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span>{a.event.replaceAll(".", " ").replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QueueStat({ label, count, icon: Icon }: { label: string; count: number; icon: typeof Clock }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 text-foreground/55">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="mt-1 font-display text-[22px] leading-none tabular-nums">{count}</div>
    </div>
  );
}

function TaskRow({ task, onStart, onDone, onApprove, onCancel }: {
  task: OperatorTask;
  onStart: () => void; onDone: () => void; onApprove: () => void; onCancel: () => void;
}) {
  const priorityTone =
    task.priority === "urgent" ? "text-[oklch(0.5_0.18_27)]" :
    task.priority === "high" ? "text-[oklch(0.55_0.13_65)]" : "text-foreground/55";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] uppercase tracking-[0.18em]", priorityTone)}>{task.priority}</span>
          {task.status === "in_progress" && <Badge variant="secondary" className="h-4 text-[9px] uppercase tracking-[0.16em]">Active</Badge>}
          {task.status === "needs_approval" && <Badge className="h-4 bg-amber-500/15 text-amber-700 border-amber-500/30 text-[9px] uppercase tracking-[0.16em]"><AlertTriangle className="mr-1 h-2.5 w-2.5" />Needs approval</Badge>}
        </div>
        <div className="mt-1 text-[13.5px] leading-snug">{task.title}</div>
        {task.description && <div className="mt-1 text-[12px] text-foreground/60 line-clamp-2">{task.description}</div>}
      </div>
      <div className="flex flex-col items-end gap-1">
        {task.status === "needs_approval" && <Button size="sm" variant="default" className="h-7 text-[11px]" onClick={onApprove}>Approve</Button>}
        {task.status === "queued" && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onStart}>Start</Button>}
        {task.status === "in_progress" && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onDone}>Done</Button>}
        <button className="text-[10px] uppercase tracking-[0.16em] text-foreground/40 hover:text-foreground/70" onClick={onCancel}>Cancel</button>
      </div>
    </li>
  );
}

function NewTaskDialog({ kind, onClose, onSubmit }: {
  kind: OperatorKind;
  onClose: () => void;
  onSubmit: (v: { kind: OperatorKind; title: string; description?: string; priority?: "low" | "normal" | "high" | "urgent"; requires_approval?: boolean }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [requiresApproval, setRequiresApproval] = useState(false);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Queue task for {kind === "hunter" ? "Hunter" : "Builder"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="What needs to happen?" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
            Requires approval
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          disabled={!title.trim()}
          onClick={() => onSubmit({ kind, title: title.trim(), description: description.trim() || undefined, priority, requires_approval: requiresApproval })}
        >
          Queue task
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}