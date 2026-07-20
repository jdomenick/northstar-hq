import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus, X, ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import { useCreateGoal, useGoals, useVentures, type Goal, type GoalStatus, type Priority } from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import { goalProgressPct, isGoalAtRisk } from "@/lib/accountability";

export const Route = createFileRoute("/_authenticated/labs/goals")({
  component: GoalsLayout,
  head: () => ({
    meta: [
      { title: "Goals  -  NorthStar Labs" },
      { name: "description", content: "Measurable outcomes across every venture." },
    ],
  }),
});

function GoalsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/goals") return <Outlet />;
  return <GoalsIndex />;
}

const STATUS_LABEL: Record<GoalStatus, string> = {
  proposed: "Proposed", active: "Active", at_risk: "At risk",
  achieved: "Achieved", missed: "Missed", paused: "Paused", archived: "Archived",
};

function GoalsIndex() {
  const { activeOrgId, activeMembership } = useOrg();
  const goalsQ = useGoals(activeOrgId);
  const venturesQ = useVentures(activeOrgId);
  const [showNew, setShowNew] = useState(false);
  const [status, setStatus] = useState("open");
  const [venture, setVenture] = useState("all");
  const canWrite = can.writeContent(activeMembership?.role);

  const ventureMap = useMemo(() => new Map((venturesQ.data ?? []).map((v) => [v.id, v.name])), [venturesQ.data]);
  const filtered = useMemo(() => {
    let list = goalsQ.data ?? [];
    if (status === "open") list = list.filter((g) => g.status !== "archived" && g.status !== "missed" && g.status !== "achieved");
    else if (status !== "all") list = list.filter((g) => g.status === status);
    if (venture !== "all") list = list.filter((g) => (g.venture_id ?? "") === venture);
    return list;
  }, [goalsQ.data, status, venture]);

  return (
    <div>
      <PageHeader
        eyebrow="Goals"
        title="What you're aiming at."
        description="Measurable outcomes across every venture, plus organization-wide goals."
        actions={canWrite && (
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> New goal
          </button>
        )}
      />
      <PageBody>
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md bg-secondary/40 px-2.5 py-2 text-[12.5px] text-foreground outline-none">
            <option value="open">Open</option><option value="all">All</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={venture} onChange={(e) => setVenture(e.target.value)} className="rounded-md bg-secondary/40 px-2.5 py-2 text-[12.5px] text-foreground outline-none">
            <option value="all">All ventures</option>
            <option value="">Organization-wide</option>
            {(venturesQ.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {goalsQ.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-card/30" />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13.5px] text-muted-foreground">No goals match these filters.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map((g) => <GoalCard key={g.id} g={g} venture={g.venture_id ? ventureMap.get(g.venture_id) : "Organization"} />)}
          </div>
        )}
      </PageBody>

      {showNew && <NewGoalDialog orgId={activeOrgId} ventures={venturesQ.data ?? []} onClose={() => setShowNew(false)} />}
    </div>
  );
}

function GoalCard({ g, venture }: { g: Goal; venture?: string }) {
  const pct = goalProgressPct(g);
  const risk = isGoalAtRisk(g);
  return (
    <Link to="/labs/goals/$id" params={{ id: g.id }} className="group relative overflow-hidden rounded-2xl bg-card/40 p-6 transition-all hover:-translate-y-0.5 hover:bg-card/70">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
            {venture ?? "Organization"} · {STATUS_LABEL[g.status]}{risk ? " · at risk" : ""}
          </div>
          <h3 className="mt-2.5 font-display text-[20px] leading-snug text-foreground">{g.title}</h3>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
      </div>
      <div className="mt-5">
        {pct == null ? (
          <div className="text-[12px] text-muted-foreground">Progress not yet measured</div>
        ) : (
          <div>
            <div className="text-[12px] text-muted-foreground">
              {g.current_value} of {g.target_value}{g.unit ? ` ${g.unit}` : ""} · {pct}%
            </div>
            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-secondary/70">
              <div className="h-full bg-foreground/70" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

function NewGoalDialog({ orgId, ventures, onClose }: { orgId: string | null; ventures: { id: string; name: string }[]; onClose: () => void }) {
  const create = useCreateGoal(orgId);
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [ventureId, setVentureId] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [unit, setUnit] = useState("");
  const [targetDate, setTargetDate] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title required");
    try {
      const g = await create.mutateAsync({
        title: title.trim(),
        venture_id: ventureId || null,
        priority,
        target_value: target ? Number(target) : null,
        current_value: current ? Number(current) : null,
        unit: unit || null,
        target_date: targetDate || null,
      });
      toast.success("Goal created");
      onClose();
      nav({ to: "/labs/goals/$id", params: { id: g.id } });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="relative w-full max-w-lg rounded-2xl bg-card p-8">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        <h2 className="font-display text-[24px] text-foreground">New goal</h2>
        <div className="mt-6 space-y-4 text-[13.5px]">
          <F label="Title"><input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-transparent outline-none" /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Venture">
              <select value={ventureId} onChange={(e) => setVentureId(e.target.value)} className="w-full bg-transparent outline-none">
                <option value="">Organization-wide</option>
                {ventures.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </F>
            <F label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full bg-transparent outline-none">
                {["low","normal","high","critical"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </F>
            <F label="Current value"><input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full bg-transparent outline-none" /></F>
            <F label="Target value"><input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className="w-full bg-transparent outline-none" /></F>
            <F label="Unit"><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="users, MRR, %" className="w-full bg-transparent outline-none" /></F>
            <F label="Target date"><input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full bg-transparent outline-none" /></F>
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={create.isPending} className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
            {create.isPending ? "Creating…" : "Create goal"}
          </button>
        </div>
      </form>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-lg bg-secondary/40 px-3 py-2.5">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      {children}
    </label>
  );
}