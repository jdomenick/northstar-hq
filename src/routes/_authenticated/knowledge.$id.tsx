import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ShieldCheck, AlertTriangle, Flag, Archive, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import {
  useActorProfiles,
  useArchiveKnowledge,
  useDocuments,
  useKnowledgeRecord,
  useRestoreKnowledge,
  useSetKnowledgeVerification,
  useUpdateKnowledge,
  useVentures,
  type KnowledgeType,
  type Priority,
  type VerificationStatus,
} from "@/lib/data-hooks";
import { useOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { actorName } from "@/lib/actor-names";
import { TYPE_LABEL, VERIFY_LABEL, IMPORTANCE_LABEL } from "./knowledge";

export const Route = createFileRoute("/_authenticated/knowledge/$id")({
  component: KnowledgeDetail,
  head: () => ({ meta: [{ title: "Knowledge  -  NorthStar Labs" }] }),
});

function KnowledgeDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { activeOrgId, activeMembership } = useOrg();
  const recordQ = useKnowledgeRecord(id);
  const venturesQ = useVentures(activeOrgId);
  const docsQ = useDocuments(activeOrgId, { knowledgeRecordId: id });
  const update = useUpdateKnowledge(activeOrgId);
  const verify = useSetKnowledgeVerification(activeOrgId);
  const archive = useArchiveKnowledge(activeOrgId);
  const restore = useRestoreKnowledge(activeOrgId);
  const canWrite = can.writeContent(activeMembership?.role);
  const canArchive = can.archiveContent(activeMembership?.role);

  const r = recordQ.data;
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<{
    title: string; knowledge_type: KnowledgeType; venture_id: string; content: string;
    source: string; source_url: string; tagsStr: string; importance: Priority;
    effective_date: string; expiration_date: string;
  } | null>(null);

  useEffect(() => {
    if (!r) return;
    setForm({
      title: r.title,
      knowledge_type: r.knowledge_type,
      venture_id: r.venture_id ?? "",
      content: r.content ?? "",
      source: r.source ?? "",
      source_url: r.source_url ?? "",
      tagsStr: (r.tags ?? []).join(", "),
      importance: r.importance,
      effective_date: r.effective_date ?? "",
      expiration_date: r.expiration_date ?? "",
    });
  }, [r]);

  const actorIds = useMemo(() => [r?.created_by, r?.verified_by], [r?.created_by, r?.verified_by]);
  const profilesQ = useActorProfiles(actorIds);
  const profiles = profilesQ.data ?? new Map();

  const ventureName = useMemo(
    () => (venturesQ.data ?? []).find((v) => v.id === r?.venture_id)?.name ?? "Organization",
    [venturesQ.data, r?.venture_id],
  );

  const today = new Date().toISOString().slice(0, 10);
  const expired = r?.expiration_date && r.expiration_date < today;

  async function save() {
    if (!r || !form) return;
    const tags = form.tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    const materialWillChange =
      form.title !== r.title ||
      form.knowledge_type !== r.knowledge_type ||
      (form.venture_id || null) !== r.venture_id ||
      form.content !== (r.content ?? "") ||
      form.source !== (r.source ?? "") ||
      form.source_url !== (r.source_url ?? "") ||
      (form.effective_date || null) !== r.effective_date ||
      (form.expiration_date || null) !== r.expiration_date;
    if (materialWillChange && r.verification_status === "verified") {
      if (!confirm("This is a material edit. Verification will be reset. Continue?")) return;
    }
    try {
      await update.mutateAsync({
        id: r.id,
        prev: r,
        patch: {
          title: form.title,
          knowledge_type: form.knowledge_type,
          venture_id: form.venture_id || null,
          content: form.content || null,
          source: form.source || null,
          source_url: form.source_url || null,
          tags,
          importance: form.importance,
          effective_date: form.effective_date || null,
          expiration_date: form.expiration_date || null,
        },
      });
      toast.success("Saved");
      setEdit(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function setStatus(status: VerificationStatus, needNote = false) {
    if (!r) return;
    let note: string | undefined;
    if (needNote) {
      const input = prompt(`Reason for marking ${status}?`);
      if (input === null) return;
      note = input.trim() || undefined;
    }
    try {
      await verify.mutateAsync({ id: r.id, status, note });
      toast.success("Updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
        <div className="mx-auto max-w-4xl">
          <Link to="/knowledge" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Knowledge
          </Link>
        </div>
      </div>
      {recordQ.isLoading ? (
        <PageBody><div className="h-40 animate-pulse rounded-2xl bg-card/30" /></PageBody>
      ) : !r || !form ? (
        <PageBody><p className="text-muted-foreground">Record not found.</p></PageBody>
      ) : (
        <>
          <PageHeader
            eyebrow={`${TYPE_LABEL[r.knowledge_type]} · ${ventureName} · ${VERIFY_LABEL[r.verification_status]}${expired ? " · Expired" : ""}${r.deleted_at ? " · Archived" : ""}`}
            title={r.title}
            description={IMPORTANCE_LABEL[r.importance] + " importance"}
            actions={canWrite && !r.deleted_at && (
              <div className="flex items-center gap-2">
                {!edit ? (
                  <>
                    {r.verification_status !== "verified" && (
                      <button onClick={() => setStatus("verified")} className="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-[12.5px] hover:bg-secondary">
                        <ShieldCheck className="h-3.5 w-3.5" /> Verify
                      </button>
                    )}
                    <button onClick={() => setStatus("outdated", true)} className="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-[12.5px] hover:bg-secondary">
                      <AlertTriangle className="h-3.5 w-3.5" /> Mark outdated
                    </button>
                    <button onClick={() => setStatus("disputed", true)} className="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-[12.5px] hover:bg-secondary">
                      <Flag className="h-3.5 w-3.5" /> Dispute
                    </button>
                    <button onClick={() => setEdit(true)} className="rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90">Edit</button>
                    {canArchive && (
                      <button onClick={() => { if (confirm("Archive this record?")) archive.mutate({ id: r.id, title: r.title, venture_id: r.venture_id }); }} className="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-[12.5px] hover:bg-secondary">
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => setEdit(false)} className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button>
                    <button onClick={save} disabled={update.isPending} className="rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
                      {update.isPending ? "Saving…" : "Save"}
                    </button>
                  </>
                )}
              </div>
            )}
          />
          <PageBody>
            {r.deleted_at && canArchive && (
              <div className="mb-6 flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-3 text-[13px]">
                <span className="text-muted-foreground">Archived on {r.deleted_at.slice(0, 10)}</span>
                <button onClick={() => restore.mutate({ id: r.id, title: r.title, venture_id: r.venture_id })} className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground hover:opacity-80">
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </button>
              </div>
            )}
            {!edit ? (
              <>
                <Section title="Content">
                  {r.content ? (
                    <p className="whitespace-pre-wrap text-[14.5px] leading-[1.75] text-foreground/90">{r.content}</p>
                  ) : (
                    <p className="text-[13.5px] text-muted-foreground">No content.</p>
                  )}
                </Section>
                <Section title="Details">
                  <div className="grid grid-cols-2 gap-6 text-[13.5px]">
                    <Row label="Source" value={r.source ?? " - "} />
                    <Row label="Source URL" value={r.source_url ? <a href={r.source_url} className="text-foreground underline" target="_blank" rel="noreferrer">{r.source_url}</a> : " - "} />
                    <Row label="Tags" value={(r.tags ?? []).length ? (r.tags ?? []).map((t) => `#${t}`).join("  ") : " - "} />
                    <Row label="Effective date" value={r.effective_date ?? " - "} />
                    <Row label="Expiration date" value={r.expiration_date ?? " - "} />
                    <Row label="Created by" value={actorName(profiles.get(r.created_by ?? ""))} />
                    <Row label="Created" value={r.created_at.slice(0, 10)} />
                    <Row label="Updated" value={r.updated_at.slice(0, 10)} />
                    <Row label="Verified by" value={r.verified_by ? actorName(profiles.get(r.verified_by)) : " - "} />
                    <Row label="Verified at" value={r.verified_at ? r.verified_at.slice(0, 10) : " - "} />
                  </div>
                </Section>
                <Section title="Related documents">
                  {docsQ.isLoading ? (
                    <div className="h-16 animate-pulse rounded-lg bg-card/30" />
                  ) : (docsQ.data ?? []).length === 0 ? (
                    <p className="text-[13.5px] text-muted-foreground">No documents linked yet. Attach one from the Documents screen.</p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {(docsQ.data ?? []).map((d) => (
                        <li key={d.id} className="flex items-center justify-between py-3">
                          <Link to="/documents/$id" params={{ id: d.id }} className="text-[14px] hover:underline">{d.title}</Link>
                          <span className="text-[11.5px] text-muted-foreground">{d.file_type ?? d.file_name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </>
            ) : (
              <div className="space-y-4 text-[13.5px]">
                <Fld label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-transparent outline-none" /></Fld>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Type">
                    <select value={form.knowledge_type} onChange={(e) => setForm({ ...form, knowledge_type: e.target.value as KnowledgeType })} className="w-full bg-transparent outline-none">
                      {Object.entries(TYPE_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                    </select>
                  </Fld>
                  <Fld label="Venture">
                    <select value={form.venture_id} onChange={(e) => setForm({ ...form, venture_id: e.target.value })} className="w-full bg-transparent outline-none">
                      <option value="">Organization-wide</option>
                      {(venturesQ.data ?? []).map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                    </select>
                  </Fld>
                </div>
                <Fld label="Content"><textarea rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full resize-y bg-transparent outline-none" /></Fld>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Source"><input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full bg-transparent outline-none" /></Fld>
                  <Fld label="Source URL"><input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://" className="w-full bg-transparent outline-none" /></Fld>
                  <Fld label="Tags"><input value={form.tagsStr} onChange={(e) => setForm({ ...form, tagsStr: e.target.value })} className="w-full bg-transparent outline-none" /></Fld>
                  <Fld label="Importance">
                    <select value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value as Priority })} className="w-full bg-transparent outline-none">
                      {Object.entries(IMPORTANCE_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                    </select>
                  </Fld>
                  <Fld label="Effective date"><input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} className="w-full bg-transparent outline-none" /></Fld>
                  <Fld label="Expiration date"><input type="date" value={form.expiration_date} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} className="w-full bg-transparent outline-none" /></Fld>
                </div>
                {r.verification_status === "verified" && (
                  <p className="text-[12px] text-muted-foreground">Material edits (title, type, venture, content, source, dates) will reset verification.</p>
                )}
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