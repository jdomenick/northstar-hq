import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, X, Search } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import {
  EditorialSkeleton,
  EmptyEditorialState,
  ErrorLine,
  Ledger,
  SectionLabel,
  StatusLine,
  type StatusTone,
} from "@/components/editorial";
import { useOrg } from "@/lib/org-context";
import {
  useCreateProject,
  useGoals,
  useProjects,
  useVentures,
  type Priority,
  type Project,
  type ProjectStatus,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/labs/projects")({
  component: ProjectsLayout,
  head: () => ({
    meta: [
      { title: "Projects - NorthStar Labs" },
      {
        name: "description",
        content: "Every project across every venture, in one executive view.",
      },
    ],
  }),
});

function ProjectsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/labs/projects") return <Outlet />;
  return <ProjectsIndex />;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  proposed: "Proposed",
  planned: "Planned",
  active: "Active",
  at_risk: "At risk",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};

type Group = {
  key: string;
  label: string;
  hint: string;
  statuses: ProjectStatus[];
};

const GROUPS: Group[] = [
  {
    key: "attention",
    label: "Needs attention",
    hint: "Blocked or at risk. Address these first.",
    statuses: ["blocked", "at_risk"],
  },
  {
    key: "motion",
    label: "In motion",
    hint: "Active work under way.",
    statuses: ["active"],
  },
  {
    key: "waiting",
    label: "Waiting",
    hint: "Planned or proposed. Not yet moving.",
    statuses: ["planned", "proposed"],
  },
  {
    key: "completed",
    label: "Completed",
    hint: "Recently finished. For reference.",
    statuses: ["completed"],
  },
];

function ProjectsIndex() {
  const { activeOrgId, activeMembership } = useOrg();
  const projectsQ = useProjects(activeOrgId);
  const venturesQ = useVentures(activeOrgId);
  const canCreate = can.writeContent(activeMembership?.role);

  const [ventureFilter, setVentureFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const ventureMap = useMemo(() => {
    const m = new Map<string, string>();
    (venturesQ.data ?? []).forEach((v) => m.set(v.id, v.name));
    return m;
  }, [venturesQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projectsQ.data ?? []).filter((p) => {
      if (!showArchived && p.status === "archived") return false;
      if (ventureFilter !== "all" && p.venture_id !== ventureFilter) return false;
      if (priorityFilter !== "all" && p.priority !== priorityFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.objective ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [projectsQ.data, ventureFilter, priorityFilter, search, showArchived]);

  const grouped = useMemo(() => {
    const priorityRank: Record<Priority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    const bucket = new Map<string, Project[]>();
    for (const g of GROUPS) bucket.set(g.key, []);
    const archived: Project[] = [];
    for (const p of filtered) {
      if (p.status === "archived") {
        archived.push(p);
        continue;
      }
      const g = GROUPS.find((x) => x.statuses.includes(p.status));
      if (g) bucket.get(g.key)!.push(p);
    }
    for (const [, list] of bucket) {
      list.sort((a, b) => {
        const pr = priorityRank[a.priority] - priorityRank[b.priority];
        if (pr !== 0) return pr;
        return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
      });
    }
    return { bucket, archived };
  }, [filtered]);

  const isEmpty =
    !projectsQ.isLoading &&
    !projectsQ.error &&
    (projectsQ.data ?? []).length === 0;
  const nothingMatched =
    !projectsQ.isLoading &&
    !projectsQ.error &&
    !isEmpty &&
    filtered.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description="Every project, its owner, its next step, and its risk. Grouped so the important work reads first."
        actions={
          canCreate && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New project
            </button>
          )
        }
      />
      <PageBody>
        {/* Filter strip */}
        <div className="mb-12 border-b border-foreground/15 pb-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 md:flex md:flex-wrap md:justify-between">
            <label className="flex min-w-0 items-center gap-2 border-b border-foreground/40 py-1 focus-within:border-foreground md:w-64">
              <Search className="h-3.5 w-3.5 shrink-0 text-foreground/50" strokeWidth={1.5} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
                className="w-full min-w-0 bg-transparent py-1 text-[13.5px] text-foreground placeholder:italic placeholder:text-foreground/45 focus:outline-none"
              />
            </label>
            <div className="flex shrink-0 items-center gap-3">
              <QuietSelect
                label="Venture"
                value={ventureFilter}
                onChange={setVentureFilter}
                options={[
                  { value: "all", label: "All ventures" },
                  ...(venturesQ.data ?? []).map((v) => ({ value: v.id, label: v.name })),
                ]}
              />
              <QuietSelect
                label="Priority"
                value={priorityFilter}
                onChange={(v) => setPriorityFilter(v as Priority | "all")}
                options={[
                  { value: "all", label: "Any priority" },
                  { value: "critical", label: "Critical" },
                  { value: "high", label: "High" },
                  { value: "normal", label: "Normal" },
                  { value: "low", label: "Low" },
                ]}
              />
              <label className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-foreground/60">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="h-3 w-3 accent-foreground"
                />
                Archived
              </label>
            </div>
          </div>
        </div>

        {projectsQ.isLoading ? (
          <EditorialSkeleton rows={6} />
        ) : projectsQ.error ? (
          <ErrorLine message={(projectsQ.error as Error).message} />
        ) : isEmpty ? (
          <EmptyEditorialState
            eyebrow="Empty ledger"
            title="No projects yet."
            description="Every project lives under a venture. Start one and its owner, deadline, and risk will appear here."
            action={
              canCreate ? (
                <button
                  onClick={() => setShowNew(true)}
                  className="inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New project
                </button>
              ) : null
            }
          />
        ) : nothingMatched ? (
          <EmptyEditorialState
            eyebrow="No matches"
            title="Nothing matches these filters."
            description="Try a broader search, a different venture, or clear the priority filter."
          />
        ) : (
          <div>
            {GROUPS.map((g) => {
              const rows = grouped.bucket.get(g.key) ?? [];
              if (rows.length === 0) return null;
              return (
                <ProjectGroup
                  key={g.key}
                  label={g.label}
                  hint={g.hint}
                  count={rows.length}
                  rows={rows}
                  ventureMap={ventureMap}
                />
              );
            })}
            {showArchived && grouped.archived.length > 0 && (
              <ProjectGroup
                label="Archived"
                hint="Retained for the record."
                count={grouped.archived.length}
                rows={grouped.archived}
                ventureMap={ventureMap}
                muted
              />
            )}
          </div>
        )}
      </PageBody>

      {showNew && (
        <NewProjectDialog
          orgId={activeOrgId}
          ventures={venturesQ.data ?? []}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function ProjectGroup({
  label,
  hint,
  count,
  rows,
  ventureMap,
  muted,
}: {
  label: string;
  hint: string;
  count: number;
  rows: Project[];
  ventureMap: Map<string, string>;
  muted?: boolean;
}) {
  return (
    <section className={cn("mb-14", muted && "opacity-70")}>
      <div className="flex items-baseline justify-between gap-4 border-b border-foreground/80 pb-2">
        <SectionLabel>{label}</SectionLabel>
        <span className="text-[11px] tabular-nums uppercase tracking-[0.22em] text-foreground/55">
          {count}
        </span>
      </div>
      <p className="mt-3 text-[12.5px] italic text-foreground/60">{hint}</p>
      <Ledger className="mt-4">
        {rows.map((p) => (
          <ProjectRow key={p.id} p={p} venture={p.venture_id ? ventureMap.get(p.venture_id) : undefined} />
        ))}
      </Ledger>
    </section>
  );
}

const STATUS_TONE: Record<ProjectStatus, StatusTone> = {
  blocked: "critical",
  at_risk: "attention",
  active: "positive",
  planned: "neutral",
  proposed: "muted",
  completed: "muted",
  archived: "muted",
};

const today = () => new Date().toISOString().slice(0, 10);

function ProjectRow({
  p,
  venture,
}: {
  p: Project;
  venture?: string;
}) {
  const overdue = p.deadline && p.status !== "completed" && p.status !== "archived" && p.deadline < today();
  return (
    <li className="group border-b border-foreground/10 last:border-b-0 hover:bg-foreground/[0.02]">
      <Link
        to="/labs/projects/$id"
        params={{ id: p.id }}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-4 focus:outline-none focus-visible:bg-foreground/[0.04] md:grid-cols-[minmax(0,1fr)_10rem_auto] md:gap-6"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
            {venture ?? "Organization"}
            {p.priority !== "normal" && ` - ${p.priority}`}
          </div>
          <div className="mt-1.5 font-display text-[19px] leading-[1.2] text-foreground group-hover:underline underline-offset-4 md:text-[22px]">
            {p.name}
          </div>
          {p.next_action && (
            <div className="mt-2 text-[13px] italic text-foreground/70">
              Next - {p.next_action}
            </div>
          )}
          {p.blocker_summary && p.status === "blocked" && (
            <div className="mt-1 text-[12.5px] text-foreground/60">
              Blocked - {p.blocker_summary}
            </div>
          )}
        </div>
        <div className="hidden text-[11.5px] tabular-nums text-foreground/70 md:block">
          <div className={cn("uppercase tracking-[0.18em]", overdue && "text-[oklch(0.5_0.18_27)]")}>
            {p.deadline ? `Due ${p.deadline}${overdue ? " - overdue" : ""}` : "No deadline"}
          </div>
          <div className="mt-1 tabular-nums text-foreground/55">
            {p.progress_percentage}% complete
          </div>
        </div>
        <div className="flex shrink-0 items-center pt-1">
          <StatusLine tone={STATUS_TONE[p.status]}>{STATUS_LABELS[p.status]}</StatusLine>
        </div>
      </Link>
    </li>
  );
}

function QuietSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-foreground/55">
      <span className="sr-only md:not-sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="border-b border-foreground/30 bg-transparent py-1 text-[12.5px] normal-case tracking-normal text-foreground focus:border-foreground focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NewProjectDialog({
  orgId,
  ventures,
  onClose,
}: {
  orgId: string | null;
  ventures: { id: string; name: string }[];
  onClose: () => void;
}) {
  const create = useCreateProject(orgId);
  const goalsQ = useGoals(orgId);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [ventureId, setVentureId] = useState(ventures[0]?.id ?? "");
  const [objective, setObjective] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [status, setStatus] = useState<ProjectStatus>("planned");
  const [deadline, setDeadline] = useState("");
  const [goalId, setGoalId] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ventureId) {
      toast.error("Pick a venture");
      return;
    }
    try {
      const p = await create.mutateAsync({
        name,
        venture_id: ventureId,
        objective: objective || undefined,
        priority,
        status,
        deadline: deadline || null,
        goal_id: goalId || null,
      });
      toast.success("Project created");
      onClose();
      navigate({ to: "/labs/projects/$id", params: { id: p.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create project");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-10 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-xl border border-foreground/15 bg-background shadow-[0_20px_60px_-20px_oklch(0.15_0.02_60/0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
      >
        <div className="flex items-baseline justify-between border-b border-foreground/80 px-8 pb-2 pt-8">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/60">
              New entry
            </div>
            <h2 id="new-project-title" className="mt-3 font-display text-[30px] leading-none text-foreground">
              A new project
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-foreground/60 hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <p className="mt-4 px-8 text-[13px] italic text-foreground/65">
          Every project lives under a venture. You can refine the plan after it's created.
        </p>
        <div className="grid gap-6 px-8 pb-8 pt-6">
          <PaperField label="Name" required>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
            />
          </PaperField>
          <PaperField label="Venture" required>
            <select
              required
              value={ventureId}
              onChange={(e) => setVentureId(e.target.value)}
              className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
            >
              {ventures.length === 0 && <option value="">No ventures yet</option>}
              {ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </PaperField>
          <PaperField label="Objective">
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
            />
          </PaperField>
          <div className="grid gap-6 md:grid-cols-3">
            <PaperField label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </PaperField>
            <PaperField label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
              >
                <option value="proposed">Proposed</option>
                <option value="planned">Planned</option>
                <option value="active">Active</option>
              </select>
            </PaperField>
            <PaperField label="Deadline">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
              />
            </PaperField>
          </div>
          <PaperField label="Linked goal (optional)">
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
            >
              <option value="">None</option>
              {(goalsQ.data ?? [])
                .filter((g) => g.venture_id === ventureId || g.venture_id == null)
                .filter((g) => g.status !== "archived")
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
            </select>
          </PaperField>
        </div>
        <div className="flex items-center justify-end gap-4 border-t border-foreground/15 bg-foreground/[0.02] px-8 py-4">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] uppercase tracking-[0.22em] text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name || !ventureId || create.isPending}
            className="inline-flex items-center gap-2 border border-foreground bg-foreground px-5 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:border-foreground/30 disabled:bg-foreground/30"
          >
            {create.isPending ? "Creating." : "Enter into the record"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PaperField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block border-b border-foreground/25 pb-1 focus-within:border-foreground">
      <div className="mb-1 flex items-baseline gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
        <span>{label}</span>
        {required && <span className="text-foreground/40">Required</span>}
      </div>
      {children}
    </label>
  );
}