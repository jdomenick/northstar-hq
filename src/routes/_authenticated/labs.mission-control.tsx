import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Play, Pause, Plus, Circle, CheckCircle2, Clock, AlertTriangle, DollarSign, Rocket, Building2, ShieldCheck, GitBranch, Sparkles, ArrowUpRight, ArrowRight, Flag, Plug,
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
import { OPERATOR_LABELS, OPERATOR_SUBTITLES, OPERATOR_PURPOSE } from "@/lib/mission-control/labels";
import {
  listIntegrationsDashboard,
  type IntegrationRow,
} from "@/lib/integrations/dashboard.functions";
import type { ExecutiveImpact } from "@/lib/integrations/executive-action";

export const Route = createFileRoute("/_authenticated/labs/mission-control")({
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

  // Integrations Attention: reuse the existing Integrations dashboard as the
  // single source of truth. We only surface Warning/Error rows here; healthy
  // integrations stay silent.
  const integrationsListFn = useServerFn(listIntegrationsDashboard);
  const integrationsDashboard = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["mc.integrations-attention", activeOrgId],
    queryFn: () => integrationsListFn({ data: { organizationId: activeOrgId! } }),
  });
  const impactRank: Record<ExecutiveImpact, number> = { high: 3, medium: 2, low: 1 };
  const healthRank: Record<"error" | "warning" | "healthy", number> = { error: 3, warning: 2, healthy: 1 };
  const attentionRows = (integrationsDashboard.data ?? [])
    .filter((r) => r.executiveAction.actionRequired && r.executiveAction.health !== "healthy")
    .sort((a, b) => {
      const h = (healthRank[b.executiveAction.health] ?? 0) - (healthRank[a.executiveAction.health] ?? 0);
      if (h !== 0) return h;
      const ai = a.executiveAction.impact ? impactRank[a.executiveAction.impact] : 0;
      const bi = b.executiveAction.impact ? impactRank[b.executiveAction.impact] : 0;
      return bi - ai;
    });
  const topIntegration = attentionRows[0] ?? null;

  // CTO: integration connections + automation job health (real data only).
  const integrations = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["mc.integrations", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_connections")
        .select("id,display_name,status,last_error_at,last_error_code,last_successful_sync_at")
        .eq("organization_id", activeOrgId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });
  const jobs24h = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["mc.jobs24h", activeOrgId],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("automation_jobs")
        .select("id,status,job_type,completed_at,created_at")
        .eq("organization_id", activeOrgId!)
        .gte("created_at", since);
      if (error) throw error;
      return data ?? [];
    },
  });

  // CMO: campaigns + content pipeline (real data only).
  const campaigns = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["mc.campaigns", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_campaigns")
        .select("id,name,paused,end_at")
        .eq("organization_id", activeOrgId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });
  const contentItems = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["mc.contentItems", activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_content_items")
        .select("id,status,approval_status,scheduled_for,published_at,blocked_reason")
        .eq("organization_id", activeOrgId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const conns = integrations.data ?? [];
  const connectedCount = conns.filter((c) => c.status === "active").length;
  const erroredConns = conns.filter((c) => c.status === "error");
  const jobs = jobs24h.data ?? [];
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const runningJobs = jobs.filter((j) => j.status === "running" || j.status === "queued");

  const activeCampaigns = (campaigns.data ?? []).filter((c) => !c.paused && (!c.end_at || new Date(c.end_at).getTime() > now));
  const items = contentItems.data ?? [];
  const awaitingApproval = items.filter((i) => i.approval_status === "pending" || i.status === "in_review" || i.status === "pending_approval");
  const scheduledContent = items.filter((i) => i.scheduled_for && !i.published_at && new Date(i.scheduled_for).getTime() > now);
  const publishedThisWeek = items.filter((i) => i.published_at && (now - new Date(i.published_at).getTime()) < 7 * 24 * 60 * 60 * 1000);
  const blockedContent = items.filter((i) => i.status === "blocked" || !!i.blocked_reason);

  const rev = summarizeRevenue(clients.data ?? [], pipeline.data ?? [], cash.data ?? [], proposals.data ?? []);
  const activeVentures = (ventures.data ?? []).filter((v) => v.status !== "archived" && v.status !== "closed");
  const atRiskProjects = (projects.data ?? []).filter((p) => p.status === "at_risk" || p.status === "blocked");
  const waitingDecisions = (decisions.data ?? []).filter((d) => isDecisionWaiting(d, user?.id ?? null));
  const overdueCommitments = (commitments.data ?? []).filter(isCommitmentOverdue);
  const goalsAtRisk = (goals.data ?? []).filter(isGoalAtRisk);

  // Revenue at risk: open deals whose expected close has passed.
  const now = Date.now();
  const atRiskDeals = (pipeline.data ?? []).filter(
    (d) => d.stage !== "won" && d.stage !== "lost" && d.expected_close && new Date(d.expected_close).getTime() < now,
  );
  const revenueAtRiskCents = atRiskDeals.reduce((s, d) => s + (d.value_cents ?? 0), 0);

  // Highest priority SAM recommendation.
  const severityRank: Record<string, number> = { critical: 5, warning: 4, attention: 3, opportunity: 2, information: 1 };
  const priorityRank: Record<string, number> = { critical: 4, high: 3, normal: 2, low: 1 };
  const topInsight = [...(insights.data ?? [])].sort((a, b) => {
    const sd = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);
    if (sd !== 0) return sd;
    return (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0);
  })[0];
  const activeInsightsCount = (insights.data ?? []).length;
  const opportunityCount = (insights.data ?? []).filter((i) => i.severity === "opportunity").length;

  return (
    <div className="min-h-screen">
      {/* Header bar */}
      <header className="border-b border-border bg-card/55 px-4 pt-6 md:px-10 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
                <span className="truncate">{orgName} · Mission Control</span>
              </div>
              <h1 className="mt-2 font-display text-[27px] font-semibold leading-[1.1] md:text-[34px]">Mission Control</h1>
            </div>
            <div className="text-right text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-8 space-y-8">
        {/* Executive Priorities: answers "what needs my attention right now?" */}
        <section>
          <SectionHeader title="Executive priorities" hint="What requires your attention right now" />
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <PriorityTile
              label="Revenue at risk"
              value={revenueAtRiskCents > 0 ? formatMoney(revenueAtRiskCents, { compact: true }) : "None"}
              sub={atRiskDeals.length > 0 ? `${atRiskDeals.length} deal${atRiskDeals.length === 1 ? "" : "s"} past expected close` : "No open deals past due"}
              tone={atRiskDeals.length > 0 ? "warn" : "ok"}
              to="/labs/revenue"
            />
            <PriorityTile
              label="Decisions waiting"
              value={String(waitingDecisions.length)}
              sub={waitingDecisions[0]?.title ?? "Nothing waiting on you"}
              tone={waitingDecisions.length > 0 ? "warn" : "ok"}
              to="/labs/decisions"
            />
            <PriorityTile
              label="Overdue commitments"
              value={String(overdueCommitments.length)}
              sub={overdueCommitments[0]?.title ?? "All commitments on time"}
              tone={overdueCommitments.length > 0 ? "warn" : "ok"}
              to="/labs/accountability"
            />
            <PriorityTile
              label="Projects at risk"
              value={String(atRiskProjects.length)}
              sub={atRiskProjects[0]?.name ?? "Delivery is clean"}
              tone={atRiskProjects.length > 0 ? "warn" : "ok"}
              to="/labs/projects"
            />
            <PriorityTile
              label="Goals at risk"
              value={String(goalsAtRisk.length)}
              sub={goalsAtRisk[0]?.title ?? "All goals on track"}
              tone={goalsAtRisk.length > 0 ? "warn" : "ok"}
              to="/labs/goals"
            />
            <PriorityTile
              label="Top SAM recommendation"
              value={topInsight ? (topInsight.severity.charAt(0).toUpperCase() + topInsight.severity.slice(1)) : "None"}
              sub={topInsight?.title ?? "No active recommendations"}
              tone={topInsight && (topInsight.severity === "critical" || topInsight.severity === "warning") ? "warn" : "ok"}
              to="/sam"
            />
            {topIntegration && (
              <PriorityTile
                label="Top integration issue"
                value={topIntegration.label}
                sub={topIntegration.executiveAction.title ?? topIntegration.executiveAction.issue ?? "Attention required"}
                tone={topIntegration.executiveAction.health === "error" ? "warn" : "warn"}
                to={`/sam/integrations?open=${encodeURIComponent(topIntegration.key)}`}
              />
            )}
          </div>
        </section>

        {/* Integrations Attention: only renders when at least one integration
            has a Warning or Error state. Healthy integrations stay silent. */}
        {attentionRows.length > 0 && (
          <section>
            <SectionHeader
              title="Integrations attention"
              hint={`${attentionRows.length} integration${attentionRows.length === 1 ? "" : "s"} need action`}
            />
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {attentionRows.map((r) => (
                <IntegrationAttentionCard key={r.key} row={r} />
              ))}
            </div>
          </section>
        )}

        {/* Top KPI strip */}
        <section className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-card shadow-[0_14px_40px_-34px_oklch(0.22_0.02_255/0.5)] md:grid-cols-4">
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
              link={{ to: "/labs/ventures", label: "Ventures" }}
            />
            <ExecCard title="COO" subtitle="Delivery & operations" icon={Building2}
              stats={[
                { label: "Projects", value: (projects.data ?? []).length },
                { label: "At risk", value: atRiskProjects.length, tone: atRiskProjects.length > 0 ? "warn" : undefined },
                { label: "Overdue commitments", value: overdueCommitments.length, tone: overdueCommitments.length > 0 ? "warn" : undefined },
              ]}
              detail={atRiskProjects[0] ? `Top risk: ${atRiskProjects[0].name}` : "Delivery is clean this week."}
              link={{ to: "/labs/projects", label: "Projects" }}
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
              link={{ to: "/labs/revenue", label: "Revenue" }}
            />
            <ExecCard title="CMO" subtitle="Content & audience" icon={Sparkles}
              stats={[
                { label: "Campaigns running", value: activeCampaigns.length },
                { label: "Awaiting approval", value: awaitingApproval.length, tone: awaitingApproval.length > 0 ? "warn" : undefined },
                { label: "Scheduled", value: scheduledContent.length },
              ]}
              detail={
                blockedContent.length > 0
                  ? `${blockedContent.length} item${blockedContent.length === 1 ? "" : "s"} blocked from publishing.`
                  : awaitingApproval.length > 0
                    ? `${awaitingApproval.length} item${awaitingApproval.length === 1 ? "" : "s"} waiting on your approval.`
                    : publishedThisWeek.length > 0
                      ? `${publishedThisWeek.length} published in the last 7 days.`
                      : items.length === 0
                        ? "No content created yet."
                        : "Nothing scheduled or awaiting approval."
              }
              link={{ to: "/content-ops", label: "Content Ops" }}
            />
            <ExecCard title="CTO" subtitle="Systems & automation" icon={GitBranch}
              stats={[
                { label: "Connected systems", value: connectedCount },
                { label: "Integrations in error", value: erroredConns.length, tone: erroredConns.length > 0 ? "warn" : undefined },
                { label: "Failed jobs · 24h", value: failedJobs.length, tone: failedJobs.length > 0 ? "warn" : undefined },
              ]}
              detail={
                erroredConns.length > 0
                  ? `${erroredConns[0].display_name} is in an error state.`
                  : failedJobs.length > 0
                    ? `${failedJobs.length} automation${failedJobs.length === 1 ? "" : "s"} failed in the last 24 hours.`
                    : conns.length === 0
                      ? "No integrations connected yet."
                      : `${runningJobs.length} job${runningJobs.length === 1 ? "" : "s"} in flight, ${jobs.length} run in the last 24h.`
              }
              link={{ to: "/sam/integrations", label: "Integrations" }}
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
              link={{ to: "/labs/revenue", label: "Revenue" }}
            />
          </div>
        </section>

        {/* SAM Work Queues */}
        <section>
          <SectionHeader
            title="SAM work queues"
            hint={connectedCount > 0
              ? "Queued work, approvals, and audit history"
              : "Managed manually until integrations are connected"}
          />
          {connectedCount === 0 && (
            <div className="mt-3 rounded-md border border-border bg-card px-4 py-3 text-[12px] text-foreground/70">
              No integrations are connected yet, so these queues are worked manually. Add a connection under{" "}
              <Link to="/sam/integrations" className="underline underline-offset-2">Integrations</Link>{" "}
              to let SAM take actions on your behalf.
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OperatorPanel
              kind="hunter"
              title={OPERATOR_LABELS.hunter}
              subtitle={OPERATOR_SUBTITLES.hunter}
              purpose={OPERATOR_PURPOSE.hunter}
              orgId={activeOrgId}
              canAdmin={canAdmin}
              states={operators.data ?? []}
            />
            <OperatorPanel
              kind="builder"
              title={OPERATOR_LABELS.builder}
              subtitle={OPERATOR_SUBTITLES.builder}
              purpose={OPERATOR_PURPOSE.builder}
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-border pb-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-1 w-1 shrink-0 rounded-full bg-primary/80" />
        <h2 className="truncate text-[10.5px] font-medium uppercase tracking-[0.22em] text-foreground/80">{title}</h2>
      </div>
      {hint && <div className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{hint}</div>}
    </div>
  );
}

function KpiTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="min-w-0 border-b border-r border-border p-4 last:border-r-0 md:border-b-0">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 font-display text-[24px] leading-none tabular-nums text-foreground", tone === "warn" && "text-destructive")}>{value}</div>
      {sub && <div className="mt-2 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PriorityTile({
  label, value, sub, tone, to,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "ok" | "warn";
  to: string;
}) {
  return (
    <a
      href={to}
      className={cn(
        "group flex min-w-0 flex-col rounded-md border bg-card p-4 transition-colors",
        tone === "warn" ? "border-destructive/40 hover:border-destructive/60" : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        {tone === "warn"
          ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" strokeWidth={1.8} />
          : <Flag className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.8} />}
      </div>
      <div className={cn("mt-2 font-display text-[22px] leading-none tabular-nums", tone === "warn" && "text-destructive")}>{value}</div>
      <div className="mt-2 line-clamp-2 text-[11.5px] leading-snug text-foreground/70">{sub}</div>
      <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 group-hover:text-foreground">
        Open <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
      </div>
    </a>
  );
}

function IntegrationAttentionCard({ row }: { row: IntegrationRow }) {
  const a = row.executiveAction;
  const isError = a.health === "error";
  const tone = isError
    ? { border: "border-[oklch(0.5_0.18_27)]/40", dot: "bg-[oklch(0.5_0.18_27)]", text: "text-[oklch(0.5_0.18_27)]", label: "Error" }
    : { border: "border-[oklch(0.75_0.15_75)]/40", dot: "bg-[oklch(0.75_0.15_75)]", text: "text-[oklch(0.6_0.15_75)]", label: "Warning" };
  const impactLabel = a.impact
    ? a.impact === "high" ? "High impact" : a.impact === "medium" ? "Medium impact" : "Low impact"
    : null;
  return (
    <a
      href={`/sam/integrations?open=${encodeURIComponent(row.key)}`}
      className={cn(
        "group flex min-w-0 flex-col rounded-md border bg-card p-4 transition-colors hover:border-foreground/30",
        tone.border,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Plug className="h-3.5 w-3.5 shrink-0 text-foreground/60" strokeWidth={1.8} />
          <span className="truncate font-display text-[15px] leading-none">{row.label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
          <span className={cn("text-[10px] font-medium uppercase tracking-[0.18em]", tone.text)}>{tone.label}</span>
        </div>
      </div>
      {a.title && (
        <div className={cn("mt-3 text-[13px] font-medium", tone.text)}>{a.title}</div>
      )}
      {a.issue && (
        <div className="mt-1 line-clamp-2 text-[12px] leading-snug text-foreground/80">{a.issue}</div>
      )}
      {a.nextStep && (
        <div className="mt-2 text-[12px] leading-snug text-muted-foreground">
          <span className="text-foreground/70">Next step:</span> {a.nextStep}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
        <span>{impactLabel ?? "\u00a0"}</span>
        <span className="group-hover:text-foreground">
          Open details <ArrowRight className="ml-0.5 inline h-3 w-3" />
        </span>
      </div>
    </a>
  );
}

function ExecCard({
  title, subtitle, icon: Icon, stats, detail, link,
}: {
  title: string; subtitle: string;
  icon: typeof Rocket;
  stats: { label: string; value: string | number; tone?: "warn" }[];
  detail: string;
  link: { to: "/labs/ventures" | "/labs/projects" | "/labs/revenue" | "/sam/integrations" | "/content-ops"; label: string };
}) {
  return (
    <div className="flex flex-col rounded-md border border-border bg-card shadow-[0_16px_42px_-38px_oklch(0.22_0.02_255/0.55)]">
      <div className="flex items-start justify-between border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" strokeWidth={1.8} />
            <div className="font-display text-[17px] font-semibold leading-none">{title}</div>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-foreground/55">{subtitle}</div>
        </div>
        <Link to={link.to} className="text-[10.5px] uppercase tracking-[0.2em] text-foreground/55 hover:text-foreground">
          {link.label} <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-3 border-b border-border px-5 py-4">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <div className={cn("font-display text-[22px] leading-none tabular-nums", s.tone === "warn" && "text-[oklch(0.5_0.18_27)]")}>{s.value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-foreground/55">{s.label}</div>
          </div>
        ))}
      </div>
      <p className="px-5 py-4 text-[13px] leading-relaxed text-foreground/75">{detail}</p>
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
    <div className="rounded-md border border-border bg-card shadow-[0_16px_42px_-38px_oklch(0.22_0.02_255/0.55)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border p-5">
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
        <DialogTitle>Queue task for {OPERATOR_LABELS[kind]}</DialogTitle>
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