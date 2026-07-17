import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Plus, X, Search } from "lucide-react";
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
  useCreateDecision,
  useDecisions,
  useOrgMembers,
  useVentures,
  type Decision,
  type DecisionStatus,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import { parseEvidence } from "@/lib/decision-structured";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/decisions")({
  component: DecisionsLayout,
  head: () => ({
    meta: [
      { title: "Decisions - Northstar" },
      {
        name: "description",
        content: "Every open question, its context, and who it's waiting on.",
      },
    ],
  }),
});

function DecisionsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/decisions") return <Outlet />;
  return <DecisionsIndex />;
}

const STATUS_LABEL: Record<DecisionStatus, string> = {
  draft: "Draft",
  under_review: "Under review",
  waiting_for_founder: "Waiting on founder",
  decided: "Decided",
  revisit_later: "Revisit later",
  closed: "Closed",
};

const STATUS_TONE: Record<DecisionStatus, StatusTone> = {
  draft: "neutral",
  under_review: "attention",
  waiting_for_founder: "critical",
  decided: "positive",
  revisit_later: "attention",
  closed: "muted",
};

type GroupKey =
  | "needs_decision"
  | "under_review"
  | "waiting_founder"
  | "revisit_due"
  | "decided_recent"
  | "archived";

type Group = { key: GroupKey; label: string; hint: string };

const GROUPS: Group[] = [
  { key: "needs_decision", label: "Needs decision", hint: "Drafts on your desk. No verdict yet." },
  { key: "under_review", label: "Under review", hint: "Being examined. Waiting on evidence, discussion, or an owner." },
  { key: "waiting_founder", label: "Waiting on founder", hint: "Escalated. Blocking work until answered." },
  { key: "revisit_due", label: "Revisit due", hint: "Review date has arrived." },
  { key: "decided_recent", label: "Decided", hint: "Recorded in the last thirty days." },
  { key: "archived", label: "Archived", hint: "Retained for the record." },
];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function groupOf(d: Decision, today: string, thirtyDaysAgo: string): GroupKey {
  if (d.status === "closed") return "archived";
  if (d.status === "waiting_for_founder") return "waiting_founder";
  if (d.status === "under_review") return "under_review";
  if (d.status === "revisit_later") {
    if (d.review_date && d.review_date <= today) return "revisit_due";
    return "under_review";
  }
  if (d.status === "draft") {
    if (d.review_date && d.review_date <= today) return "revisit_due";
    return "needs_decision";
  }
  // decided
  if (d.decision_date && d.decision_date >= thirtyDaysAgo) return "decided_recent";
  return "archived";
}

function DecisionsIndex() {
  const { activeOrgId, activeMembership } = useOrg();
  const decisionsQ = useDecisions(activeOrgId);
  const venturesQ = useVentures(activeOrgId);
  const membersQ = useOrgMembers(activeOrgId);
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
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

  const today = isoToday();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (decisionsQ.data ?? []).filter((d) => {
      if (ventureFilter !== "all" && d.venture_id !== ventureFilter) return false;
      if (q) {
        const hay = `${d.title} ${d.question ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [decisionsQ.data, ventureFilter, query]);

  const grouped = useMemo(() => {
    const bucket = new Map<GroupKey, Decision[]>();
    for (const g of GROUPS) bucket.set(g.key, []);
    for (const d of filtered) bucket.get(groupOf(d, today, thirtyDaysAgo))!.push(d);
    bucket.get("needs_decision")!.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    bucket.get("under_review")!.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    bucket.get("waiting_founder")!.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    bucket.get("revisit_due")!.sort((a, b) => (a.review_date ?? "").localeCompare(b.review_date ?? ""));
    bucket.get("decided_recent")!.sort((a, b) => (b.decision_date ?? "").localeCompare(a.decision_date ?? ""));
    bucket.get("archived")!.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return bucket;
  }, [filtered, today, thirtyDaysAgo]);

  const isEmpty =
    !decisionsQ.isLoading && !decisionsQ.error && (decisionsQ.data ?? []).length === 0;
  const nothingMatched =
    !decisionsQ.isLoading &&
    !decisionsQ.error &&
    !isEmpty &&
    filtered.length === 0;

  const activeGroups = GROUPS.filter(
    (g) => !(scope === "active" && (g.key === "decided_recent" || g.key === "archived")),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Decisions"
        title="The decision register."
        description="What still needs a verdict, what is under review, and what has been recorded. Grouped so blocking questions read first."
        actions={
          canWrite && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New decision
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
                placeholder="Search decisions"
                aria-label="Search decisions"
                className="w-full min-w-0 bg-transparent py-1 text-[13.5px] text-foreground placeholder:italic placeholder:text-foreground/45 focus:outline-none"
              />
            </label>
            <div className="flex shrink-0 items-center gap-4">
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
                  { value: "all", label: "All including decided" },
                ]}
              />
            </div>
          </div>
        </div>

        {decisionsQ.isLoading ? (
          <EditorialSkeleton rows={6} />
        ) : decisionsQ.error ? (
          <ErrorLine message={(decisionsQ.error as Error).message} />
        ) : isEmpty ? (
          <EmptyEditorialState
            eyebrow="Empty register"
            title="No decisions yet."
            description="Record the first question on your desk. Its context, options, evidence, and rationale live here."
            action={
              canWrite ? (
                <button
                  onClick={() => setShowNew(true)}
                  className="inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[11.5px] uppercase tracking-[0.2em] text-background hover:bg-foreground/90"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New decision
                </button>
              ) : null
            }
          />
        ) : nothingMatched ? (
          <EmptyEditorialState
            eyebrow="No matches"
            title="Nothing matches these filters."
            description="Try a broader search or clear the venture filter."
          />
        ) : (
          <div>
            {activeGroups.map((g) => {
              const rows = grouped.get(g.key) ?? [];
              if (rows.length === 0) return null;
              return (
                <DecisionGroup
                  key={g.key}
                  label={g.label}
                  hint={g.hint}
                  count={rows.length}
                  rows={rows}
                  ventureMap={ventureMap}
                  memberMap={memberMap}
                  today={today}
                  muted={g.key === "archived"}
                />
              );
            })}
          </div>
        )}
      </PageBody>

      {showNew && (
        <NewDecisionDialog
          orgId={activeOrgId}
          ventures={venturesQ.data ?? []}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function DecisionGroup({
  label,
  hint,
  count,
  rows,
  ventureMap,
  memberMap,
  today,
  muted,
}: {
  label: string;
  hint: string;
  count: number;
  rows: Decision[];
  ventureMap: Map<string, string>;
  memberMap: Map<string, string | undefined>;
  today: string;
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
      <Ledger className="mt-4 border-t border-foreground/15">
        {rows.map((d, idx) => (
          <DecisionRow
            key={d.id}
            index={idx + 1}
            d={d}
            venture={ventureMap.get(d.venture_id ?? "")}
            memberMap={memberMap}
            today={today}
          />
        ))}
      </Ledger>
    </section>
  );
}

function DecisionRow({
  index,
  d,
  venture,
  memberMap,
  today,
}: {
  index: number;
  d: Decision;
  venture?: string;
  memberMap: Map<string, string | undefined>;
  today: string;
}) {
  const owner = d.owner_user_id ? memberMap.get(d.owner_user_id) : null;
  const evidenceCount = parseEvidence(d.evidence).length;
  const reviewOverdue = d.review_date && d.review_date < today;
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const dueSoon = d.review_date && d.review_date >= today && d.review_date <= soon;

  return (
    <li className="group hover:bg-foreground/[0.02]">
      <Link
        to="/decisions/$id"
        params={{ id: d.id }}
        className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-4 py-4 focus:outline-none focus-visible:bg-foreground/[0.04] md:grid-cols-[2.25rem_minmax(0,1fr)_11rem_auto] md:gap-6"
      >
        <span className="pt-1 font-display text-[14px] leading-none text-foreground/40 tabular-nums">
          {String(index).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
            {venture ?? "Organization"}
            {owner ? ` - owned by ${owner}` : d.owner_user_id ? " - assigned" : " - unassigned"}
          </div>
          <div className="mt-1.5 font-display text-[19px] leading-[1.2] text-foreground group-hover:underline underline-offset-4 md:text-[22px]">
            {d.title}
          </div>
          {d.question && (
            <div className="mt-2 line-clamp-2 max-w-2xl text-[13.5px] italic text-foreground/70">
              {d.question}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-foreground/55">
            {evidenceCount > 0 && (
              <span>
                {evidenceCount} {evidenceCount === 1 ? "evidence item" : "evidence items"}
              </span>
            )}
            {d.decision_date && (
              <span className="tabular-nums">Decided {d.decision_date}</span>
            )}
          </div>
        </div>
        <div className="hidden text-[11px] uppercase tracking-[0.18em] text-foreground/70 md:block">
          {d.review_date ? (
            <div
              className={cn(
                "tabular-nums",
                reviewOverdue && "text-[oklch(0.5_0.18_27)]",
                !reviewOverdue && dueSoon && "text-[oklch(0.55_0.14_65)]",
              )}
            >
              Review {d.review_date}
              {reviewOverdue ? " - overdue" : ""}
            </div>
          ) : (
            <div className="text-foreground/45">No review date</div>
          )}
          <div className="mt-1 tabular-nums text-foreground/50">
            Updated {d.updated_at.slice(0, 10)}
          </div>
        </div>
        <div className="flex shrink-0 items-center pt-1">
          <StatusLine tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</StatusLine>
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

function NewDecisionDialog({
  orgId,
  ventures,
  onClose,
}: {
  orgId: string | null;
  ventures: { id: string; name: string }[];
  onClose: () => void;
}) {
  const create = useCreateDecision(orgId);
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [ventureId, setVentureId] = useState<string>("");
  const [status, setStatus] = useState<DecisionStatus>("draft");
  const [reviewDate, setReviewDate] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    try {
      const d = await create.mutateAsync({
        title: title.trim(),
        question: question.trim() || undefined,
        context: context.trim() || undefined,
        venture_id: ventureId || null,
        status,
        review_date: reviewDate || null,
      });
      toast.success("Decision recorded");
      onClose();
      nav({ to: "/decisions/$id", params: { id: d.id } });
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
        aria-labelledby="new-decision-title"
      >
        <div className="flex items-baseline justify-between border-b border-foreground/80 px-8 pb-2 pt-8">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/60">
              New entry
            </div>
            <h2 id="new-decision-title" className="mt-3 font-display text-[30px] leading-none text-foreground">
              A new decision
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
          Options, evidence, and rationale can be added after recording.
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
          <PaperField label="Question">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What are we deciding?"
              className="w-full bg-transparent py-1 text-[15px] text-foreground placeholder:italic placeholder:text-foreground/45 focus:outline-none"
            />
          </PaperField>
          <PaperField label="Context">
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              className="w-full resize-none bg-transparent py-1 text-[15px] leading-relaxed text-foreground focus:outline-none"
            />
          </PaperField>
          <div className="grid gap-6 md:grid-cols-3">
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
            <PaperField label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DecisionStatus)}
                className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
              >
                {Object.entries(STATUS_LABEL)
                  .filter(([v]) => v !== "decided" && v !== "closed")
                  .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
              </select>
            </PaperField>
            <PaperField label="Review date">
              <input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                className="w-full bg-transparent py-1 text-[15px] text-foreground focus:outline-none"
              />
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