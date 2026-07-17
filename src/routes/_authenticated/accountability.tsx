import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import {
  useCommitments, useCreateCommitment, useDecisions, useGoals, useOrgMembers,
  useProjects, useVentures,
  type Commitment, type CommitmentStatus, type Priority,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import {
  buildAccountabilityStatements, isCommitmentOverdue, isDecisionWaiting,
  isProjectStalled, REPEATED_POSTPONEMENTS,
} from "@/lib/accountability";

export const Route = createFileRoute("/_authenticated/accountability")({
  component: AccountabilityPage,
  head: () => ({
    meta: [
      { title: "Accountability — Northstar" },
      { name: "description", content: "Commitments, owners, and follow-through across every venture." },
    ],
  }),
});

function AccountabilityPage() {
  const { user } = useAuth();
  const { activeOrgId, activeMembership } = useOrg();
  const commitmentsQ = useCommitments(activeOrgId);
  const decisionsQ = useDecisions(activeOrgId);
  const projectsQ = useProjects(activeOrgId);
  const goalsQ = useGoals(activeOrgId);
  const members = useOrgMembers(activeOrgId);
  const ventures = useVentures(activeOrgId);
  const [showNew, setShowNew] = useState(false);
  const canWrite = can.writeContent(activeMembership?.role);
  const userId = user?.id ?? null;

  const commitments = commitmentsQ.data ?? [];
  const memberMap = useMemo(() => new Map((members.data ?? []).map((m) => [m.user_id, m.profile?.preferred_name ?? m.profile?.full_name ?? m.profile?.email ?? m.user_id.slice(0, 6)])), [members.data]);

  const mine = commitments.filter((c) => c.owner_user_id === userId && c.status !== "completed" && c.status !== "canceled");
  const team = commitments.filter((c) => c.owner_user_id !== userId && c.status !== "completed" && c.status !== "canceled");
  const overdue = commitments.filter(isCommitmentOverdue);
  const repeatedlyDelayed = commitments.filter((c) => (c.postponement_count ?? 0) >= REPEATED_POSTPONEMENTS && c.status !== "completed" && c.status !== "canceled");
  const waitingOnMe = [
    ...commitments.filter((c) => c.owner_user_id === userId && c.status === "waiting"),
  ];
  const decisionsWaiting = (decisionsQ.data ?? []).filter((d) => isDecisionWaiting(d, userId));
  const stalled = (projectsQ.data ?? []).filter(isProjectStalled);
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const recentlyCompleted = commitments.filter((c) => c.status === "completed" && c.completed_at && c.completed_at >= cutoff);

  const statements = buildAccountabilityStatements({
    userId,
    commitments,
    decisions: decisionsQ.data ?? [],
    projects: projectsQ.data ?? [],
    goals: goalsQ.data ?? [],
  });

  return (
    <div>
      <PageHeader
        eyebrow="Accountability"
        title="Who owes what, by when."
        description="Every commitment made across ventures, tracked from real data."
        actions={canWrite && (
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> New commitment
          </button>
        )}
      />
      <PageBody>
        {statements.length > 0 && (
          <Section title="Accountability signals" hint="Rule-based. Not AI-generated.">
            <ul className="space-y-3">
              {statements.map((s) => (
                <li key={s.id} className="flex items-start gap-3 text-[14px]">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
                  {s.link ? (
                    <Link to={s.link.to as never} params={s.link.params as never} className="text-foreground hover:underline">{s.text}</Link>
                  ) : (
                    <span className="text-foreground">{s.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <CommitmentSection title="My commitments" items={mine} memberMap={memberMap} empty="Nothing on your plate right now." />
        <CommitmentSection title="Overdue" items={overdue} memberMap={memberMap} empty="Nothing overdue." />
        <CommitmentSection title="Repeatedly delayed" items={repeatedlyDelayed} memberMap={memberMap} empty="No repeated slippage." showPostponements />
        {waitingOnMe.length + decisionsWaiting.length > 0 && (
          <Section title="Waiting on me">
            <ul className="divide-y divide-border/60">
              {waitingOnMe.map((c) => (
                <li key={`c-${c.id}`} className="py-4">
                  <Link to="/commitments/$id" params={{ id: c.id }} className="text-[14px] text-foreground hover:underline">{c.title}</Link>
                  <div className="text-[12px] text-muted-foreground">Commitment · waiting</div>
                </li>
              ))}
              {decisionsWaiting.map((d) => (
                <li key={`d-${d.id}`} className="py-4">
                  <Link to="/decisions/$id" params={{ id: d.id }} className="text-[14px] text-foreground hover:underline">{d.title}</Link>
                  <div className="text-[12px] text-muted-foreground">Decision · {d.status.replaceAll("_"," ")}</div>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title="Stalled projects" hint={`No movement in 7+ days.`}>
          {stalled.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">No stalled projects.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {stalled.map((p) => (
                <li key={p.id} className="py-4">
                  <Link to="/projects/$id" params={{ id: p.id }} className="text-[14px] text-foreground hover:underline">{p.name}</Link>
                  <div className="text-[12px] text-muted-foreground">{p.status.replaceAll("_"," ")} · updated {new Date(p.updated_at).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <CommitmentSection title="Team commitments" items={team} memberMap={memberMap} empty="No team commitments open." />
        <CommitmentSection title="Recently completed" items={recentlyCompleted} memberMap={memberMap} empty="No completions in the last 30 days." showCompleted />
      </PageBody>

      {showNew && (
        <NewCommitmentDialog orgId={activeOrgId} ventures={ventures.data ?? []} members={members.data ?? []} onClose={() => setShowNew(false)} />
      )}
    </div>
  );
}

function CommitmentSection({
  title, items, memberMap, empty, showPostponements, showCompleted,
}: {
  title: string; items: Commitment[]; memberMap: Map<string, string | undefined>; empty: string;
  showPostponements?: boolean; showCompleted?: boolean;
}) {
  return (
    <Section title={title}>
      {items.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((c) => {
            const overdue = isCommitmentOverdue(c);
            return (
              <li key={c.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <Link to="/commitments/$id" params={{ id: c.id }} className="block text-[14px] text-foreground hover:underline">{c.title}</Link>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">
                    {c.owner_user_id ? memberMap.get(c.owner_user_id) ?? "Assigned" : "Unassigned"}
                    {c.due_date ? ` · due ${c.due_date}` : ""}
                    {showPostponements ? ` · postponed ${c.postponement_count}×` : ""}
                    {showCompleted && c.completed_at ? ` · completed ${new Date(c.completed_at).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <span className={overdue ? "text-[12px] text-[oklch(0.72_0.14_25)]" : "text-[12px] text-muted-foreground"}>
                  {overdue ? "Overdue" : c.status.replaceAll("_", " ")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function NewCommitmentDialog({ orgId, ventures, members, onClose, presetVentureId, presetProjectId }: {
  orgId: string | null;
  ventures: { id: string; name: string }[];
  members: { user_id: string; profile: { full_name: string | null; preferred_name: string | null; email: string | null } | null }[];
  onClose: () => void;
  presetVentureId?: string | null;
  presetProjectId?: string | null;
}) {
  const create = useCreateCommitment(orgId);
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ventureId, setVentureId] = useState(presetVentureId ?? "");
  const [ownerId, setOwnerId] = useState<string>(user?.id ?? "");
  const [priority, setPriority] = useState<Priority>("normal");
  const [status, setStatus] = useState<CommitmentStatus>("open");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title required");
    if (!ownerId) return toast.error("Owner required");
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description || undefined,
        venture_id: ventureId || null,
        project_id: presetProjectId ?? null,
        owner_user_id: ownerId,
        priority, status,
        due_date: dueDate || null,
        notes: notes || undefined,
      });
      toast.success("Commitment created");
      onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="relative w-full max-w-lg rounded-2xl bg-card p-8">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        <h2 className="font-display text-[24px] text-foreground">New commitment</h2>
        <div className="mt-6 space-y-4 text-[13.5px]">
          <F label="Title"><input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-transparent outline-none" /></F>
          <F label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full resize-none bg-transparent outline-none" /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Owner">
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full bg-transparent outline-none">
                <option value="">Choose…</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile?.preferred_name ?? m.profile?.full_name ?? m.profile?.email ?? m.user_id.slice(0,6)}</option>)}
              </select>
            </F>
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
            <F label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as CommitmentStatus)} className="w-full bg-transparent outline-none">
                {["open","in_progress","waiting"].map((s) => <option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}
              </select>
            </F>
            <F label="Due date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-transparent outline-none" /></F>
            <F label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-transparent outline-none" /></F>
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={create.isPending} className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
            {create.isPending ? "Creating…" : "Create commitment"}
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