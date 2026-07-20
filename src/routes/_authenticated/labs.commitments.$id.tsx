import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Archive, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import {
  EditorialSkeleton,
  ErrorLine,
  HairlineSection,
  Ledger,
  MetadataRow,
  StatusLine,
  type StatusTone,
} from "@/components/editorial";
import { useOrg } from "@/lib/org-context";
import {
  useActivity,
  useArchiveCommitment,
  useCommitment,
  useOrgMembers,
  useProjects,
  useUpdateCommitment,
  useVentures,
  type Commitment,
  type CommitmentStatus,
  type Priority,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/labs/commitments/$id")({
  component: CommitmentDetail,
  head: () => ({ meta: [{ title: "Commitment - NorthStar Labs" }] }),
});

const STATUS_LABEL: Record<CommitmentStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting",
  overdue: "Overdue",
  completed: "Completed",
  canceled: "Canceled",
};

const STATUS_TONE: Record<CommitmentStatus, StatusTone> = {
  open: "neutral",
  in_progress: "attention",
  waiting: "muted",
  overdue: "critical",
  completed: "positive",
  canceled: "muted",
};

function CommitmentDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { activeOrgId, activeMembership } = useOrg();
  const q = useCommitment(id);
  const ventures = useVentures(activeOrgId);
  const projects = useProjects(activeOrgId);
  const members = useOrgMembers(activeOrgId);
  const activity = useActivity(activeOrgId, 40);
  const update = useUpdateCommitment(activeOrgId);
  const archive = useArchiveCommitment(activeOrgId);
  const canWrite = can.writeContent(activeMembership?.role);
  const canArchive = can.archiveContent(activeMembership?.role);

  const [postponeOpen, setPostponeOpen] = useState(false);
  const [postponeDate, setPostponeDate] = useState("");
  const [postponeReason, setPostponeReason] = useState("");

  if (q.isLoading) {
    return (
      <PageBody>
        <EditorialSkeleton rows={4} />
      </PageBody>
    );
  }
  if (q.error) {
    return (
      <PageBody>
        <ErrorLine message={(q.error as Error).message} />
      </PageBody>
    );
  }
  const c = q.data;
  if (!c) {
    return (
      <PageBody>
        <p className="text-[14px] italic text-foreground/70">Commitment not found.</p>
      </PageBody>
    );
  }

  async function patch(next: Partial<Commitment>) {
    try {
      await update.mutateAsync({ id: c!.id, patch: next, prev: c! });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onArchive() {
    if (!confirm("Archive this commitment? It remains on record.")) return;
    try {
      await archive.mutateAsync(c!.id);
      toast.success("Archived");
      nav({ to: "/labs/accountability" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onPostpone() {
    if (!postponeDate) {
      toast.error("New due date required");
      return;
    }
    try {
      await update.mutateAsync({
        id: c!.id,
        patch: { due_date: postponeDate },
        prev: c!,
        postpone: true,
        reason: postponeReason || undefined,
      });
      toast.success("Postponed");
      setPostponeOpen(false);
      setPostponeDate("");
      setPostponeReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const venture = (ventures.data ?? []).find((v) => v.id === c.venture_id);
  const project = (projects.data ?? []).find((p) => p.id === c.project_id);
  const memberOptions = (members.data ?? []).map((m) => ({
    value: m.user_id,
    label:
      m.profile?.preferred_name ??
      m.profile?.full_name ??
      m.profile?.email ??
      m.user_id.slice(0, 8),
  }));
  const ownerLabel = c.owner_user_id
    ? memberOptions.find((o) => o.value === c.owner_user_id)?.label ?? "Assigned"
    : "Unassigned";
  const today = new Date().toISOString().slice(0, 10);
  const overdue =
    c.due_date && c.due_date < today && c.status !== "completed" && c.status !== "canceled";
  const relatedActivity = (activity.data ?? []).filter(
    (a) => a.entity_type === "commitment" && a.entity_id === c.id,
  );

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/labs/accountability"
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.22em] text-foreground/60 hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Accountability
          </Link>
        </div>
      </div>
      <PageHeader
        eyebrow="Commitment"
        title={c.title}
        description={c.description ?? undefined}
        actions={
          <div className="flex items-center gap-3">
            {canWrite && c.status !== "completed" && c.status !== "canceled" && (
              <button
                onClick={() =>
                  patch({ status: "completed" })
                }
                className="inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
              >
                Mark complete
              </button>
            )}
            {canArchive && (
              <button
                onClick={onArchive}
                className="inline-flex items-center gap-1.5 border border-foreground/25 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-foreground/70 hover:border-foreground hover:text-foreground"
              >
                <Archive className="h-3.5 w-3.5" strokeWidth={1.5} /> Archive
              </button>
            )}
          </div>
        }
      />
      <PageBody>
        <div className="mb-10 flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusLine tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</StatusLine>
          <span className="text-[11px] uppercase tracking-[0.22em] text-foreground/55">
            {venture?.name ?? "Organization-wide"}
          </span>
          <span
            className={cn(
              "text-[11px] uppercase tracking-[0.22em] tabular-nums",
              overdue ? "text-[oklch(0.5_0.18_27)]" : "text-foreground/55",
            )}
          >
            {c.due_date ? `Due ${c.due_date}` : "No due date"}
          </span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-foreground/55">
            Owner - {ownerLabel}
          </span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-foreground/55">
            Priority - {c.priority}
          </span>
        </div>

        <HairlineSection label="Standing">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <PaperSelect
              label="Status"
              value={c.status}
              disabled={!canWrite}
              onChange={(v) => patch({ status: v as CommitmentStatus })}
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
            <PaperSelect
              label="Owner"
              value={c.owner_user_id ?? ""}
              disabled={!canWrite}
              onChange={(v) => patch({ owner_user_id: v || null })}
              options={[{ value: "", label: "Unassigned" }, ...memberOptions]}
            />
            <PaperSelect
              label="Priority"
              value={c.priority}
              disabled={!canWrite}
              onChange={(v) => patch({ priority: v as Priority })}
              options={[
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ]}
            />
          </div>
        </HairlineSection>

        <HairlineSection
          label="Timing"
          action={
            canWrite && c.status !== "completed" && c.status !== "canceled" ? (
              <button
                onClick={() => {
                  setPostponeDate(c.due_date ?? "");
                  setPostponeOpen(true);
                }}
                className="underline-offset-4 hover:underline"
              >
                Postpone
              </button>
            ) : null
          }
        >
          <MetadataRow
            items={[
              {
                label: "Due date",
                value: c.due_date ? (
                  <span className="tabular-nums">{c.due_date}</span>
                ) : (
                  <span className="italic text-foreground/60">Not set</span>
                ),
              },
              {
                label: "Original date",
                value: c.original_due_date ? (
                  <span className="tabular-nums">{c.original_due_date}</span>
                ) : (
                  <span className="italic text-foreground/60">Same as due</span>
                ),
              },
              {
                label: "Postponements",
                value: <span className="tabular-nums">{c.postponement_count}</span>,
              },
              {
                label: "Completed at",
                value: c.completed_at ? (
                  <span className="tabular-nums">{c.completed_at.slice(0, 10)}</span>
                ) : (
                  <span className="italic text-foreground/60">Not complete</span>
                ),
              },
            ]}
          />
          {postponeOpen && (
            <div className="mt-6 border-t border-foreground/15 pt-6">
              <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)_auto]">
                <label className="block border-b border-foreground/30 pb-1 focus-within:border-foreground">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
                    New date
                  </div>
                  <input
                    type="date"
                    value={postponeDate}
                    onChange={(e) => setPostponeDate(e.target.value)}
                    className="w-full bg-transparent py-1 text-[14px] tabular-nums text-foreground focus:outline-none"
                  />
                </label>
                <label className="block border-b border-foreground/30 pb-1 focus-within:border-foreground">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
                    Reason
                  </div>
                  <input
                    value={postponeReason}
                    onChange={(e) => setPostponeReason(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-transparent py-1 text-[14px] text-foreground focus:outline-none placeholder:italic placeholder:text-foreground/40"
                  />
                </label>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => setPostponeOpen(false)}
                    className="text-[11px] uppercase tracking-[0.22em] text-foreground/60 hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onPostpone}
                    className="inline-flex items-center border border-foreground bg-foreground px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
                  >
                    Postpone
                  </button>
                </div>
              </div>
            </div>
          )}
        </HairlineSection>

        <HairlineSection label="Notes">
          <PaperText
            label="Notes"
            value={c.notes ?? ""}
            disabled={!canWrite}
            multiline
            onCommit={(v) => patch({ notes: v || null })}
          />
        </HairlineSection>

        {project && (
          <HairlineSection label="Related project">
            <MetadataRow
              items={[
                {
                  label: "Project",
                  value: (
                    <Link
                      to="/labs/projects/$id"
                      params={{ id: project.id }}
                      className="underline-offset-4 hover:underline"
                    >
                      {project.name}
                    </Link>
                  ),
                },
                { label: "Status", value: project.status.replaceAll("_", " ") },
                {
                  label: "Progress",
                  value: <span className="tabular-nums">{project.progress_percentage}%</span>,
                },
              ]}
            />
          </HairlineSection>
        )}

        <HairlineSection label="Activity history">
          {relatedActivity.length === 0 ? (
            <p className="text-[13.5px] italic text-foreground/60">No activity yet.</p>
          ) : (
            <Ledger>
              {relatedActivity.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="text-[14px] text-foreground/85">{a.summary ?? a.action}</div>
                  <div className="mt-1 text-[10.5px] uppercase tracking-[0.22em] text-foreground/55 tabular-nums">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </Ledger>
          )}
        </HairlineSection>
      </PageBody>
    </div>
  );
}

function PaperSelect({
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
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
        {label}
      </div>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-b border-foreground/30 bg-transparent px-1 py-2 text-[14px] text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
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

function PaperText({
  label,
  value,
  onCommit,
  disabled,
  multiline,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  multiline?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  return (
    <label className="block border-b border-foreground/25 pb-3 focus-within:border-foreground">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/60">
        {label}
      </div>
      {multiline ? (
        <textarea
          disabled={disabled}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          rows={4}
          className="w-full resize-y bg-transparent text-[14px] leading-[1.7] text-foreground focus:outline-none placeholder:italic placeholder:text-foreground/40 disabled:opacity-60"
          placeholder="Not recorded"
        />
      ) : (
        <input
          disabled={disabled}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          className="w-full bg-transparent text-[14px] text-foreground focus:outline-none disabled:opacity-60"
        />
      )}
    </label>
  );
}