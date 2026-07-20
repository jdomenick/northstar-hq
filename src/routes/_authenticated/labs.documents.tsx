import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus, X, ArrowUpRight, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import {
  useDocuments,
  useKnowledge,
  useUploadDocument,
  useVentures,
  type DocumentRow,
  type DocumentProcessingStatus,
} from "@/lib/data-hooks";
import { can } from "@/lib/permissions";
import { formatFileSize } from "@/lib/storage";
import { MAX_DOCUMENT_BYTES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/labs/documents")({
  component: DocumentsLayout,
  head: () => ({
    meta: [
      { title: "Documents  -  NorthStar Labs" },
      { name: "description", content: "Secure organization documents. Signed access only." },
    ],
  }),
});

function DocumentsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/labs/documents") return <Outlet />;
  return <DocumentsIndex />;
}

const STATUS_LABEL: Record<DocumentProcessingStatus, string> = {
  uploaded: "Uploaded",
  pending: "Pending",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

type SortMode = "recent" | "oldest" | "name" | "size";

function DocumentsIndex() {
  const { activeOrgId, activeMembership } = useOrg();
  const [includeArchived, setIncludeArchived] = useState(false);
  const docsQ = useDocuments(activeOrgId, { includeArchived });
  const venturesQ = useVentures(activeOrgId);
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [venture, setVenture] = useState("all");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("recent");
  const canWrite = can.writeContent(activeMembership?.role);

  const ventureMap = useMemo(
    () => new Map((venturesQ.data ?? []).map((v) => [v.id, v.name])),
    [venturesQ.data],
  );

  const filtered = useMemo(() => {
    let list = docsQ.data ?? [];
    if (venture !== "all") list = list.filter((d) => d.venture_id === venture);
    if (status !== "all") list = list.filter((d) => d.processing_status === status);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((d) =>
        [d.title, d.description ?? "", d.file_name].join(" ").toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    switch (sort) {
      case "oldest": sorted.sort((a, b) => a.created_at.localeCompare(b.created_at)); break;
      case "name": sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "size": sorted.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0)); break;
      default: sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return sorted;
  }, [docsQ.data, venture, status, query, sort]);

  return (
    <div>
      <PageHeader
        eyebrow="Documents"
        title="Files, secured to your organization."
        description="Every file is private, signed, and organization-scoped."
        actions={
          canWrite && (
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Upload document
            </button>
          )
        }
      />
      <PageBody>
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <input placeholder="Search documents…" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-[200px] flex-1 rounded-md bg-secondary/40 px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/60" />
          <Sel value={venture} onChange={setVenture} options={[{ value: "all", label: "All ventures" }, ...(venturesQ.data ?? []).map((v) => ({ value: v.id, label: v.name }))]} />
          <Sel value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))]} />
          <Sel value={sort} onChange={(v) => setSort(v as SortMode)} options={[
            { value: "recent", label: "Most recent" },
            { value: "oldest", label: "Oldest" },
            { value: "name", label: "Name" },
            { value: "size", label: "File size" },
          ]} />
          <label className="ml-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            Show archived
          </label>
        </div>

        {docsQ.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-card/30" />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13.5px] text-muted-foreground">
            {(docsQ.data ?? []).length === 0 ? "No documents yet. Upload your first file." : "No documents match these filters."}
          </div>
        ) : (
          <div className="-mx-2">
            {filtered.map((d) => (
              <DocumentRowUI key={d.id} d={d} venture={ventureMap.get(d.venture_id ?? "")} />
            ))}
          </div>
        )}
      </PageBody>

      {showNew && (
        <UploadDialog orgId={activeOrgId} ventures={venturesQ.data ?? []} onClose={() => setShowNew(false)} />
      )}
    </div>
  );
}

function DocumentRowUI({ d, venture }: { d: DocumentRow; venture?: string }) {
  const archived = !!d.deleted_at;
  return (
    <Link to="/labs/documents/$id" params={{ id: d.id }} className="group flex items-start gap-6 rounded-xl px-4 py-6 border-b border-border/60 last:border-0 hover:bg-secondary/30">
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
          {venture ?? "Organization"} · {STATUS_LABEL[d.processing_status]}{archived && " · Archived"}
        </div>
        <h3 className="mt-2.5 font-display text-[19px] leading-snug text-foreground">{d.title}</h3>
        {d.description && (<p className="mt-2 line-clamp-2 max-w-2xl text-[13.5px] leading-[1.65] text-muted-foreground">{d.description}</p>)}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
          <span>{d.file_name}</span>
          <span>· {formatFileSize(d.file_size)}</span>
          {d.file_type && <span>· {d.file_type.split("/")[1]?.toUpperCase() ?? d.file_type}</span>}
          <span>· uploaded {d.created_at.slice(0, 10)}</span>
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

export function UploadDialog({ orgId, ventures, onClose, defaultVentureId, defaultKnowledgeId }: { orgId: string | null; ventures: { id: string; name: string }[]; onClose: () => void; defaultVentureId?: string; defaultKnowledgeId?: string }) {
  const upload = useUploadDocument(orgId);
  const nav = useNavigate();
  const knowledgeQ = useKnowledge(orgId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ventureId, setVentureId] = useState(defaultVentureId ?? "");
  const [knowledgeId, setKnowledgeId] = useState(defaultKnowledgeId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Choose a file");
    if (!title.trim()) return toast.error("Title required");
    try {
      const d = await upload.mutateAsync({
        file,
        title: title.trim(),
        description: description.trim() || undefined,
        venture_id: ventureId || null,
        knowledge_record_id: knowledgeId || null,
      });
      toast.success("Uploaded");
      onClose();
      nav({ to: "/labs/documents/$id", params: { id: d.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  const knowledgeItems = (knowledgeQ.data ?? []).filter((k) => !ventureId || k.venture_id === ventureId || !k.venture_id);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="relative my-8 w-full max-w-lg rounded-2xl bg-card p-8 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        <h2 className="font-display text-[24px] text-foreground">Upload document</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Document intelligence will be activated with SAM in Phase 3.</p>
        <div className="mt-6 space-y-4 text-[13.5px]">
          <div>
            <input ref={inputRef} type="file" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "")); }} className="hidden" />
            <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center gap-3 rounded-lg bg-secondary/40 px-4 py-6 text-left hover:bg-secondary/60">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                {file ? (
                  <>
                    <div className="truncate text-foreground">{file.name}</div>
                    <div className="text-[11.5px] text-muted-foreground">{formatFileSize(file.size)}{file.type ? ` · ${file.type}` : ""}</div>
                  </>
                ) : (
                  <>
                    <div className="text-foreground">Choose a file</div>
                    <div className="text-[11.5px] text-muted-foreground">Max {Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB · PDF, DOCX, XLSX, PPTX, TXT, CSV, images</div>
                  </>
                )}
              </div>
            </button>
          </div>
          <Fld label="Title"><input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-transparent outline-none" /></Fld>
          <Fld label="Description"><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full resize-none bg-transparent outline-none" /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Venture">
              <select value={ventureId} onChange={(e) => setVentureId(e.target.value)} className="w-full bg-transparent outline-none">
                <option value="">Organization-wide</option>
                {ventures.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
              </select>
            </Fld>
            <Fld label="Related knowledge">
              <select value={knowledgeId} onChange={(e) => setKnowledgeId(e.target.value)} className="w-full bg-transparent outline-none">
                <option value="">None</option>
                {knowledgeItems.map((k) => (<option key={k.id} value={k.id}>{k.title}</option>))}
              </select>
            </Fld>
          </div>
        </div>
        <div className="mt-8 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={upload.isPending || !file} className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
            {upload.isPending ? "Uploading…" : "Upload"}
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

export { STATUS_LABEL as DOC_STATUS_LABEL };