import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus, X, ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import {
  useCreateKnowledge,
  useKnowledge,
  useVentures,
  type KnowledgeRecord,
  type KnowledgeType,
  type VerificationStatus,
  type Priority,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/knowledge")({
  component: KnowledgeLayout,
  head: () => ({
    meta: [
      { title: "Knowledge  -  Northstar" },
      { name: "description", content: "Playbooks, notes, decisions, and verified truths across every venture." },
    ],
  }),
});

function KnowledgeLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/knowledge") return <Outlet />;
  return <KnowledgeIndex />;
}

const TYPE_LABEL: Record<KnowledgeType, string> = {
  founder_profile: "Founder profile",
  venture_knowledge: "Venture knowledge",
  person: "Person",
  policy: "Policy",
  brand_guideline: "Brand guideline",
  strategy: "Strategy",
  research: "Research",
  meeting_note: "Meeting note",
  conversation_summary: "Conversation summary",
  operating_procedure: "Operating procedure",
  general: "General",
};

const VERIFY_LABEL: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  verified: "Verified",
  outdated: "Outdated",
  disputed: "Disputed",
};

const IMPORTANCE_LABEL: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

type SortMode = "updated" | "oldest" | "title" | "importance";

function KnowledgeIndex() {
  const { activeOrgId, activeMembership } = useOrg();
  const [includeArchived, setIncludeArchived] = useState(false);
  const knowledgeQ = useKnowledge(activeOrgId, { includeArchived });
  const venturesQ = useVentures(activeOrgId);
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [venture, setVenture] = useState("all");
  const [type, setType] = useState<string>("all");
  const [importance, setImportance] = useState<string>("all");
  const [verify, setVerify] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("updated");
  const canWrite = can.writeContent(activeMembership?.role);

  const ventureMap = useMemo(
    () => new Map((venturesQ.data ?? []).map((v) => [v.id, v.name])),
    [venturesQ.data],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of knowledgeQ.data ?? []) for (const t of r.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [knowledgeQ.data]);

  const IMP_RANK: Record<Priority, number> = { critical: 3, high: 2, normal: 1, low: 0 };

  const filtered = useMemo(() => {
    let list = knowledgeQ.data ?? [];
    if (venture !== "all") list = list.filter((r) => r.venture_id === venture);
    if (type !== "all") list = list.filter((r) => r.knowledge_type === type);
    if (importance !== "all") list = list.filter((r) => r.importance === importance);
    if (verify !== "all") {
      if (verify === "expired") {
        const today = new Date().toISOString().slice(0, 10);
        list = list.filter((r) => r.expiration_date && r.expiration_date < today);
      } else {
        list = list.filter((r) => r.verification_status === verify);
      }
    }
    if (tag !== "all") list = list.filter((r) => (r.tags ?? []).includes(tag));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) =>
        [r.title, r.content ?? "", r.source ?? "", (r.tags ?? []).join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    const sorted = [...list];
    switch (sort) {
      case "oldest":
        sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "importance":
        sorted.sort((a, b) => IMP_RANK[b.importance] - IMP_RANK[a.importance]);
        break;
      default:
        sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    return sorted;
  }, [knowledgeQ.data, venture, type, importance, verify, tag, query, sort]);

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge"
        title="Everything you've written, decided, or learned."
        description="A single verified library across every venture."
        actions={
          canWrite && (
            <button
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> New knowledge
            </button>
          )
        }
      />
      <PageBody>
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <input
            placeholder="Search knowledge…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[200px] flex-1 rounded-md bg-secondary/40 px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
          <Sel value={venture} onChange={setVenture} options={[
            { value: "all", label: "All ventures" },
            ...(venturesQ.data ?? []).map((v) => ({ value: v.id, label: v.name })),
          ]} />
          <Sel value={type} onChange={setType} options={[
            { value: "all", label: "All types" },
            ...Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })),
          ]} />
          <Sel value={importance} onChange={setImportance} options={[
            { value: "all", label: "All importance" },
            ...Object.entries(IMPORTANCE_LABEL).map(([v, l]) => ({ value: v, label: l })),
          ]} />
          <Sel value={verify} onChange={setVerify} options={[
            { value: "all", label: "All statuses" },
            ...Object.entries(VERIFY_LABEL).map(([v, l]) => ({ value: v, label: l })),
            { value: "expired", label: "Expired" },
          ]} />
          {allTags.length > 0 && (
            <Sel value={tag} onChange={setTag} options={[
              { value: "all", label: "All tags" },
              ...allTags.map((t) => ({ value: t, label: `#${t}` })),
            ]} />
          )}
          <Sel value={sort} onChange={(v) => setSort(v as SortMode)} options={[
            { value: "updated", label: "Recently updated" },
            { value: "oldest", label: "Oldest" },
            { value: "title", label: "Title" },
            { value: "importance", label: "Importance" },
          ]} />
          <label className="ml-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            Show archived
          </label>
        </div>

        {knowledgeQ.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-card/30" />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13.5px] text-muted-foreground">
            {(knowledgeQ.data ?? []).length === 0
              ? "No knowledge yet. Add your first record."
              : "No records match these filters."}
          </div>
        ) : (
          <div className="-mx-2">
            {filtered.map((r) => (
              <KnowledgeRow key={r.id} r={r} venture={ventureMap.get(r.venture_id ?? "")} />
            ))}
          </div>
        )}
      </PageBody>

      {showNew && (
        <NewKnowledgeDialog orgId={activeOrgId} ventures={venturesQ.data ?? []} onClose={() => setShowNew(false)} />
      )}
    </div>
  );
}

function KnowledgeRow({ r, venture }: { r: KnowledgeRecord; venture?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const expired = r.expiration_date && r.expiration_date < today;
  const archived = !!r.deleted_at;
  return (
    <Link
      to="/knowledge/$id"
      params={{ id: r.id }}
      className="group flex items-start gap-6 rounded-xl px-4 py-6 border-b border-border/60 last:border-0 hover:bg-secondary/30"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
          {TYPE_LABEL[r.knowledge_type]} · {venture ?? "Organization"} · {VERIFY_LABEL[r.verification_status]}
          {r.importance !== "normal" && ` · ${IMPORTANCE_LABEL[r.importance]}`}
          {expired && " · Expired"}
          {archived && " · Archived"}
        </div>
        <h3 className="mt-2.5 font-display text-[19px] leading-snug text-foreground">{r.title}</h3>
        {r.content && (
          <p className="mt-2 line-clamp-2 max-w-2xl text-[13.5px] leading-[1.65] text-muted-foreground">
            {r.content}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
          {(r.tags ?? []).slice(0, 6).map((t) => (
            <span key={t} className="rounded-full bg-secondary/50 px-2 py-0.5">#{t}</span>
          ))}
          {r.source && <span>· {r.source}</span>}
          <span className="tabular-nums">· updated {r.updated_at.slice(0, 10)}</span>
        </div>
      </div>
      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md bg-secondary/40 px-2.5 py-2 text-[12.5px] outline-none hover:bg-secondary/60">
      {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

function NewKnowledgeDialog({ orgId, ventures, onClose, defaultVentureId }: { orgId: string | null; ventures: { id: string; name: string }[]; onClose: () => void; defaultVentureId?: string }) {
  const create = useCreateKnowledge(orgId);
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<KnowledgeType>("general");
  const [ventureId, setVentureId] = useState<string>(defaultVentureId ?? "");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [importance, setImportance] = useState<Priority>("normal");
  const [effective, setEffective] = useState("");
  const [expiration, setExpiration] = useState("");
  const [dirty, setDirty] = useState(false);

  const onText = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDirty(true);
    fn(e.target.value);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title required");
    if (!content.trim()) return toast.error("Content required");
    try {
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      const r = await create.mutateAsync({
        title: title.trim(),
        knowledge_type: type,
        content: content.trim(),
        venture_id: ventureId || null,
        source: source.trim() || undefined,
        source_url: sourceUrl.trim() || undefined,
        tags,
        importance,
        effective_date: effective || null,
        expiration_date: expiration || null,
      });
      toast.success("Knowledge created");
      onClose();
      nav({ to: "/knowledge/$id", params: { id: r.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  function handleClose() {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="relative my-8 w-full max-w-2xl rounded-2xl bg-card p-8 shadow-2xl">
        <button type="button" onClick={handleClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-display text-[24px] text-foreground">New knowledge</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">A durable record  -  verified truth over time.</p>
        <div className="mt-6 space-y-4 text-[13.5px]">
          <Fld label="Title">
            <input required autoFocus value={title} onChange={(e) => { setDirty(true); setTitle(e.target.value); }} className="w-full bg-transparent outline-none" />
          </Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Type">
              <select value={type} onChange={(e) => { setDirty(true); setType(e.target.value as KnowledgeType); }} className="w-full bg-transparent outline-none">
                {Object.entries(TYPE_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
              </select>
            </Fld>
            <Fld label="Venture">
              <select value={ventureId} onChange={(e) => { setDirty(true); setVentureId(e.target.value); }} className="w-full bg-transparent outline-none">
                <option value="">Organization-wide</option>
                {ventures.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
              </select>
            </Fld>
          </div>
          <Fld label="Content">
            <textarea value={content} onChange={(e) => { setDirty(true); setContent(e.target.value); }} rows={8} className="w-full resize-y bg-transparent outline-none" placeholder="Write the knowledge itself  -  facts, guidelines, context…" />
          </Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Source">
              <input value={source} onChange={onText(setSource)} className="w-full bg-transparent outline-none" />
            </Fld>
            <Fld label="Source URL">
              <input value={sourceUrl} onChange={onText(setSourceUrl)} placeholder="https://" className="w-full bg-transparent outline-none" />
            </Fld>
            <Fld label="Tags (comma-separated)">
              <input value={tagsStr} onChange={onText(setTagsStr)} className="w-full bg-transparent outline-none" />
            </Fld>
            <Fld label="Importance">
              <select value={importance} onChange={(e) => { setDirty(true); setImportance(e.target.value as Priority); }} className="w-full bg-transparent outline-none">
                {Object.entries(IMPORTANCE_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
              </select>
            </Fld>
            <Fld label="Effective date">
              <input type="date" value={effective} onChange={onText(setEffective)} className="w-full bg-transparent outline-none" />
            </Fld>
            <Fld label="Expiration date">
              <input type="date" value={expiration} onChange={onText(setExpiration)} className="w-full bg-transparent outline-none" />
            </Fld>
          </div>
        </div>
        <div className="mt-8 flex items-center justify-end gap-2">
          <button type="button" onClick={handleClose} className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={create.isPending} className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
            {create.isPending ? "Creating…" : "Create knowledge"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-lg bg-secondary/40 px-3 py-2.5">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      {children}
    </label>
  );
}

export { NewKnowledgeDialog, TYPE_LABEL, VERIFY_LABEL, IMPORTANCE_LABEL };