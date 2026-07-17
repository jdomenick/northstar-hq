import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus, X, ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import {
  useCreateDecision,
  useDecisions,
  useVentures,
  type Decision,
  type DecisionStatus,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/decisions")({
  component: DecisionsLayout,
  head: () => ({
    meta: [
      { title: "Decisions  -  Northstar" },
      { name: "description", content: "Every open decision, its stakes, and who it's waiting on." },
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

type SortMode = "updated" | "oldest" | "review" | "decision" | "status" | "venture";

function DecisionsIndex() {
  const { activeOrgId, activeMembership } = useOrg();
  const decisionsQ = useDecisions(activeOrgId);
  const venturesQ = useVentures(activeOrgId);
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [venture, setVenture] = useState<string>("all");
  const [status, setStatus] = useState<string>("open");
  const [sort, setSort] = useState<SortMode>("updated");
  const canWrite = can.writeContent(activeMembership?.role);

  const ventureMap = useMemo(
    () => new Map((venturesQ.data ?? []).map((v) => [v.id, v.name])),
    [venturesQ.data],
  );

  const filtered = useMemo(() => {
    let list = decisionsQ.data ?? [];
    if (status === "open") {
      list = list.filter((d) => d.status !== "closed" && d.status !== "decided");
    } else if (status !== "all") {
      list = list.filter((d) => d.status === status);
    }
    if (venture !== "all") list = list.filter((d) => d.venture_id === venture);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((d) => `${d.title} ${d.question ?? ""}`.toLowerCase().includes(q));
    }
    const sorted = [...list];
    switch (sort) {
      case "oldest":
        sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "review":
        sorted.sort((a, b) => (a.review_date ?? "9999").localeCompare(b.review_date ?? "9999"));
        break;
      case "decision":
        sorted.sort((a, b) => (b.decision_date ?? "").localeCompare(a.decision_date ?? ""));
        break;
      case "status":
        sorted.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case "venture":
        sorted.sort((a, b) =>
          (ventureMap.get(a.venture_id ?? "") ?? "").localeCompare(ventureMap.get(b.venture_id ?? "") ?? ""),
        );
        break;
      default:
        sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    return sorted;
  }, [decisionsQ.data, status, venture, query, sort, ventureMap]);

  return (
    <div>
      <PageHeader
        eyebrow="Decisions"
        title="Decisions on your desk."
        description="Every open question, its context, and who it's waiting on."
        actions={
          canWrite && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> New decision
            </button>
          )
        }
      />
      <PageBody>
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <input
            placeholder="Search decisions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[200px] flex-1 rounded-md bg-secondary/40 px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          <Sel value={status} onChange={setStatus} options={[
            { value: "open", label: "Open" },
            { value: "all", label: "All" },
            ...(Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))),
          ]} />
          <Sel value={venture} onChange={setVenture} options={[
            { value: "all", label: "All ventures" },
            ...(venturesQ.data ?? []).map((v) => ({ value: v.id, label: v.name })),
          ]} />
          <Sel value={sort} onChange={(v) => setSort(v as SortMode)} options={[
            { value: "updated", label: "Recently updated" },
            { value: "oldest", label: "Oldest" },
            { value: "review", label: "Review date" },
            { value: "decision", label: "Decision date" },
            { value: "status", label: "Status" },
            { value: "venture", label: "Venture" },
          ]} />
        </div>

        {decisionsQ.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-card/30" />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13.5px] text-muted-foreground">
            {(decisionsQ.data ?? []).length === 0
              ? "No decisions yet. Add one to get started."
              : "No decisions match these filters."}
          </div>
        ) : (
          <div className="-mx-2">
            {filtered.map((d) => (
              <DecisionRow key={d.id} d={d} venture={ventureMap.get(d.venture_id ?? "")} />
            ))}
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

function DecisionRow({ d, venture }: { d: Decision; venture?: string }) {
  return (
    <Link
      to="/decisions/$id"
      params={{ id: d.id }}
      className="group flex items-start gap-6 rounded-xl px-4 py-6 border-b border-border/60 last:border-0 hover:bg-secondary/30"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
          {venture ?? "Organization"} · {STATUS_LABEL[d.status]}
          {d.review_date ? ` · review ${d.review_date}` : ""}
        </div>
        <h3 className="mt-2.5 font-display text-[19px] leading-snug text-foreground">{d.title}</h3>
        {d.question && (
          <p className="mt-2 line-clamp-2 max-w-2xl text-[13.5px] leading-[1.65] text-muted-foreground">
            {d.question}
          </p>
        )}
      </div>
      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function Sel({
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
      className="rounded-md bg-secondary/40 px-2.5 py-2 text-[12.5px] text-foreground outline-none hover:bg-secondary/60"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
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
    if (!title.trim()) return toast.error("Title required");
    try {
      const d = await create.mutateAsync({
        title: title.trim(),
        question: question.trim() || undefined,
        context: context.trim() || undefined,
        venture_id: ventureId || null,
        status,
        review_date: reviewDate || null,
      });
      toast.success("Decision created");
      onClose();
      nav({ to: "/decisions/$id", params: { id: d.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="relative w-full max-w-lg rounded-2xl bg-card p-8 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-display text-[24px] text-foreground">New decision</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">You can add options, evidence and risks after creating.</p>
        <div className="mt-6 space-y-4 text-[13.5px]">
          <Field label="Title">
            <input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-transparent outline-none" />
          </Field>
          <Field label="Question">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What are we deciding?" className="w-full bg-transparent outline-none" />
          </Field>
          <Field label="Context">
            <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3} className="w-full resize-none bg-transparent outline-none" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Venture">
              <select value={ventureId} onChange={(e) => setVentureId(e.target.value)} className="w-full bg-transparent outline-none">
                <option value="">Organization-wide</option>
                {ventures.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as DecisionStatus)} className="w-full bg-transparent outline-none">
                {Object.entries(STATUS_LABEL).filter(([v]) => v !== "decided" && v !== "closed").map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Review date">
              <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="w-full bg-transparent outline-none" />
            </Field>
          </div>
        </div>
        <div className="mt-8 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button type="submit" disabled={create.isPending} className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
            {create.isPending ? "Creating…" : "Create decision"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-lg bg-secondary/40 px-3 py-2.5">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      {children}
    </label>
  );
}