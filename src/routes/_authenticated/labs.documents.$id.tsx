import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Archive, RotateCcw, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import {
  useActorProfiles,
  useArchiveDocument,
  useDocument,
  useKnowledge,
  useRestoreDocument,
  useUpdateDocument,
  useVentures,
} from "@/lib/data-hooks";
import { useOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { actorName } from "@/lib/actor-names";
import { createSignedDocumentUrl, formatFileSize } from "@/lib/storage";
import { DOC_STATUS_LABEL } from "./documents";

export const Route = createFileRoute("/_authenticated/labs/documents/$id")({
  component: DocumentDetail,
  head: () => ({ meta: [{ title: "Document  -  NorthStar Labs" }] }),
});

function DocumentDetail() {
  const { id } = Route.useParams();
  const { activeOrgId, activeMembership } = useOrg();
  const docQ = useDocument(id);
  const venturesQ = useVentures(activeOrgId);
  const knowledgeQ = useKnowledge(activeOrgId);
  const update = useUpdateDocument(activeOrgId);
  const archive = useArchiveDocument(activeOrgId);
  const restore = useRestoreDocument(activeOrgId);
  const canWrite = can.writeContent(activeMembership?.role);
  const canArchive = can.archiveContent(activeMembership?.role);

  const d = docQ.data;
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; venture_id: string; knowledge_record_id: string } | null>(null);

  useEffect(() => {
    if (!d) return;
    setForm({
      title: d.title,
      description: d.description ?? "",
      venture_id: d.venture_id ?? "",
      knowledge_record_id: d.knowledge_record_id ?? "",
    });
  }, [d]);

  const actorIds = useMemo(() => [d?.uploaded_by], [d?.uploaded_by]);
  const profilesQ = useActorProfiles(actorIds);
  const profiles = profilesQ.data ?? new Map();

  const ventureName = useMemo(() => (venturesQ.data ?? []).find((v) => v.id === d?.venture_id)?.name ?? "Organization", [venturesQ.data, d?.venture_id]);
  const relatedKnowledge = useMemo(() => (knowledgeQ.data ?? []).find((k) => k.id === d?.knowledge_record_id), [knowledgeQ.data, d?.knowledge_record_id]);

  async function download() {
    if (!d) return;
    try {
      const url = await createSignedDocumentUrl(d.file_path, 60);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create download link");
    }
  }

  async function save() {
    if (!d || !form) return;
    try {
      await update.mutateAsync({
        id: d.id,
        patch: {
          title: form.title,
          description: form.description || null,
          venture_id: form.venture_id || null,
          knowledge_record_id: form.knowledge_record_id || null,
        },
      });
      toast.success("Saved");
      setEdit(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
        <div className="mx-auto max-w-4xl">
          <Link to="/documents" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Documents
          </Link>
        </div>
      </div>
      {docQ.isLoading ? (
        <PageBody><div className="h-40 animate-pulse rounded-2xl bg-card/30" /></PageBody>
      ) : !d || !form ? (
        <PageBody><p className="text-muted-foreground">Document not found.</p></PageBody>
      ) : (
        <>
          <PageHeader
            eyebrow={`${ventureName} · ${DOC_STATUS_LABEL[d.processing_status]}${d.deleted_at ? " · Archived" : ""}`}
            title={d.title}
            description={d.description ?? undefined}
            actions={(
              <div className="flex items-center gap-2">
                <button onClick={download} className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90">
                  <Download className="h-3.5 w-3.5" /> Secure download
                </button>
                {canWrite && !d.deleted_at && !edit && (
                  <button onClick={() => setEdit(true)} className="rounded-md bg-secondary/60 px-3 py-2 text-[12.5px] hover:bg-secondary">Edit</button>
                )}
                {edit && (
                  <>
                    <button onClick={() => setEdit(false)} className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button>
                    <button onClick={save} disabled={update.isPending} className="rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
                      {update.isPending ? "Saving…" : "Save"}
                    </button>
                  </>
                )}
                {canArchive && !d.deleted_at && !edit && (
                  <button onClick={() => { if (confirm("Archive this document? The file will remain in storage.")) archive.mutate({ id: d.id, title: d.title, venture_id: d.venture_id }); }} className="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-[12.5px] hover:bg-secondary">
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </button>
                )}
              </div>
            )}
          />
          <PageBody>
            {d.deleted_at && canArchive && (
              <div className="mb-6 flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-3 text-[13px]">
                <span className="text-muted-foreground">Archived on {d.deleted_at.slice(0, 10)}</span>
                <button onClick={() => restore.mutate({ id: d.id, title: d.title, venture_id: d.venture_id })} className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground hover:opacity-80">
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </button>
              </div>
            )}
            {!edit ? (
              <>
                <Section title="File">
                  <div className="grid grid-cols-2 gap-6 text-[13.5px]">
                    <Row label="Name" value={d.file_name} />
                    <Row label="Type" value={d.file_type ?? " - "} />
                    <Row label="Size" value={formatFileSize(d.file_size)} />
                    <Row label="Status" value={DOC_STATUS_LABEL[d.processing_status]} />
                    <Row label="Uploaded by" value={actorName(profiles.get(d.uploaded_by ?? ""))} />
                    <Row label="Uploaded" value={d.created_at.slice(0, 10)} />
                  </div>
                </Section>
                {relatedKnowledge && (
                  <Section title="Related knowledge">
                    <Link to="/knowledge/$id" params={{ id: relatedKnowledge.id }} className="text-[14px] hover:underline">{relatedKnowledge.title}</Link>
                  </Section>
                )}
              </>
            ) : (
              <div className="space-y-4 text-[13.5px]">
                <Fld label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-transparent outline-none" /></Fld>
                <Fld label="Description"><textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full resize-none bg-transparent outline-none" /></Fld>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Venture">
                    <select value={form.venture_id} onChange={(e) => setForm({ ...form, venture_id: e.target.value })} className="w-full bg-transparent outline-none">
                      <option value="">Organization-wide</option>
                      {(venturesQ.data ?? []).map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                    </select>
                  </Fld>
                  <Fld label="Related knowledge">
                    <select value={form.knowledge_record_id} onChange={(e) => setForm({ ...form, knowledge_record_id: e.target.value })} className="w-full bg-transparent outline-none">
                      <option value="">None</option>
                      {(knowledgeQ.data ?? []).map((k) => (<option key={k.id} value={k.id}>{k.title}</option>))}
                    </select>
                  </Fld>
                </div>
              </div>
            )}
          </PageBody>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
      <div className="mt-1 text-foreground">{value}</div>
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