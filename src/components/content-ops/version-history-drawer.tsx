// Revision history drawer with Compare / Restore. All history is
// read-only; restoring simply appends a new version via the server
// (so the timeline stays immutable).

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { Ledger, LedgerRow, QuietPanel, SectionLabel, StatusLine } from "@/components/editorial";
import { diffLines, summarizeDiff } from "@/lib/content-ops/editorial-diff";
import { loadVersionSnapshotsForDiff, restoreVariantVersion } from "@/lib/content-ops/editorial.functions";

interface VersionRow {
  id: string;
  content_item_id: string;
  version: number;
  generated_by: string;
  generated_by_actor_id: string | null;
  change_reason: string | null;
  created_at: string;
  content_hash: string;
}
interface ApprovalRow {
  id: string;
  content_item_id: string;
  content_version: number;
  action: string;
  notes: string | null;
  approved_by: string | null;
  approved_at: string;
}
interface ScheduleAuditRow {
  id: string;
  action: string;
  scheduled_for: string | null;
  actor_id: string | null;
  created_at: string;
  note: string | null;
}

export function VersionHistoryDrawer({
  organizationId, ventureId, contentItemId,
  currentVersion, currentApprovalStatus,
  versions, approvals, scheduleAudit, publicationAttempts,
}: {
  organizationId: string;
  ventureId: string;
  contentItemId: string;
  currentVersion: number;
  currentApprovalStatus: string;
  versions: VersionRow[];
  approvals: ApprovalRow[];
  scheduleAudit?: ScheduleAuditRow[];
  publicationAttempts?: Array<{ id: string; status: string; attempted_at: string; error_message: string | null }>;
}) {
  const qc = useQueryClient();
  const loadDiff = useServerFn(loadVersionSnapshotsForDiff);
  const restoreFn = useServerFn(restoreVariantVersion);

  const scoped = useMemo(
    () => versions.filter((v) => v.content_item_id === contentItemId).sort((a, b) => b.version - a.version),
    [versions, contentItemId],
  );
  const scopedApprovals = useMemo(
    () => approvals.filter((a) => a.content_item_id === contentItemId),
    [approvals, contentItemId],
  );

  const [a, setA] = useState<number | null>(scoped[1]?.version ?? null);
  const [b, setB] = useState<number | null>(scoped[0]?.version ?? null);

  const diffQ = useQuery({
    queryKey: ["content-ops", "version-diff", contentItemId, a, b],
    enabled: a != null && b != null && a !== b,
    queryFn: () => loadDiff({ data: { organizationId, ventureId, contentItemId, versionA: a!, versionB: b! } }),
  });

  const restoreMut = useMutation({
    mutationFn: async (version: number) =>
      restoreFn({ data: { organizationId, ventureId, contentItemId, version, changeReason: `Restored from v${version}` } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-ops", "editor"] });
      qc.invalidateQueries({ queryKey: ["content-ops", "version-diff", contentItemId] });
    },
  });

  const diff = useMemo(() => {
    if (!diffQ.data) return null;
    const aText = (diffQ.data.a.body as string) ?? "";
    const bText = (diffQ.data.b.body as string) ?? "";
    const lines = diffLines(aText, bText);
    return { lines, summary: summarizeDiff(lines) };
  }, [diffQ.data]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <QuietPanel className="!p-4">
          <SectionLabel>Revisions</SectionLabel>
          {scoped.length === 0 ? (
            <div className="mt-3 text-[13px] text-foreground/55">No versions yet.</div>
          ) : (
            <ul className="mt-3 space-y-1">
              {scoped.map((v) => {
                const isCurrent = v.version === currentVersion;
                return (
                  <li key={v.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 py-1.5 text-[12.5px]">
                    <span className="w-8 font-mono text-foreground/60">v{v.version}</span>
                    <span className="min-w-0 truncate text-foreground/75">
                      {v.change_reason ?? v.generated_by}
                      {isCurrent && <span className="ml-1 text-[10px] uppercase tracking-[0.2em] text-foreground/45">current</span>}
                    </span>
                    <label className="text-[10.5px] uppercase tracking-[0.2em] text-foreground/50">
                      <input type="radio" name="cmpA" className="mr-1 align-middle" checked={a === v.version} onChange={() => setA(v.version)} />A
                    </label>
                    <label className="text-[10.5px] uppercase tracking-[0.2em] text-foreground/50">
                      <input type="radio" name="cmpB" className="mr-1 align-middle" checked={b === v.version} onChange={() => setB(v.version)} />B
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </QuietPanel>

        <div className="space-y-2 text-[12px] text-foreground/60">
          <div>Approval state: <b className="text-foreground/85">{currentApprovalStatus}</b></div>
          <div>{scopedApprovals.length} approval event{scopedApprovals.length === 1 ? "" : "s"}.</div>
          <div>{(scheduleAudit ?? []).length} schedule event{(scheduleAudit ?? []).length === 1 ? "" : "s"}.</div>
          <div>{(publicationAttempts ?? []).length} publication attempt{(publicationAttempts ?? []).length === 1 ? "" : "s"}.</div>
        </div>
      </div>

      <div className="space-y-6">
        <QuietPanel className="!p-4">
          <div className="flex items-baseline justify-between">
            <SectionLabel>Compare</SectionLabel>
            <span className="text-[10.5px] uppercase tracking-[0.2em] text-foreground/45">
              {a != null && b != null ? `v${a} → v${b}` : "Pick two versions"}
            </span>
          </div>
          {a == null || b == null ? (
            <div className="mt-3 text-[13px] text-foreground/55">Select an A and a B version above to see the diff.</div>
          ) : a === b ? (
            <div className="mt-3 text-[13px] text-foreground/55">A and B must differ.</div>
          ) : diffQ.isLoading ? (
            <div className="mt-3 text-[13px] text-foreground/55">Loading diff...</div>
          ) : diffQ.isError ? (
            <div className="mt-3 text-[13px] text-[oklch(0.5_0.18_27)]">{(diffQ.error as Error).message}</div>
          ) : diff ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[11.5px] text-foreground/65">
                <span>+{diff.summary.added} lines added</span>
                <span>-{diff.summary.removed} removed</span>
                <span>{diff.summary.unchanged} unchanged</span>
                {!diff.summary.changed && <span className="text-foreground/40">No textual change.</span>}
              </div>
              <pre className="mt-3 max-h-[420px] overflow-auto border border-foreground/10 bg-foreground/[0.02] p-3 font-mono text-[12px] leading-snug">
                {diff.lines.map((l, i) => (
                  <div key={i} className={cn(
                    l.op === "added" && "bg-[oklch(0.9_0.08_150)]/40 text-foreground",
                    l.op === "removed" && "bg-[oklch(0.9_0.1_27)]/35 text-foreground line-through decoration-[oklch(0.5_0.18_27)]",
                    l.op === "equal" && "text-foreground/60",
                  )}>
                    <span className="mr-3 inline-block w-6 text-right text-foreground/35">
                      {l.op === "added" ? "+" : l.op === "removed" ? "-" : " "}
                    </span>
                    {l.text || "\u00a0"}
                  </div>
                ))}
              </pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => a != null && restoreMut.mutate(a)}
                  disabled={restoreMut.isPending || a === currentVersion}
                  title={a === currentVersion ? "That is the current version" : `Restore v${a} as a new version`}
                  className="border border-foreground/25 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-foreground/80 hover:border-foreground/60 disabled:opacity-40"
                >
                  {restoreMut.isPending ? "Restoring..." : `Restore v${a} as new version`}
                </button>
                <button
                  type="button"
                  onClick={() => b != null && restoreMut.mutate(b)}
                  disabled={restoreMut.isPending || b === currentVersion}
                  className="border border-foreground/25 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-foreground/80 hover:border-foreground/60 disabled:opacity-40"
                >
                  {restoreMut.isPending ? "Restoring..." : `Restore v${b} as new version`}
                </button>
                {restoreMut.isError && (
                  <span className="self-center text-[12px] text-[oklch(0.5_0.18_27)]">{(restoreMut.error as Error).message}</span>
                )}
              </div>
            </>
          ) : null}
        </QuietPanel>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <SectionLabel>Approval history</SectionLabel>
            <div className="mt-3">
              {scopedApprovals.length === 0 ? (
                <div className="text-[13px] text-foreground/55">No approval activity.</div>
              ) : (
                <Ledger>
                  {scopedApprovals.slice().sort((x, y) => (x.approved_at < y.approved_at ? 1 : -1)).map((r) => (
                    <LedgerRow
                      key={r.id}
                      status={<StatusLine tone={r.action === "rejected" || r.action === "revoked" ? "attention" : "positive"}>{r.action}</StatusLine>}
                      title={`v${r.content_version}`}
                      meta={new Date(r.approved_at).toLocaleString()}
                    >{r.notes ?? null}</LedgerRow>
                  ))}
                </Ledger>
              )}
            </div>
          </div>
          <div>
            <SectionLabel>Schedule &amp; publish history</SectionLabel>
            <div className="mt-3">
              {((scheduleAudit ?? []).length + (publicationAttempts ?? []).length) === 0 ? (
                <div className="text-[13px] text-foreground/55">Not yet scheduled or published.</div>
              ) : (
                <Ledger>
                  {(scheduleAudit ?? []).slice().sort((x, y) => (x.created_at < y.created_at ? 1 : -1)).map((r) => (
                    <LedgerRow key={r.id} status={<StatusLine tone="neutral">{r.action}</StatusLine>}
                      title={r.scheduled_for ? new Date(r.scheduled_for).toLocaleString() : "Schedule change"}
                      meta={new Date(r.created_at).toLocaleString()}
                    >{r.note ?? null}</LedgerRow>
                  ))}
                  {(publicationAttempts ?? []).slice().sort((x, y) => (x.attempted_at < y.attempted_at ? 1 : -1)).map((r) => (
                    <LedgerRow key={r.id} status={<StatusLine tone={r.status === "succeeded" ? "positive" : r.status === "failed" ? "attention" : "neutral"}>{r.status}</StatusLine>}
                      title="Publication attempt"
                      meta={new Date(r.attempted_at).toLocaleString()}
                    >{r.error_message ?? null}</LedgerRow>
                  ))}
                </Ledger>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
