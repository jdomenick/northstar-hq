import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, X, ArrowUpRight, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
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

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsLayout,
  head: () => ({
    meta: [
      { title: "Projects  -  Northstar" },
      {
        name: "description",
        content: "Every project across every venture, in one executive view.",
      },
    ],
  }),
});

function ProjectsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/projects") return <Outlet />;
  return <ProjectsIndex />;
}

const STATUS_LABELS: Record<ProjectStatus | "all", string> = {
  all: "All",
  proposed: "Proposed",
  planned: "Planned",
  active: "Active",
  at_risk: "At risk",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_FILTERS: (ProjectStatus | "all")[] = [
  "all",
  "active",
  "at_risk",
  "blocked",
  "planned",
  "completed",
];

type SortKey = "updated" | "deadline" | "priority" | "status";

function ProjectsIndex() {
  const { activeOrgId, activeMembership } = useOrg();
  const projectsQ = useProjects(activeOrgId);
  const venturesQ = useVentures(activeOrgId);
  const canCreate = can.writeContent(activeMembership?.role);

  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [ventureFilter, setVentureFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<"list" | "board">("list");
  const [showNew, setShowNew] = useState(false);

  const ventureMap = useMemo(() => {
    const m = new Map<string, string>();
    (venturesQ.data ?? []).forEach((v) => m.set(v.id, v.name));
    return m;
  }, [venturesQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = (projectsQ.data ?? []).filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (ventureFilter !== "all" && p.venture_id !== ventureFilter) return false;
      if (priorityFilter !== "all" && p.priority !== priorityFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.objective ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const priorityRank: Record<Priority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    const statusRank: Record<ProjectStatus, number> = {
      blocked: 0,
      at_risk: 1,
      active: 2,
      planned: 3,
      proposed: 4,
      completed: 5,
      archived: 6,
    };
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "deadline":
          return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
        case "priority":
          return priorityRank[a.priority] - priorityRank[b.priority];
        case "status":
          return statusRank[a.status] - statusRank[b.status];
        default:
          return b.updated_at.localeCompare(a.updated_at);
      }
    });
    return list;
  }, [projectsQ.data, status, ventureFilter, priorityFilter, search, sort]);

  return (
    <div>
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description="Every project, its owner, its next step, and its risk  -  nothing more."
        actions={
          canCreate && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> New project
            </button>
          )
        }
      />
      <PageBody>
        <div className="mb-8 flex flex-wrap items-center gap-3 -mx-2">
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px]",
                  status === s
                    ? "bg-secondary/70 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 pr-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-40 rounded-md bg-secondary/40 px-2.5 py-1.5 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/60 hover:bg-secondary/60"
            />
            <FilterSelect
              value={ventureFilter}
              onChange={setVentureFilter}
              options={[
                { value: "all", label: "All ventures" },
                ...(venturesQ.data ?? []).map((v) => ({ value: v.id, label: v.name })),
              ]}
            />
            <FilterSelect
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
            <FilterSelect
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: "updated", label: "Recently updated" },
                { value: "deadline", label: "Deadline" },
                { value: "priority", label: "Priority" },
                { value: "status", label: "Status" },
              ]}
            />
            <div className="flex overflow-hidden rounded-md bg-secondary/40">
              <button
                onClick={() => setView("list")}
                className={cn(
                  "px-2.5 py-1.5",
                  view === "list" ? "bg-secondary/80 text-foreground" : "text-muted-foreground",
                )}
                aria-label="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("board")}
                className={cn(
                  "px-2.5 py-1.5",
                  view === "board" ? "bg-secondary/80 text-foreground" : "text-muted-foreground",
                )}
                aria-label="Board view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {projectsQ.isLoading ? (
          <Skeleton />
        ) : projectsQ.error ? (
          <ErrorLine message={(projectsQ.error as Error).message} />
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={canCreate ? () => setShowNew(true) : undefined} />
        ) : view === "list" ? (
          <ProjectsTable projects={filtered} ventureMap={ventureMap} />
        ) : (
          <ProjectsBoard projects={filtered} ventureMap={ventureMap} />
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

function ProjectsTable({
  projects,
  ventureMap,
}: {
  projects: Project[];
  ventureMap: Map<string, string>;
}) {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-left">
        <thead className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          <tr className="border-b border-border">
            <th className="px-2 py-3 font-medium">Project</th>
            <th className="hidden px-2 py-3 font-medium md:table-cell">Venture</th>
            <th className="px-2 py-3 font-medium">Status</th>
            <th className="hidden px-2 py-3 font-medium sm:table-cell">Progress</th>
            <th className="hidden px-2 py-3 text-right font-medium md:table-cell">Due</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => (
            <tr
              key={p.id}
              className={cn(
                "group text-[13.5px] hover:bg-secondary/30",
                i !== projects.length - 1 && "border-b border-border/60",
              )}
            >
              <td className="px-2 py-5">
                <Link
                  to="/projects/$id"
                  params={{ id: p.id }}
                  className="block text-foreground hover:underline"
                >
                  {p.name}
                </Link>
                {p.next_action && (
                  <div className="mt-1 text-[12px] text-muted-foreground">{p.next_action}</div>
                )}
              </td>
              <td className="hidden px-2 py-5 text-muted-foreground md:table-cell">
                {ventureMap.get(p.venture_id) ?? " - "}
              </td>
              <td className="px-2 py-5">
                <StatusPill status={p.status} />
              </td>
              <td className="hidden px-2 py-5 sm:table-cell">
                <div className="flex items-center gap-3">
                  <div className="h-[3px] w-24 overflow-hidden rounded-full bg-secondary/70">
                    <div
                      className="h-full bg-foreground/70 transition-[width] duration-500"
                      style={{ width: `${p.progress_percentage}%` }}
                    />
                  </div>
                  <span className="text-[11.5px] tabular-nums text-muted-foreground">
                    {p.progress_percentage}%
                  </span>
                </div>
              </td>
              <td className="hidden px-2 py-5 text-right tabular-nums text-muted-foreground md:table-cell">
                {p.deadline ?? " - "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectsBoard({
  projects,
  ventureMap,
}: {
  projects: Project[];
  ventureMap: Map<string, string>;
}) {
  const columns: ProjectStatus[] = [
    "planned",
    "active",
    "at_risk",
    "blocked",
    "completed",
  ];
  const grouped = useMemo(() => {
    const g = new Map<ProjectStatus, Project[]>();
    columns.forEach((c) => g.set(c, []));
    projects.forEach((p) => {
      const list = g.get(p.status);
      if (list) list.push(p);
    });
    return g;
  }, [projects]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {columns.map((c) => (
        <div key={c} className="rounded-xl bg-card/30 p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
              {STATUS_LABELS[c]}
            </div>
            <div className="text-[11px] tabular-nums text-muted-foreground/60">
              {grouped.get(c)?.length ?? 0}
            </div>
          </div>
          <div className="space-y-2">
            {(grouped.get(c) ?? []).map((p) => (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="group block rounded-lg bg-background/60 p-3 hover:bg-background/90"
              >
                <div className="text-[13px] leading-snug text-foreground">{p.name}</div>
                <div className="mt-1.5 text-[11.5px] text-muted-foreground">
                  {ventureMap.get(p.venture_id) ?? " - "}
                  {p.deadline ? ` · ${p.deadline}` : ""}
                </div>
              </Link>
            ))}
            {(grouped.get(c)?.length ?? 0) === 0 && (
              <div className="px-1 pb-1 pt-2 text-[11.5px] text-muted-foreground/60">Empty</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: ProjectStatus }) {
  const dot: Record<ProjectStatus, string> = {
    proposed: "text-muted-foreground",
    planned: "text-muted-foreground",
    active: "text-[oklch(0.72_0.14_155)]",
    at_risk: "text-[oklch(0.78_0.14_75)]",
    blocked: "text-[oklch(0.62_0.19_25)]",
    completed: "text-muted-foreground",
    archived: "text-muted-foreground/50",
  };
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px]">
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", dot[status])} />
      <span className="text-foreground">{STATUS_LABELS[status]}</span>
    </span>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md bg-secondary/40 px-2.5 py-1.5 text-[12.5px] text-foreground outline-none hover:bg-secondary/60"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="mt-16 rounded-2xl px-6 py-20 text-center">
      <div className="mx-auto max-w-sm">
        <div className="mx-auto h-10 w-10 rounded-full bg-secondary/50" />
        <h3 className="mt-6 font-display text-2xl text-foreground">Nothing here yet</h3>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          Create your first project. It will live under a venture.
        </p>
        {onCreate && (
          <button
            onClick={onCreate}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New project
          </button>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-card/30" />
      ))}
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 p-6 text-[13.5px] text-muted-foreground">
      {message}
    </div>
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
      navigate({ to: "/projects/$id", params: { id: p.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create project");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-lg rounded-2xl bg-card p-8 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-display text-[24px] text-foreground">New project</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Every project lives under a venture.
        </p>
        <div className="mt-6 space-y-5">
          <Field label="Name">
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-[15px] text-foreground outline-none"
            />
          </Field>
          <Field label="Venture">
            <select
              required
              value={ventureId}
              onChange={(e) => setVentureId(e.target.value)}
              className="w-full bg-transparent text-[15px] text-foreground outline-none"
            >
              {ventures.length === 0 && <option value="">No ventures yet</option>}
              {ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Objective">
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full bg-transparent text-[15px] text-foreground outline-none"
            />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full bg-transparent text-[15px] text-foreground outline-none"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full bg-transparent text-[15px] text-foreground outline-none"
              >
                <option value="proposed">Proposed</option>
                <option value="planned">Planned</option>
                <option value="active">Active</option>
              </select>
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-transparent text-[15px] text-foreground outline-none"
              />
            </Field>
          </div>
          <Field label="Linked goal (optional)">
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full bg-transparent text-[15px] text-foreground outline-none"
            >
              <option value=""> -  None  - </option>
              {(goalsQ.data ?? [])
                .filter((g) => g.venture_id === ventureId || g.venture_id == null)
                .filter((g) => g.status !== "archived")
                .map((g) => (<option key={g.id} value={g.id}>{g.title}</option>))}
            </select>
          </Field>
        </div>
        <div className="mt-8 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3.5 py-2 text-[12.5px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name || !ventureId || create.isPending}
            className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60"
          >
            {create.isPending ? "…" : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block border-b border-border/60 pb-3 focus-within:border-foreground/60">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {label}
      </div>
      {children}
    </label>
  );
}

// Keep for compat with import from Command page if referenced.
export { ArrowUpRight };