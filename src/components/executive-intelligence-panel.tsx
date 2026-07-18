// Executive Intelligence Panel (Phase 3C).
//
// Surfaces the deterministic Executive Health Score, the top prioritized
// Insights, and the actionable Recommendations produced by the intelligence
// sweep. Every action goes through typed, RLS-scoped server functions with
// an append-only audit trail (sam_recommendation_events).

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Loader2, Sparkles, ShieldAlert, CheckCircle2, Clock, X } from "lucide-react";
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
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  normal: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  low: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30",
};

function bandColor(overall: number): string {
  if (overall >= 0.85) return "text-emerald-400";
  if (overall >= 0.65) return "text-sky-400";
  if (overall >= 0.4) return "text-amber-400";
  return "text-red-400";
}
function bandLabel(overall: number): string {
  if (overall >= 0.85) return "Very high";
  if (overall >= 0.65) return "High";
  if (overall >= 0.4) return "Moderate";
  return "Low";
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

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 sm:p-4 space-y-4 overflow-hidden">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-sky-400" />
          <h2 className="truncate text-xs sm:text-sm font-semibold tracking-wide uppercase text-neutral-300">
            Executive Intelligence
          </h2>
        </div>
        <button
          type="button"
          onClick={() => sweepMut.mutate()}
          disabled={sweepMut.isPending}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
        >
          {sweepMut.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Activity className="h-3 w-3" />
          )}
          Run sweep
        </button>
      </header>
      {msg && <p className="text-xs text-neutral-400 break-words">{msg}</p>}

      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="min-w-0 rounded border border-neutral-800 bg-neutral-900/50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">Health score</div>
          {overall === null ? (
            <div className="mt-2 text-sm text-neutral-500">No snapshot yet. Run a sweep.</div>
          ) : (
            <>
              <div className={`mt-1 text-3xl font-semibold ${bandColor(overall)}`}>
                {Math.round(overall * 100)}
              </div>
              <div className="text-xs text-neutral-400">{bandLabel(overall)}</div>
              <ul className="mt-3 space-y-1 text-[11px] text-neutral-400">
                {categories.slice(0, 6).map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-2 min-w-0">
                    <span className="truncate capitalize">{c.key.replace(/_/g, " ")}</span>
                    <span className={`shrink-0 tabular-nums ${bandColor(c.score)}`}>{Math.round(c.score * 100)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
              <ShieldAlert className="h-3 w-3" /> Priority insights
            </div>
            <ul className="mt-2 space-y-1.5">
              {(insightsQ.data ?? []).length === 0 && (
                <li className="text-xs text-neutral-500">No open insights.</li>
              )}
              {(insightsQ.data ?? []).map((i) => (
                <li
                  key={i.id}
                  className="flex items-start justify-between gap-2 rounded border border-neutral-800 bg-neutral-900/40 px-2 py-1.5 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase ${priorityChip[i.priority] ?? priorityChip.normal}`}
                      >
                        {i.priority}
                      </span>
                      <span className="min-w-0 truncate text-xs font-medium text-neutral-200">
                        {i.title}
                      </span>
                    </div>
                    {i.summary && (
                      <div className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                        {i.summary}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss insight"
                    className="shrink-0 rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                    onClick={() =>
                      dismissFn({ data: { organizationId, insightId: i.id } }).then(invalidate)
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
              <CheckCircle2 className="h-3 w-3" /> Action Center
            </div>
            <ul className="mt-2 space-y-1.5">
              {(recsQ.data ?? []).length === 0 && (
                <li className="text-xs text-neutral-500">No pending recommendations.</li>
              )}
              {(recsQ.data ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 rounded border border-neutral-800 bg-neutral-900/40 px-2 py-1.5 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase ${priorityChip[r.priority] ?? priorityChip.normal}`}
                      >
                        {r.priority}
                      </span>
                      <span className="min-w-0 truncate text-xs font-medium text-neutral-200">
                        {r.title}
                      </span>
                    </div>
                    {r.rationale && (
                      <div className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                        {r.rationale}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                    <button
                      type="button"
                      className="rounded border border-emerald-600/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
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
                      Accept
                    </button>
                    <button
                      type="button"
                      aria-label="Snooze"
                      className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-800"
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
                      className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-300 hover:bg-neutral-800"
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
                      Dismiss
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