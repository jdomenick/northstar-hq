import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, TrendingUp, Users, Briefcase, ShieldAlert, AlertCircle, Activity, Target, Sparkles, RefreshCw } from "lucide-react";
import { getNSLBrief, type NslBrief, type NslBriefTone } from "@/lib/northstar/brief.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  organizationId: string | null;
  onRunSweep?: () => void;
  sweepPending?: boolean;
}

const toneClasses: Record<NslBriefTone, { bg: string; border: string; text: string; badge: string }> = {
  strong: {
    bg: "bg-brand-ok/10",
    border: "border-brand-ok/25",
    text: "text-brand-ok",
    badge: "bg-brand-ok/15 text-brand-ok border-brand-ok/30",
  },
  stable: {
    bg: "bg-primary/8",
    border: "border-primary/20",
    text: "text-primary",
    badge: "bg-primary/10 text-primary border-primary/25",
  },
  attention: {
    bg: "bg-brand-warn/10",
    border: "border-brand-warn/25",
    text: "text-brand-warn",
    badge: "bg-brand-warn/15 text-brand-warn border-brand-warn/30",
  },
  critical: {
    bg: "bg-brand-danger/10",
    border: "border-brand-danger/25",
    text: "text-brand-danger",
    badge: "bg-brand-danger/15 text-brand-danger border-brand-danger/30",
  },
};

const signalToneClasses: Record<"ok" | "warn" | "danger", { text: string; icon: typeof TrendingUp }> = {
  ok: { text: "text-brand-ok", icon: TrendingUp },
  warn: { text: "text-brand-warn", icon: AlertCircle },
  danger: { text: "text-brand-danger", icon: ShieldAlert },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NslBriefPanel({ organizationId, onRunSweep, sweepPending }: Props) {
  const fetch = useServerFn(getNSLBrief);
  const q = useQuery({
    queryKey: ["nsl-brief", organizationId],
    enabled: !!organizationId,
    queryFn: () => fetch({ data: { organizationId: organizationId! } }),
  });

  const brief = q.data;

  if (!organizationId) return null;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            NorthStar Labs Brief
          </div>
          <h1 className="mt-2 font-display text-[40px] leading-[1.02] tracking-tight text-foreground md:text-[60px]">
            The Brief
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {onRunSweep && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRunSweep}
              disabled={sweepPending}
              className="h-8 gap-1.5 text-[11px] uppercase tracking-[0.16em]"
            >
              {sweepPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          )}
          <div className="text-[11px] italic text-muted-foreground">
            {brief ? new Date(brief.generatedAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Loading"}
          </div>
        </div>
      </header>

      {q.isLoading && (
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        </div>
      )}

      {q.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Brief failed to load. {q.error instanceof Error ? q.error.message : ""}
        </div>
      )}

      {brief && (
        <div className="space-y-14">
          {/* Business Status */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Business Status
            </div>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border",
                  toneClasses[brief.businessStatus.tone].bg,
                  toneClasses[brief.businessStatus.tone].border,
                )}
              >
                <Target className={cn("h-5 w-5", toneClasses[brief.businessStatus.tone].text)} />
              </div>
              <p className="font-display text-[22px] leading-[1.35] text-foreground md:text-[28px]">
                {brief.businessStatus.sentence}
              </p>
            </div>
          </section>

          {/* Key Signals */}
          <section>
            <div className="mb-5 text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Key Signals
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SignalCard icon={TrendingUp} label="Revenue" signal={brief.keySignals.revenue} />
              <SignalCard icon={Briefcase} label="Pipeline" signal={brief.keySignals.pipeline} />
              <SignalCard icon={Users} label="Delivery" signal={brief.keySignals.delivery} />
              <SignalCard icon={ShieldAlert} label="Risk" signal={brief.keySignals.risk} />
            </div>
          </section>

          {/* What Changed */}
          <section>
            <div className="mb-5 flex items-baseline justify-between">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                What Changed
              </div>
              <div className="text-[11px] italic text-muted-foreground">Last 7 days</div>
            </div>
            {brief.whatChanged.length === 0 ? (
              <div className="rounded-lg border border-border bg-card px-4 py-6 text-[13.5px] italic text-muted-foreground">
                No meaningful changes in the last week. A quiet week is a good week.
              </div>
            ) : (
              <ol className="space-y-3">
                {brief.whatChanged.map((c, i) => (
                  <li key={c.id}>
                    <ChangeRow change={c} index={i + 1} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            {/* Priority Insights */}
            <section>
              <div className="mb-5 text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Priority Insights
              </div>
              {brief.priorityInsights.length === 0 ? (
                <div className="rounded-lg border border-border bg-card px-4 py-6 text-[13.5px] italic text-muted-foreground">
                  No open insights. Run a sweep if data has changed.
                </div>
              ) : (
                <ol className="space-y-3">
                  {brief.priorityInsights.map((insight) => (
                    <li key={insight.id}>
                      <InsightRow insight={insight} />
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Recommended Focus */}
            <section>
              <div className="mb-5 flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Recommended Focus
              </div>
              {brief.recommendedFocus ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <div className="font-display text-[20px] leading-[1.3] text-foreground">
                    {brief.recommendedFocus.title}
                  </div>
                  {brief.recommendedFocus.rationale && (
                    <p className="mt-3 text-[13.5px] leading-[1.7] text-muted-foreground">
                      {brief.recommendedFocus.rationale}
                    </p>
                  )}
                  {brief.recommendedFocus.href && (
                    <Link
                      to={brief.recommendedFocus.href}
                      className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                    >
                      Act on this <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card px-4 py-6 text-[13.5px] italic text-muted-foreground">
                  No single action stands out. Keep the current rhythm.
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function SignalCard({
  icon: Icon,
  label,
  signal,
}: {
  icon: typeof TrendingUp;
  label: string;
  signal: NslBrief["keySignals"]["revenue"];
}) {
  const tone = signalToneClasses[signal.tone];
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <tone.icon className={cn("h-4 w-4", tone.text)} />
      </div>
      <div className={cn("mt-3 font-display text-[32px] leading-none tabular-nums", tone.text)}>
        {signal.value}
      </div>
      <div className="mt-2 text-[11.5px] leading-[1.5] text-muted-foreground">{signal.subtext}</div>
    </div>
  );
}

function ChangeRow({ change, index }: { change: NslBrief["whatChanged"][number]; index: number }) {
  const content = (
    <div className="group flex items-start gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/30">
      <span className="font-display text-[22px] leading-none text-muted-foreground">{String(index).padStart(2, "0")}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-snug text-foreground">{change.title}</div>
        {change.detail && <div className="mt-1 text-[12px] text-muted-foreground">{change.detail}</div>}
        <div className="mt-2 text-[11px] tabular-nums text-muted-foreground/70">{timeAgo(change.occurredAt)}</div>
      </div>
      {change.href && (
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      )}
    </div>
  );

  return change.href ? <Link to={change.href}>{content}</Link> : content;
}

function InsightRow({ insight }: { insight: NslBrief["priorityInsights"][number] }) {
  const tone = insight.priority === "critical" ? "danger" : insight.priority === "high" ? "warn" : "ok";
  const classes = signalToneClasses[tone];
  return (
    <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold", classes.text, tone === "danger" ? "bg-brand-danger/10 border-brand-danger/20" : tone === "warn" ? "bg-brand-warn/10 border-brand-warn/20" : "bg-brand-ok/10 border-brand-ok/20")}>
        {insight.rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] font-semibold uppercase tracking-wider", classes.text)}>{insight.priority}</span>
        </div>
        <div className="mt-1 text-[15px] leading-snug text-foreground">{insight.title}</div>
        {insight.summary && <div className="mt-1 text-[12.5px] text-muted-foreground">{insight.summary}</div>}
      </div>
    </div>
  );
}
