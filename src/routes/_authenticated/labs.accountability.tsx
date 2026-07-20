import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
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
  useCommitments,
  useCreateCommitment,
  useOrgMembers,
  useVentures,
  useProjects,
  type Commitment,
  type CommitmentStatus,
  type Priority,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/labs/accountability")({
  component: AccountabilityIndex,
  head: () => ({
    meta: [
      { title: "Accountability - NorthStar Labs" },
      {
        name: "description",
        content:
          "Who owes what, by when. The register of commitments and their standing.",
      },
    ],
  }),
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

type GroupKey =
  | "overdue"
  | "due_soon"
  | "in_progress"
  | "waiting"
  | "open"
  | "completed_recent"
  | "closed";

const GROUPS: { key: GroupKey; label: string; hint: string }[] = [
  { key: "overdue", label: "Overdue", hint: "Past their promised date. Handle first." },
  { key: "due_soon", label: "Due within seven days", hint: "Coming up. Confirm they will land." },
  { key: "in_progress", label: "In motion", hint: "Actively being worked." },
  { key: "waiting", label: "Waiting", hint: "Blocked on someone or something." },
  { key: "open", label: "Open, undated", hint: "Accepted but not yet scheduled. Ambiguity risk." },
  { key: "completed_recent", label: "Recently completed", hint: "Delivered in the last thirty days." },
  { key: "closed", label: "Archived", hint: "Canceled or older completions." },
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function groupOf(c: Commitment, today: string, soon: string, thirtyDaysAgo: string): GroupKey {
  if (c.status === "canceled") return "closed";
  if (c.status === "completed") {
    if (c.completed_at && c.completed_at.slice(0, 10) >= thirtyDaysAgo) return "completed_recent";
    return "closed";
  }
  if (c.status === "waiting") return "waiting";
  if (c.due_date && c.due_date < today) return "overdue";
  if (c.due_date && c.due_date <= soon) return "due_soon";
  if (c.status === "in_progress") return "in_progress";
  if (!c.due_date) return "open";
  return c.status === "open" ? "open" : "in_progress";
}

function AccountabilityIndex() {
  const { activeOrgId, activeMembership } = useOrg();
  const commitmentsQ = useCommitments(activeOrgId);
  const venturesQ = useVentures(activeOrgId);
  const membersQ = useOrgMembers(activeOrgId);
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [ventureFilter, setVentureFilter] = useState<string>("all");
  const [scope, setScope] = useState<"active" | "all">("active");
  const canWrite = can.writeContent(activeMembership?.role);

  const ventureMap = useMemo(
    () => new Map((venturesQ.data ?? []).map((v) => [v.id, v.name])),
    [venturesQ.data],
  );
  const memberMap = useMemo(
    () =>
      new Map(
        (membersQ.data ?? []).map((m) => [
          m.user_id,
          m.profile?.preferred_name ??
            m.profile?.full_name ??
            m.profile?.email ??
            m.user_id.slice(0, 6),
        ]),
      ),
    [membersQ.data],
  );

  const today = iso(new Date());
  const soon = iso(new Date(Date.now() + 7 * 86400000));
  const thirtyDaysAgo = iso(new Date(Date.now() - 30 * 86400000));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (commitmentsQ.data ?? []).filter((c) => {
      if (ownerFilter !== "all" && (c.owner_user_id ?? "") !== ownerFilter) return false;
      if (ventureFilter !== "all" && (c.venture_id ?? "") !== ventureFilter) return false;
      if (q) {
        const hay = `${c.title} ${c.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [commitmentsQ.data, ownerFilter, ventureFilter, query]);

  const grouped = useMemo(() => {
    const bucket = new Map<GroupKey, Commitment[]>();
    for (const g of GROUPS) bucket.set(g.key, []);
    for (const c of filtered) bucket.get(groupOf(c, today, soon, thirtyDaysAgo))!.push(c);
    bucket.get("overdue")!.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    bucket.get("due_soon")!.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    bucket.get("in_progress")!.sort((a, b) => (a.due_date ?? "z").localeCompare(b.due_date ?? "z"));
    bucket.get("waiting")!.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    bucket.get("open")!.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    bucket
      .get("completed_recent")!
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    bucket.get("closed")!.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return bucket;
  }, [filtered, today, soon, thirtyDaysAgo]);

  const isEmpty =
    !commitmentsQ.isLoading && !commitmentsQ.error && (commitmentsQ.data ?? []).length === 0;
  const nothingMatched =
    !commitmentsQ.isLoading &&
    !commitmentsQ.error &&
    !isEmpty &&
    filtered.length === 0;
  const activeGroups = GROUPS.filter(
    (g) => !(scope === "active" && (g.key === "completed_recent" || g.key === "closed")),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Accountability"
        title="The commitment register."
        description="What has been promised, by whom, and by when. Ordered by what needs your attention first."
        actions={
          canWrite && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New commitment
            </button>
          )
        }
      />
      <PageBody>
        <div className="mb-12 border-b border-foreground/15 pb-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 md:flex md:flex-wrap md:justify-between">
            <label className="flex min-w-0 items-center gap-2 border-b border-foreground/40 py-1 focus-within:border-foreground md:w-72">
              <Search className="h-3.5 w-3.5 shrink-0 text-foreground/50" strokeWidth={1.5} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commitments"
                aria-label="Search commitments"
                className="w-full min-w-0 bg-transparent py-1 text-[13.5px] text-foreground placeholder:italic placeholder:text-foreground/45 focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap shrink-0 items-center gap-4">
              <QuietSelect
                label="Owner"
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={[
                  { value: "all", label: "All owners" },
                  ...(membersQ.data ?? []).map((m) => ({
                    value: m.user_id,
                    label:
                      m.profile?.preferred_name ??
                      m.profile?.full_name ??
                      m.profile?.email ??
                      m.user_id.slice(0, 6),
                  })),
                ]}
              />
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
                label="Scope"
                value={scope}
                onChange={(v) => setScope(v as "active" | "all")}
                options={[
                  { value: "active", label: "Active" },
                  { value: "all", label: "All including closed" },
                ]}
              />
            </div>
          </div>
        </div>

        {commitmentsQ.isLoading ? (
          <EditorialSkeleton rows={6} />
        ) : commitmentsQ.error ? (
          <ErrorLine message={(commitmentsQ.error as Error).message} />
        ) : isEmpty ? (
          <EmptyEditorialState
            eyebrow="Nothing on the ledger"
            title="No commitments recorded."
            description="Record the first promise your team has taken on. Ownership, due date, and standing all live here."
            action={
              canWrite ? (
                <button
                  onClick={() => setShowNew(true)}
                  className="inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New commitment
                </button>
              ) : null
            }
          />
        ) : nothingMatched ? (
          <EmptyEditorialState
            eyebrow="No matches"
            title="Nothing matches these filters."
            description="Try a broader search, or reset the owner or venture filter."
          />
        ) : (
          <div>
            {activeGroups.map((g) => {
              const rows = grouped.get(g.key) ?? [];
              if (rows.length === 0) return null;
              return (
                <CommitmentGroup
                  key={g.key}
                  label={g.label}
                  hint={g.hint}
                  count={rows.length}
                  rows={rows}
                  ventureMap={ventureMap}
                  memberMap={memberMap}
                  today={today}
                  muted={g.key === "closed"}
                  urgent={g.key === "overdue"}
                />
              );
            })}
          </div>
        )}
      </PageBody>

      {showNew && (
        <NewCommitmentDialog
          orgId={activeOrgId}
          ventures={venturesQ.data ?? []}
          members={membersQ.data ?? []}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function CommitmentGroup({
  label,
  hint,
  count,
  rows,
  ventureMap,
  memberMap,
  today,
  muted,
  urgent,
}: {
  label: string;
  hint: string;
  count: number;
  rows: Commitment[];
  ventureMap: Map<string, string>;
  memberMap: Map<string, string | undefined>;
  today: string;
  muted?: boolean;
  urgent?: boolean;
}) {
  return (
    <section className={cn("mb-14", muted && "opacity-70")}>
      <div
        className={cn(
          "flex items-baseline justify-between gap-4 border-b pb-2",
          urgent ? "border-[oklch(0.5_0.18_27)]" : "border-foreground/80",
        )}
      >
        <SectionLabel className={cn(urgent && "text-[oklch(0.5_0.18_27)]")}>{label}</SectionLabel>
        <span className="text-[11px] tabular-nums uppercase tracking-[0.22em] text-foreground/55">
          {count}
        </span>
      </div>
      <p className="mt-3 text-[12.5px] italic text-foreground/60">{hint}</p>
      <Ledger className="mt-4 border-t border-foreground/15">
        {rows.map((c, i) => (
          <CommitmentRow
            key={c.id}
            index={i + 1}
            c={c}
            venture={ventureMap.get(c.venture_id ?? "")}
            owner={c.owner_user_id ? memberMap.get(c.owner_user_id) ?? undefined : undefined}
            today={today}
          />
        ))}
      </Ledger>
    </section>
  );
}

function CommitmentRow({
  index,
  c,
  venture,
  owner,
  today,
}: {
  index: number;
  c: Commitment;
  venture?: string;
  owner?: string;
  today: string;
}) {
  const overdue = c.due_date && c.due_date < today && c.status !== "completed" && c.status !== "canceled";
  const daysLate = overdue && c.due_date
    ? Math.max(
        1,
        Math.floor(
          (Date.parse(today) - Date.parse(c.due_date)) / 86400000,
        ),
      )
    : 0;
  return (
    <li className="group hover:bg-foreground/[0.02]">
      <Link
        to="/commitments/$id"
        params={{ id: c.id }}
        className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-4 py-4 focus:outline-none focus-visible:bg-foreground/[0.04] md:grid-cols-[2.25rem_minmax(0,1fr)_11rem_auto] md:gap-6"
      >
        <span className="pt-1 font-display text-[14px] leading-none text-foreground/40 tabular-nums">
          {String(index).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
            {owner ?? "Unassigned"}
            {venture ? ` - ${venture}` : ""}
            {c.priority !== "normal" ? ` - ${c.priority}` : ""}
          </div>
          <div className="mt-1.5 font-display text-[19px] leading-[1.2] text-foreground group-hover:underline underline-offset-4 md:text-[22px]">
            {c.title}
          </div>
          {c.description && (
            <div className="mt-2 line-clamp-2 max-w-2xl text-[13.5px] italic text-foreground/70">
              {c.description}
            </div>
          )}
          {c.postponement_count > 0 && (
            <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[oklch(0.55_0.14_65)]">
              Postponed {c.postponement_count} {c.postponement_count === 1 ? "time" : "times"}
              {c.original_due_date ? ` - originally ${c.original_due_date}` : ""}
            </div>
          )}
        </div>
        <div className="hidden text-[11px] uppercase tracking-[0.18em] text-foreground/70 md:block">
          {c.due_date ? (
            <div
              className={cn(
                "tabular-nums",
                overdue && "text-[oklch(0.5_0.18_27)]",
              )}
            >
              Due {c.due_date}
              {overdue ? ` - ${daysLate}d late` : ""}
            </div>
          ) : (
            <div className="text-foreground/45">No due date</div>
          )}
          <div className="mt-1 tabular-nums text-foreground/50">
            Updated {c.updated_at.slice(0, 10)}
          </div>
        </div>
        <div className="flex shrink-0 items-center pt-1">
          <StatusLine tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</StatusLine>
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

function NewCommitmentDialog({
  orgId,
  ventures,
  members,
  onClose,
}: {
  orgId: string | null;
  ventures: { id: string; name: string }[];
  members: { user_id: string; profile: { preferred_name: string | null; full_name: string | null; email: string | null } | null }[];
  onClose: () => void;
}) {
  const create = useCreateCommitment(orgId);
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ventureId, setVentureId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    try {
      const c = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        venture_id: ventureId || null,
        owner_user_id: ownerId || null,
        priority,
        due_date: dueDate || null,
      });
      toast.success("Commitment recorded");
      onClose();
      nav({ to: "/commitments/$id", params: { id: c.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
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
        onSubmit={submit}
        className="relative w-full max-w-xl border border-foreground/15 bg-background shadow-[0_20px_60px_-20px_oklch(0.15_0.02_60/0.35)]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-baseline justify-between border-b border-foreground/80 px-8 pb-2 pt-8">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/60">
              New entry
            </div>
            <h2 className="mt-3 font-display text-[30px] leading-none text-foreground">
              A new commitment
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
          Ownership, timing, and priority are the minimum needed to hold this to account.
        </p>
        <div className="grid gap-6 px-8 pb-8 pt-6">
          <PaperField label="Title" required>
            <input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
            />
          </PaperField>
          <PaperField label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none bg-transparent py-1 text-[15px] leading-relaxed text-foreground focus:outline-none"
            />
          </PaperField>
          <div className="grid gap-6 md:grid-cols-2">
            <PaperField label="Owner">
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
              >
                <option value="">Assign to me</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.preferred_name ??
                      m.profile?.full_name ??
                      m.profile?.email ??
                      m.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </PaperField>
            <PaperField label="Venture">
              <select
                value={ventureId}
                onChange={(e) => setVentureId(e.target.value)}
                className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
              >
                <option value="">Organization-wide</option>
                {ventures.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </PaperField>
            <PaperField label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-transparent py-1 text-[15px] tabular-nums text-foreground focus:outline-none"
              />
            </PaperField>
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
          </div>
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
            disabled={!title || create.isPending}
            className="inline-flex items-center gap-2 border border-foreground bg-foreground px-5 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:border-foreground/30 disabled:bg-foreground/30"
          >
            {create.isPending ? "Recording." : "Enter into the register"}
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