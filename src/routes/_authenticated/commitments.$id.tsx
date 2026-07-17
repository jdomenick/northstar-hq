import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Archive } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import {
  useArchiveCommitment,
  useCommitment,
  useOrgMembers,
  useProjects,
  useUpdateCommitment,
  useVentures,
  useActivity,
  type Commitment,
  type CommitmentStatus,
  type Priority,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import { isCommitmentOverdue } from "@/lib/accountability";

export const Route = createFileRoute("/_authenticated/commitments/$id")({
  component: CommitmentDetail,
  head: () => ({ meta: [{ title: "Commitment  -  Northstar" }] }),
});

const STATUS_LABEL: Record<CommitmentStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting",
  overdue: "Overdue",
  completed: "Completed",
  canceled: "Canceled",
};

function CommitmentDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { activeOrgId, activeMembership } = useOrg();
  const q = useCommitment(id);
  const members = useOrgMembers(activeOrgId);
  const ventures = useVentures(activeOrgId);
  const projects = useProjects(activeOrgId);
  const activity = useActivity(activeOrgId, 40);
  const update = useUpdateCommitment(activeOrgId);
  const archive = useArchiveCommitment(activeOrgId);
  const canWrite = can.writeContent(activeMembership?.role);
  const canArchive = can.archiveContent(activeMembership?.role);
  const [postponeOpen, setPostponeOpen] = useState(false);

  if (q.isLoading) return <PageBody><div className="h-40 animate-pulse rounded-2xl bg-card/30" /></PageBody>;
  const c = q.data;
  if (!c) return <PageBody><p className="text-muted-foreground">Commitment not found.</p></PageBody>;

  const overdue = isCommitmentOverdue(c);
  const displayedStatus: string = overdue && c.status !== "overdue" ? "overdue" : c.status;

  async function patch(next: Partial<Commitment>) {
    try { await update.mutateAsync({ id: c!.id, patch: next, prev: c! }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Update failed"); }
  }

  async function complete() {
    try { await update.mutateAsync({ id: c!.id, patch: { status: "completed" }, prev: c! }); toast.success("Marked complete"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function reopen() {
    try { await update.mutateAsync({ id: c!.id, patch: { status: "in_progress" }, prev: c! }); toast.success("Reopened"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function cancel() {
    if (!confirm("Cancel this commitment? It stays on record.")) return;
    try { await update.mutateAsync({ id: c!.id, patch: { status: "canceled" }, prev: c! }); toast.success("Canceled"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function onArchive() {
    if (!confirm("Archive this commitment?")) return;
    await archive.mutateAsync(c!.id);
    toast.success("Archived");
    nav({ to: "/accountability" });
  }

  const memberOptions = (members.data ?? []).map((m) => ({
    value: m.user_id,
    label: m.profile?.preferred_name ?? m.profile?.full_name ?? m.profile?.email ?? m.user_id.slice(0, 8),
  }));
  const venture = (ventures.data ?? []).find((v) => v.id === c.venture_id);
  const project = (projects.data ?? []).find((p) => p.id === c.project_id);
  const rel = (activity.data ?? []).filter((a) => a.entity_type === "commitment" && a.entity_id === c.id);

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
        <div className="mx-auto max-w-6xl">
          <Link to="/accountability" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Accountability
          </Link>
        </div>
      </div>
      <PageHeader
        eyebrow={`${venture?.name ?? "Organization"} · ${STATUS_LABEL[displayedStatus as CommitmentStatus] ?? displayedStatus}${overdue ? " (calculated)" : ""}`}
        title={c.title}
        description={c.description ?? undefined}
        actions={
          <div className="flex gap-2">
            {canWrite && c.status !== "completed" && c.status !== "canceled" && (
              <>
                <button onClick={() => setPostponeOpen(true)} className="rounded-md bg-secondary/60 px-3 py-2 text-[12.5px] text-foreground hover:bg-secondary">Postpone</button>
                <button onClick={complete} className="rounded-md bg-foreground px-3 py-2 text-[12.5px] font-medium text-background hover:opacity-90">Complete</button>
              </>
            )}
            {canWrite && (c.status === "completed" || c.status === "canceled") && (
              <button onClick={reopen} className="rounded-md bg-foreground px-3 py-2 text-[12.5px] font-medium text-background hover:opacity-90">Reopen</button>
            )}
            {canWrite && c.status !== "canceled" && c.status !== "completed" && (
              <button onClick={cancel} className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground">Cancel</button>
            )}
            {canArchive && (
              <button onClick={onArchive} className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground">
                <Archive className="h-3.5 w-3.5 inline" />
              </button>
            )}
          </div>
        }
      />
      <PageBody>
        <Section title="Ownership & timing">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <MetaSelect label="Owner" value={c.owner_user_id ?? ""} disabled={!canWrite}
              onChange={(v) => patch({ owner_user_id: v || null })}
              options={[{ value: "", label: "Unassigned" }, ...memberOptions]} />
            <MetaSelect label="Priority" value={c.priority} disabled={!canWrite}
              onChange={(v) => patch({ priority: v as Priority })}
              options={[
                { value: "low", label: "Low" }, { value: "normal", label: "Normal" },
                { value: "high", label: "High" }, { value: "critical", label: "Critical" },
              ]} />
            <MetaSelect label="Status" value={c.status} disabled={!canWrite}
              onChange={(v) => patch({ status: v as CommitmentStatus })}
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
            <MetaDate label="Due date" value={c.due_date} disabled={!canWrite}
              onCommit={(v) => patch({ due_date: v })} />
            <MetaStatic label="Original due" value={c.original_due_date ?? " - "} />
            <MetaStatic label="Postponements" value={String(c.postponement_count ?? 0)} />
          </div>
        </Section>

        <Section title="Notes">
          <EditableText label="Notes" value={c.notes ?? ""} disabled={!canWrite} multiline
            onCommit={(v) => patch({ notes: v || null })} />
        </Section>

        {project && (
          <Section title="Related project">
            <Link to="/projects/$id" params={{ id: project.id }} className="text-[13.5px] text-foreground hover:underline">{project.name}</Link>
          </Section>
        )}

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

      {postponeOpen && (
        <PostponeDialog commitment={c} onClose={() => setPostponeOpen(false)}
          onSubmit={async (newDate, reason) => {
            try {
              await update.mutateAsync({ id: c.id, patch: { due_date: newDate }, prev: c, postpone: true, reason });
              toast.success("Postponed");
              setPostponeOpen(false);
            } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
          }} />
      )}
    </div>
  );
}

function PostponeDialog({ commitment, onClose, onSubmit }: {
  commitment: Commitment; onClose: () => void; onSubmit: (newDate: string, reason?: string) => Promise<void>;
}) {
  const [d, setD] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card p-8">
        <h3 className="font-display text-[22px] text-foreground">Postpone commitment</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">Current due date: {commitment.due_date ?? "none"}. Postponement count: {commitment.postponement_count}.</p>
        <div className="mt-5 space-y-4 text-[13.5px]">
          <label className="block rounded-lg bg-secondary/40 px-3 py-2.5">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">New due date</div>
            <input type="date" value={d} onChange={(e) => setD(e.target.value)} className="w-full bg-transparent outline-none" />
          </label>
          <label className="block rounded-lg bg-secondary/40 px-3 py-2.5">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">Reason (optional)</div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full resize-none bg-transparent outline-none" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={() => onSubmit(d, reason || undefined)} disabled={!d}
            className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">Postpone</button>
        </div>
      </div>
    </div>
  );
}

function MetaSelect({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean;
}) {
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
function MetaDate({ label, value, onCommit, disabled }: { label: string; value: string | null; onCommit: (v: string | null) => void; disabled?: boolean }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <label className="block">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      <input type="date" disabled={disabled} value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { if ((v || null) !== value) onCommit(v || null); }}
        className="w-full rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none hover:bg-secondary/60 disabled:opacity-60" />
    </label>
  );
}
function MetaStatic({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      <div className="rounded-md bg-secondary/20 px-3 py-2 text-[13.5px] text-foreground">{value}</div>
    </div>
  );
}
function EditableText({ label, value, onCommit, disabled, multiline }: {
  label: string; value: string; onCommit: (v: string) => void; disabled?: boolean; multiline?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="block">
      <div className="mb-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      {multiline ? (
        <textarea disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onCommit(v); }} rows={4}
          className="w-full resize-y rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none hover:bg-secondary/60 disabled:opacity-60" />
      ) : (
        <input disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onCommit(v); }}
          className="w-full rounded-md bg-secondary/40 px-3 py-2 text-[13.5px] text-foreground outline-none hover:bg-secondary/60 disabled:opacity-60" />
      )}
    </label>
  );
}