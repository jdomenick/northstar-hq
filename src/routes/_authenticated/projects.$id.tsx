import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Plus, X, Check, RotateCcw, Archive } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/lib/org-context";
import {
  useArchiveProject,
  useActivity,
  useCreateTask,
  useProject,
  useTasks,
  useUpdateProject,
  useUpdateTask,
  useVentures,
  type Priority,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskStatus,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
  head: () => ({ meta: [{ title: "Project — Northstar" }] }),
});

const STATUS_LABEL: Record<ProjectStatus, string> = {
  proposed: "Proposed",
  planned: "Planned",
  active: "Active",
  at_risk: "At risk",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
};

function ProjectDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { activeOrgId, activeMembership } = useOrg();
  const projectQ = useProject(id);
  const venturesQ = useVentures(activeOrgId);
  const tasksQ = useTasks({ orgId: activeOrgId, projectId: id });
  const activityQ = useActivity(activeOrgId, 30);
  const update = useUpdateProject(activeOrgId);
  const archive = useArchiveProject(activeOrgId);
  const canWrite = can.writeContent(activeMembership?.role);
  const canArchive = can.archiveContent(activeMembership?.role);

  if (projectQ.isLoading) {
    return (
      <PageBody>
        <div className="h-40 animate-pulse rounded-2xl bg-card/30" />
      </PageBody>
    );
  }
  if (projectQ.error) {
    return (
      <PageBody>
        <p className="text-muted-foreground">Couldn't load this project.</p>
      </PageBody>
    );
  }
  const p = projectQ.data;
  if (!p) {
    return (
      <PageBody>
        <p className="text-muted-foreground">Project not found.</p>
      </PageBody>
    );
  }

  const venture = (venturesQ.data ?? []).find((v) => v.id === p.venture_id);
  const projectActivity = (activityQ.data ?? []).filter(
    (a) => a.entity_type === "project" && a.entity_id === p.id,
  );

  async function patch(next: Partial<Project>) {
    try {
      await update.mutateAsync({ id: p!.id, patch: next, prev: p });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onArchive() {
    if (!confirm("Archive this project?")) return;
    try {
      await archive.mutateAsync(p!.id);
      toast.success("Project archived");
      navigate({ to: "/projects" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed");
    }
  }

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Projects
          </Link>
        </div>
      </div>

      <PageHeader
        eyebrow={venture ? venture.name : "Project"}
        title={p.name}
        description={p.objective ?? undefined}
        actions={
          canArchive && p.status !== "archived" && (
            <button
              onClick={onArchive}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </button>
          )
        }
      />

      <PageBody>
        <Tabs defaultValue="overview">
          <TabsList className="mb-10 -mx-2 h-auto flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0">
            {["overview", "tasks", "activity"].map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[12.5px] capitalize text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-10">
            <Section title="Status">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <MetaSelect
                  label="Status"
                  value={p.status}
                  disabled={!canWrite}
                  onChange={(v) => patch({ status: v as ProjectStatus })}
                  options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
                />
                <MetaSelect
                  label="Priority"
                  value={p.priority}
                  disabled={!canWrite}
                  onChange={(v) => patch({ priority: v as Priority })}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "normal", label: "Normal" },
                    { value: "high", label: "High" },
                    { value: "critical", label: "Critical" },
                  ]}
                />
                <MetaNumber
                  label="Progress"
                  value={p.progress_percentage}
                  disabled={!canWrite}
                  onCommit={(v) => patch({ progress_percentage: v })}
                />
              </div>
            </Section>

            <Section title="Plan">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <EditableText
                  label="Desired outcome"
                  value={p.desired_outcome ?? ""}
                  disabled={!canWrite}
                  onCommit={(v) => patch({ desired_outcome: v || null })}
                />
                <EditableText
                  label="Next action"
                  value={p.next_action ?? ""}
                  disabled={!canWrite}
                  onCommit={(v) => patch({ next_action: v || null })}
                />
                <EditableText
                  label="Risk summary"
                  value={p.risk_summary ?? ""}
                  disabled={!canWrite}
                  onCommit={(v) => patch({ risk_summary: v || null })}
                />
                <EditableText
                  label="Blocker summary"
                  value={p.blocker_summary ?? ""}
                  disabled={!canWrite}
                  onCommit={(v) => patch({ blocker_summary: v || null })}
                />
                <EditableDate
                  label="Start date"
                  value={p.start_date}
                  disabled={!canWrite}
                  onCommit={(v) => patch({ start_date: v })}
                />
                <EditableDate
                  label="Deadline"
                  value={p.deadline}
                  disabled={!canWrite}
                  onCommit={(v) => patch({ deadline: v })}
                />
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="tasks">
            <TaskList projectId={p.id} ventureId={p.venture_id} tasks={tasksQ.data ?? []} canWrite={canWrite} />
          </TabsContent>

          <TabsContent value="activity">
            {projectActivity.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-5">
                {projectActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-4 text-[13.5px]">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                    <div>
                      <div className="text-foreground">{a.summary ?? a.action}</div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </PageBody>
    </div>
  );
}

function MetaSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {label}
      </div>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none hover:bg-secondary/60 disabled:opacity-60"
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

function MetaNumber({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
}) {
  const [v, setV] = useState(String(value));
  return (
    <label className="block">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          disabled={disabled}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => {
            const n = Math.max(0, Math.min(100, Number(v) || 0));
            if (n !== value) onCommit(n);
          }}
          className="w-20 rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] tabular-nums text-foreground outline-none hover:bg-secondary/60 disabled:opacity-60"
        />
        <span className="text-[12px] text-muted-foreground">%</span>
      </div>
    </label>
  );
}

function EditableText({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
}) {
  const [v, setV] = useState(value);
  return (
    <label className="block border-b border-border/60 pb-3 focus-within:border-foreground/60">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {label}
      </div>
      <textarea
        disabled={disabled}
        rows={2}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== value) onCommit(v);
        }}
        className="w-full resize-none bg-transparent text-[14px] leading-[1.6] text-foreground outline-none placeholder:text-muted-foreground/40 disabled:opacity-60"
        placeholder="—"
      />
    </label>
  );
}

function EditableDate({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string;
  value: string | null;
  onCommit: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block border-b border-border/60 pb-3 focus-within:border-foreground/60">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {label}
      </div>
      <input
        type="date"
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onCommit(e.target.value || null)}
        className="w-full bg-transparent text-[14px] text-foreground outline-none disabled:opacity-60"
      />
    </label>
  );
}

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  completed: "Completed",
  canceled: "Canceled",
};

function TaskList({
  projectId,
  ventureId,
  tasks,
  canWrite,
}: {
  projectId: string;
  ventureId: string;
  tasks: Task[];
  canWrite: boolean;
}) {
  const { activeOrgId } = useOrg();
  const create = useCreateTask(activeOrgId);
  const update = useUpdateTask(activeOrgId);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const open = tasks.filter((t) => t.status !== "completed" && t.status !== "canceled");
  const done = tasks.filter((t) => t.status === "completed");
  const today = new Date().toISOString().slice(0, 10);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await create.mutateAsync({
        title: title.trim(),
        project_id: projectId,
        venture_id: ventureId,
        due_date: due || null,
      });
      setTitle("");
      setDue("");
      setShowAdd(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add task");
    }
  }

  async function toggleComplete(t: Task) {
    try {
      await update.mutateAsync({
        id: t.id,
        prev: t,
        patch: { status: t.status === "completed" ? "in_progress" : "completed" },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function changeStatus(t: Task, status: TaskStatus) {
    try {
      await update.mutateAsync({ id: t.id, prev: t, patch: { status } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
          {open.length} open · {done.length} completed
        </div>
        {canWrite && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background hover:opacity-90"
          >
            <Plus className="h-3 w-3" /> Add task
          </button>
        )}
      </div>

      {showAdd && (
        <form
          onSubmit={addTask}
          className="mb-6 flex flex-wrap items-center gap-2 rounded-lg bg-card/40 p-3"
        >
          <input
            autoFocus
            required
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[13.5px] text-foreground outline-none"
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="rounded-md bg-secondary/40 px-2 py-1.5 text-[12.5px] text-foreground outline-none"
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-foreground px-3 py-1.5 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="rounded-md px-2 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">No tasks yet.</p>
      ) : (
        <ul>
          {[...open, ...done].map((t) => {
            const overdue =
              t.due_date && t.status !== "completed" && t.due_date < today;
            return (
              <li
                key={t.id}
                className="group flex items-center gap-3 border-b border-border/60 py-3.5 last:border-0"
              >
                <button
                  disabled={!canWrite}
                  onClick={() => toggleComplete(t)}
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    t.status === "completed"
                      ? "border-foreground/60 bg-foreground/80 text-background"
                      : "border-border hover:border-foreground/60",
                  )}
                >
                  {t.status === "completed" && <Check className="h-3 w-3" strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-[13.5px] text-foreground",
                      t.status === "completed" && "text-muted-foreground line-through",
                    )}
                  >
                    {t.title}
                  </div>
                  {(t.due_date || t.priority !== "normal") && (
                    <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                      {t.due_date && (
                        <span className={overdue ? "text-[oklch(0.72_0.14_25)]" : ""}>
                          Due {t.due_date}
                          {overdue ? " · overdue" : ""}
                        </span>
                      )}
                      {t.priority !== "normal" && <span>· {t.priority}</span>}
                    </div>
                  )}
                </div>
                <select
                  disabled={!canWrite}
                  value={t.status}
                  onChange={(e) => changeStatus(t, e.target.value as TaskStatus)}
                  className="rounded-md bg-transparent px-2 py-1 text-[11.5px] text-muted-foreground outline-none hover:bg-secondary/40 disabled:opacity-60"
                >
                  {Object.entries(TASK_STATUS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                {t.status === "completed" && canWrite && (
                  <button
                    onClick={() => changeStatus(t, "in_progress")}
                    className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    title="Reopen"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}