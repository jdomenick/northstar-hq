import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Archive } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import {
  useActivity, useArchiveGoal, useGoal, useOrgMembers, useProjects, useUpdateGoal, useVentures,
  type Goal, type GoalStatus, type Priority,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import { goalProgressPct } from "@/lib/accountability";

export const Route = createFileRoute("/_authenticated/labs/goals/$id")({
  component: GoalDetail,
  head: () => ({ meta: [{ title: "Goal  -  NorthStar Labs" }] }),
});

const STATUS_LABEL: Record<GoalStatus, string> = {
  proposed: "Proposed", active: "Active", at_risk: "At risk",
  achieved: "Achieved", missed: "Missed", paused: "Paused", archived: "Archived",
};

function GoalDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { activeOrgId, activeMembership } = useOrg();
  const q = useGoal(id);
  const ventures = useVentures(activeOrgId);
  const projects = useProjects(activeOrgId);
  const members = useOrgMembers(activeOrgId);
  const activity = useActivity(activeOrgId, 40);
  const update = useUpdateGoal(activeOrgId);
  const archive = useArchiveGoal(activeOrgId);
  const canWrite = can.writeContent(activeMembership?.role);

  if (q.isLoading) return <PageBody><div className="h-40 animate-pulse rounded-2xl bg-card/30" /></PageBody>;
  const g = q.data;
  if (!g) return <PageBody><p className="text-muted-foreground">Goal not found.</p></PageBody>;

  async function patch(next: Partial<Goal>) {
    try { await update.mutateAsync({ id: g!.id, patch: next, prev: g! }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function onStatusChange(next: GoalStatus) {
    if (next === "achieved" && g!.target_value != null && g!.current_value != null && g!.current_value < g!.target_value) {
      if (!confirm(`Current value (${g!.current_value}) is below target (${g!.target_value}). Mark achieved anyway?`)) return;
    }
    await patch({ status: next });
  }

  async function onArchive() {
    if (!confirm("Archive this goal?")) return;
    await archive.mutateAsync(g!.id);
    toast.success("Archived");
    nav({ to: "/goals" });
  }

  const venture = (ventures.data ?? []).find((v) => v.id === g.venture_id);
  const related = (projects.data ?? []).filter((p) => p.goal_id === g.id);
  const memberOpts = (members.data ?? []).map((m) => ({
    value: m.user_id,
    label: m.profile?.preferred_name ?? m.profile?.full_name ?? m.profile?.email ?? m.user_id.slice(0, 8),
  }));
  const pct = goalProgressPct(g);
  const rel = (activity.data ?? []).filter((a) => a.entity_type === "goal" && a.entity_id === g.id);

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
        <div className="mx-auto max-w-6xl">
          <Link to="/goals" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Goals
          </Link>
        </div>
      </div>
      <PageHeader
        eyebrow={`${venture?.name ?? "Organization"} · ${STATUS_LABEL[g.status]}`}
        title={g.title}
        description={g.description ?? undefined}
        actions={canWrite && g.status !== "archived" && (
          <button onClick={onArchive} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
            <Archive className="h-3.5 w-3.5" /> Archive
          </button>
        )}
      />
      <PageBody>
        <Section title="Progress">
          {pct == null ? (
            <p className="text-[13.5px] text-muted-foreground">Progress not yet measured. Add target and current values to track.</p>
          ) : (
            <div>
              <div className="text-[14px] text-foreground">
                {g.current_value} of {g.target_value}{g.unit ? ` ${g.unit}` : ""} · {pct}%
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary/70">
                <div className="h-full bg-foreground/70 transition-[width] duration-500" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
          )}
        </Section>

        <Section title="Meta">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Sel label="Status" value={g.status} disabled={!canWrite} onChange={(v) => onStatusChange(v as GoalStatus)}
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
            <Sel label="Priority" value={g.priority} disabled={!canWrite}
              onChange={(v) => patch({ priority: v as Priority })}
              options={["low","normal","high","critical"].map((p) => ({ value: p, label: p }))} />
            <Sel label="Owner" value={g.owner_user_id ?? ""} disabled={!canWrite}
              onChange={(v) => patch({ owner_user_id: v || null })}
              options={[{ value: "", label: "Unassigned" }, ...memberOpts]} />
            <DateI label="Start date" value={g.start_date} disabled={!canWrite} onCommit={(v) => patch({ start_date: v })} />
            <DateI label="Target date" value={g.target_date} disabled={!canWrite} onCommit={(v) => patch({ target_date: v })} />
            <TextI label="Unit" value={g.unit ?? ""} disabled={!canWrite} onCommit={(v) => patch({ unit: v || null })} />
            <NumI label="Current value" value={g.current_value} disabled={!canWrite} onCommit={(v) => patch({ current_value: v })} />
            <NumI label="Target value" value={g.target_value} disabled={!canWrite} onCommit={(v) => patch({ target_value: v })} />
            <TextI label="Goal type" value={g.goal_type ?? ""} disabled={!canWrite} onCommit={(v) => patch({ goal_type: v || null })} />
          </div>
          <div className="mt-6">
            <TextI label="Description" value={g.description ?? ""} disabled={!canWrite} multiline onCommit={(v) => patch({ description: v || null })} />
          </div>
        </Section>

        <Section title="Related projects">
          {related.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">No projects linked to this goal yet.</p>
          ) : (
            <ul className="space-y-2">
              {related.map((p) => (
                <li key={p.id}>
                  <Link to="/projects/$id" params={{ id: p.id }} className="text-[13.5px] text-foreground hover:underline">{p.name}</Link>
                  <span className="ml-3 text-[12px] text-muted-foreground">{p.status.replaceAll("_"," ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Activity">
          {rel.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-4">
              {rel.map((a) => (
                <li key={a.id} className="text-[13.5px]">
                  <div className="text-foreground">{a.summary ?? a.action}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </PageBody>
    </div>
  );
}

function Sel({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return (
    <label className="block">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none hover:bg-secondary/60 disabled:opacity-60">
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}
function DateI({ label, value, onCommit, disabled }: { label: string; value: string | null; onCommit: (v: string | null) => void; disabled?: boolean }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <label className="block">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      <input type="date" disabled={disabled} value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { if ((v || null) !== value) onCommit(v || null); }}
        className="w-full rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none disabled:opacity-60" />
    </label>
  );
}
function TextI({ label, value, onCommit, disabled, multiline }: { label: string; value: string; onCommit: (v: string) => void; disabled?: boolean; multiline?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="block">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      {multiline
        ? <textarea disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onCommit(v); }} rows={3} className="w-full resize-y rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none disabled:opacity-60" />
        : <input disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onCommit(v); }} className="w-full rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none disabled:opacity-60" />}
    </label>
  );
}
function NumI({ label, value, onCommit, disabled }: { label: string; value: number | null; onCommit: (v: number | null) => void; disabled?: boolean }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => setV(value == null ? "" : String(value)), [value]);
  return (
    <label className="block">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      <input type="number" disabled={disabled} value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = v === "" ? null : Number(v);
          if (n !== value) onCommit(n);
        }}
        className="w-full rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] tabular-nums text-foreground outline-none disabled:opacity-60" />
    </label>
  );
}