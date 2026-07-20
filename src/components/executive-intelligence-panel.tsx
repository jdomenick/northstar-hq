// Executive Intelligence Panel (Phase 3C).
//
// Surfaces the deterministic Executive Health Score, the top prioritized
// Insights, and the actionable Recommendations produced by the intelligence
// sweep. Every action goes through typed, RLS-scoped server functions with
// an append-only audit trail (sam_recommendation_events).

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Clock,
  X,
  ArrowUpRight,
  Gauge,
} from "lucide-react";
import {
  actOnRecommendation,
  dismissInsight,
  getHealthSnapshot,
  listInsights,
  listRecommendations,
  runIntelligenceSweep,
} from "@/lib/sam/intelligence/intelligence.functions";

type Props = { organizationId: string | null };

const priorityChip: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/25",
  high: "bg-[color:var(--warning)]/10 text-[color:var(--warning)] border-[color:var(--warning)]/25",
  normal: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

function bandTone(overall: number): { text: string; bar: string } {
  if (overall >= 0.85)
    return { text: "text-[color:var(--success)]", bar: "bg-[color:var(--success)]" };
  if (overall >= 0.65) return { text: "text-primary", bar: "bg-primary" };
  if (overall >= 0.4)
    return { text: "text-[color:var(--warning)]", bar: "bg-[color:var(--warning)]" };
  return { text: "text-destructive", bar: "bg-destructive" };
}

function bandLabel(overall: number): string {
  if (overall >= 0.85) return "Very high";
  if (overall >= 0.65) return "High";
  if (overall >= 0.4) return "Moderate";
  return "Low";
}

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ExecutiveIntelligencePanel({ organizationId }: Props) {
  const qc = useQueryClient();
  const sweep = useServerFn(runIntelligenceSweep);
  const dismissFn = useServerFn(dismissInsight);
  const actFn = useServerFn(actOnRecommendation);

  const insightsQ = useQuery({
    queryKey: ["exec-intel", "insights", organizationId],
    enabled: !!organizationId,
    queryFn: () => listInsights({ data: { organizationId: organizationId!, limit: 8 } }),
  });
  const recsQ = useQuery({
    queryKey: ["exec-intel", "recs", organizationId],
    enabled: !!organizationId,
    queryFn: () => listRecommendations({ data: { organizationId: organizationId!, limit: 8 } }),
  });
  const healthQ = useQuery({
    queryKey: ["exec-intel", "health", organizationId],
    enabled: !!organizationId,
    queryFn: () => getHealthSnapshot({ data: { organizationId: organizationId!, ventureId: null } }),
  });

  const [msg, setMsg] = useState<string | null>(null);

  const sweepMut = useMutation({
    mutationFn: async () => sweep({ data: { organizationId: organizationId! } }),
    onSuccess: (res) => {
      setMsg(
        `Sweep complete: ${res.insightsPersisted} insights, ${res.recommendationsPersisted} recommendations.`,
      );
      qc.invalidateQueries({ queryKey: ["exec-intel"] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : "Sweep failed"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["exec-intel"] });

  const overall = healthQ.data?.overall ?? null;
  const categories = useMemo(() => {
    const raw = healthQ.data?.categories;
    if (!raw || typeof raw !== "object") return [] as Array<{ key: string; score: number }>;
    return Object.entries(raw as Record<string, { score: number }>).map(([key, v]) => ({
      key,
      score: typeof v?.score === "number" ? v.score : 0,
    }));
  }, [healthQ.data]);

  if (!organizationId) return null;

  const tone = overall !== null ? bandTone(overall) : null;

  return (
    <section className="surface-elevated overflow-hidden rounded-xl">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Gauge className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Executive Intelligence
            </div>
            <h2 className="font-display truncate text-sm font-semibold text-foreground">
              Operating signal
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => sweepMut.mutate()}
          disabled={sweepMut.isPending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-secondary disabled:opacity-50"
        >
          {sweepMut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Activity className="h-3.5 w-3.5" />
          )}
          Run sweep
        </button>
      </header>

      {msg && (
        <p className="border-b border-border bg-secondary/40 px-4 py-2 text-xs text-muted-foreground sm:px-5">
          {msg}
        </p>
      )}

      <div className="grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* Health score column */}
        <div className="border-b border-border p-4 sm:p-5 md:border-b-0 md:border-r">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Health score
          </div>
          {overall === null || !tone ? (
            <div className="mt-3 text-sm text-muted-foreground">
              No snapshot yet. Run a sweep.
            </div>
          ) : (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <div className={`font-display text-5xl font-semibold tabular-nums ${tone.text}`}>
                  {Math.round(overall * 100)}
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  / 100 · {bandLabel(overall)}
                </div>
              </div>
              <ul className="mt-5 space-y-2.5">
                {categories.slice(0, 6).map((c) => {
                  const t = bandTone(c.score);
                  return (
                    <li key={c.key} className="min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-foreground">{humanize(c.key)}</span>
                        <span className={`shrink-0 font-medium tabular-nums ${t.text}`}>
                          {Math.round(c.score * 100)}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${t.bar}`}
                          style={{ width: `${Math.max(2, Math.round(c.score * 100))}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Insights + Actions column */}
        <div className="min-w-0 divide-y divide-border">
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> Priority insights
            </div>
            <ul className="mt-3 space-y-2">
              {(insightsQ.data ?? []).length === 0 && (
                <li className="text-xs text-muted-foreground">No open insights.</li>
              )}
              {(insightsQ.data ?? []).map((i) => (
                <li
                  key={i.id}
                  className="group flex min-w-0 items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm transition hover:border-primary/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${priorityChip[i.priority] ?? priorityChip.normal}`}
                      >
                        {i.priority}
                      </span>
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {i.title}
                      </span>
                    </div>
                    {i.summary && (
                      <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {i.summary}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss insight"
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() =>
                      dismissFn({ data: { organizationId, insightId: i.id } }).then(invalidate)
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> Action center
            </div>
            <ul className="mt-3 space-y-2">
              {(recsQ.data ?? []).length === 0 && (
                <li className="text-xs text-muted-foreground">No pending recommendations.</li>
              )}
              {(recsQ.data ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${priorityChip[r.priority] ?? priorityChip.normal}`}
                      >
                        {r.priority}
                      </span>
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {r.title}
                      </span>
                    </div>
                    {r.rationale && (
                      <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {r.rationale}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-start">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground shadow-sm hover:opacity-90"
                      onClick={() =>
                        actFn({
                          data: {
                            organizationId,
                            recommendationId: r.id,
                            action: "accepted",
                          },
                        }).then(invalidate)
                      }
                    >
                      Accept <ArrowUpRight className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Snooze"
                      className="rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      onClick={() =>
                        actFn({
                          data: {
                            organizationId,
                            recommendationId: r.id,
                            action: "snoozed",
                          },
                        }).then(invalidate)
                      }
                    >
                      <Clock className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss"
                      className="rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      onClick={() =>
                        actFn({
                          data: {
                            organizationId,
                            recommendationId: r.id,
                            action: "dismissed",
                          },
                        }).then(invalidate)
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
