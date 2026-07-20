import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useActorProfiles,
  useArchiveVenture,
  useCommitments,
  useDecisions,
  useDocuments,
  useGoals,
  useKnowledge,
  useProjects,
  useUpdateVenture,
  useVenture,
  useVentureActivity,
  type ActivityEvent,
  type Priority,
  type Venture,
} from "@/lib/data-hooks";
import { useOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { actorName } from "@/lib/actor-names";
import { formatFileSize } from "@/lib/storage";
import { NewKnowledgeDialog, TYPE_LABEL, VERIFY_LABEL } from "./knowledge";
import { UploadDialog, DOC_STATUS_LABEL } from "./documents";
import {
  goalProgressPct,
  isCommitmentOverdue,
  isGoalAtRisk,
  isDecisionWaiting,
  isProjectStalled,
} from "@/lib/accountability";

export const Route = createFileRoute("/_authenticated/labs/ventures/$id")({
  component: VentureDetail,
  head: () => ({ meta: [{ title: "Venture  -  NorthStar Labs" }] }),
});

function VentureDetail() {
  const { id } = Route.useParams();
  const { data: v, isLoading, error } = useVenture(id);
  const { activeOrgId, activeMembership } = useOrg();
  const projectsQ = useProjects(activeOrgId);
  const goalsQ = useGoals(activeOrgId);
  const decisionsQ = useDecisions(activeOrgId);
  const commitmentsQ = useCommitments(activeOrgId);
  const knowledgeQ = useKnowledge(activeOrgId, { ventureId: id });
  const docsQ = useDocuments(activeOrgId, { ventureId: id });
  const activityQ = useVentureActivity(activeOrgId, id, 40);
  const canWrite = can.writeContent(activeMembership?.role);
  const [showNewKnowledge, setShowNewKnowledge] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const projects = (projectsQ.data ?? []).filter((p) => p.venture_id === id);
  const goals = (goalsQ.data ?? []).filter((g) => g.venture_id === id);
  const decisions = (decisionsQ.data ?? []).filter((d) => d.venture_id === id);
  const commitments = (commitmentsQ.data ?? []).filter((c) => c.venture_id === id);
  const knowledge = knowledgeQ.data ?? [];
  const docs = docsQ.data ?? [];
  const activity = activityQ.data ?? [];

  const activeProjects = projects.filter((p) => p.status !== "archived" && p.status !== "completed" && !p.deleted_at);
  const atRiskProjects = projects.filter((p) => p.status === "at_risk" || p.status === "blocked" || isProjectStalled(p));
  const activeGoals = goals.filter((g) => g.status === "active");
  const goalsRisk = goals.filter(isGoalAtRisk);
  const decisionsWaiting = decisions.filter((d) => isDecisionWaiting(d, null));
  const openCommitments = commitments.filter((c) => c.status !== "completed" && c.status !== "canceled");
  const overdueCommitments = commitments.filter(isCommitmentOverdue);

  const actorProfilesQ = useActorProfiles(activity.map((a) => a.actor_user_id));
  const actorProfiles = actorProfilesQ.data ?? new Map();

  return (
    <div>
      <div className="px-6 pt-10 md:px-14">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/ventures"
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Ventures
          </Link>
        </div>
      </div>

      {isLoading ? (
        <PageBody>
          <div className="h-40 animate-pulse rounded-2xl bg-card/30" />
        </PageBody>
      ) : error ? (
        <PageBody>
          <p className="text-muted-foreground">Couldn't load this venture.</p>
        </PageBody>
      ) : !v ? (
        <PageBody>
          <p className="text-muted-foreground">Venture not found.</p>
        </PageBody>
      ) : (
        <>
          <PageHeader
            eyebrow={v.status.replaceAll("_", " ")}
            title={v.name}
            description={v.description ?? undefined}
          />
          <PageBody>
            <Tabs defaultValue="overview">
              <TabsList className="mb-12 -mx-2 h-auto flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0">
                {[
                  "overview",
                  "projects",
                  "goals",
                  "decisions",
                  "commitments",
                  "knowledge",
                  "documents",
                  "activity",
                  "settings",
                ].map((t) => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    className="relative rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[12.5px] capitalize text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-10">
                <Section title="At a glance">
                  <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                    <Stat label="Active projects" value={activeProjects.length} />
                    <Stat label="At-risk projects" value={atRiskProjects.length} />
                    <Stat label="Active goals" value={activeGoals.length} />
                    <Stat label="At-risk goals" value={goalsRisk.length} />
                    <Stat label="Waiting decisions" value={decisionsWaiting.length} />
                    <Stat label="Open commitments" value={openCommitments.length} />
                    <Stat label="Overdue commitments" value={overdueCommitments.length} />
                    <Stat label="Knowledge records" value={knowledge.length} />
                    <Stat label="Documents" value={docs.length} />
                  </div>
                </Section>
                {v.current_focus && (
                  <Section title="Current focus">
                    <p className="text-[15px] text-foreground/90">{v.current_focus}</p>
                  </Section>
                )}
                {v.mission && (
                  <Section title="Mission">
                    <p className="text-[14.5px] text-foreground/90">{v.mission}</p>
                  </Section>
                )}
                <Section title="Recent activity">
                  <ActivityList events={activity.slice(0, 8)} profiles={actorProfiles} />
                </Section>
              </TabsContent>

              <TabsContent value="projects">
                <SimpleList items={projects.map((p) => ({ id: p.id, title: p.name, sub: p.status.replaceAll("_", " "), to: "/projects/$id" as const }))} empty="No projects yet." />
              </TabsContent>
              <TabsContent value="goals">
                <SimpleList items={goals.map((g) => {
                  const pct = goalProgressPct(g);
                  return { id: g.id, title: g.title, sub: `${g.status.replaceAll("_"," ")}${pct != null ? ` · ${pct}%` : ""}`, to: "/goals/$id" as const };
                })} empty="No goals yet." />
              </TabsContent>
              <TabsContent value="decisions">
                <SimpleList items={decisions.map((d) => ({ id: d.id, title: d.title, sub: d.status.replaceAll("_"," "), to: "/decisions/$id" as const }))} empty="No decisions yet." />
              </TabsContent>
              <TabsContent value="commitments">
                <SimpleList items={commitments.map((c) => ({ id: c.id, title: c.title, sub: (isCommitmentOverdue(c) ? "Overdue" : c.status.replaceAll("_"," ")) + (c.due_date ? ` · due ${c.due_date}` : ""), to: "/commitments/$id" as const }))} empty="No commitments yet." />
              </TabsContent>
              <TabsContent value="knowledge" className="space-y-4">
                {canWrite && (
                  <div className="flex justify-end">
                    <button onClick={() => setShowNewKnowledge(true)} className="rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90">New knowledge</button>
                  </div>
                )}
                {knowledge.length === 0 ? (
                  <p className="text-[13.5px] text-muted-foreground">No knowledge for this venture yet.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {knowledge.map((k) => (
                      <li key={k.id} className="py-4">
                        <Link to="/knowledge/$id" params={{ id: k.id }} className="text-[14px] hover:underline">{k.title}</Link>
                        <div className="text-[11.5px] text-muted-foreground">
                          {TYPE_LABEL[k.knowledge_type]} · {VERIFY_LABEL[k.verification_status]}
                          {(k.tags ?? []).length ? " · " + (k.tags ?? []).map((t) => `#${t}`).join(" ") : ""}
                          {" · updated "}{k.updated_at.slice(0,10)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="documents" className="space-y-4">
                {canWrite && (
                  <div className="flex justify-end">
                    <button onClick={() => setShowUpload(true)} className="rounded-md bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-background hover:opacity-90">Upload document</button>
                  </div>
                )}
                {docs.length === 0 ? (
                  <p className="text-[13.5px] text-muted-foreground">No documents for this venture yet.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {docs.map((d) => (
                      <li key={d.id} className="py-4">
                        <Link to="/documents/$id" params={{ id: d.id }} className="text-[14px] hover:underline">{d.title}</Link>
                        <div className="text-[11.5px] text-muted-foreground">
                          {d.file_name} · {formatFileSize(d.file_size)} · {DOC_STATUS_LABEL[d.processing_status]} · {d.created_at.slice(0,10)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="activity">
                <ActivityList events={activity} profiles={actorProfiles} />
              </TabsContent>
              <TabsContent value="settings">
                <VentureSettings ventureId={v.id} initial={v} />
              </TabsContent>
            </Tabs>
          </PageBody>
        </>
      )}
      {showNewKnowledge && v && (
        <NewKnowledgeDialog orgId={activeOrgId} ventures={[{ id, name: v.name }]} defaultVentureId={id} onClose={() => setShowNewKnowledge(false)} />
      )}
      {showUpload && v && (
        <UploadDialog orgId={activeOrgId} ventures={[{ id, name: v.name }]} defaultVentureId={id} onClose={() => setShowUpload(false)} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-[28px] leading-none tabular-nums text-foreground">{value}</div>
      <div className="mt-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/80">{label}</div>
    </div>
  );
}

type LinkTo = "/projects/$id" | "/goals/$id" | "/decisions/$id" | "/commitments/$id";
function SimpleList({ items, empty }: { items: { id: string; title: string; sub: string; to: LinkTo }[]; empty: string }) {
  if (items.length === 0) return <p className="text-[13.5px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border/60">
      {items.map((it) => (
        <li key={it.id} className="py-4">
          <Link to={it.to} params={{ id: it.id }} className="text-[14px] text-foreground hover:underline">{it.title}</Link>
          <div className="text-[12px] text-muted-foreground">{it.sub}</div>
        </li>
      ))}
    </ul>
  );
}

function ActivityList({
  events,
  profiles,
}: {
  events: ActivityEvent[];
  profiles: Map<string, { preferred_name: string | null; full_name: string | null; email: string | null }>;
}) {
  if (events.length === 0) return <p className="text-[13.5px] text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {events.map((e) => (
        <li key={e.id} className="py-3 text-[13px]">
          <span className="text-foreground">{e.summary ?? e.action}</span>
          <span className="ml-2 text-[11.5px] text-muted-foreground">
            · {actorName(profiles.get(e.actor_user_id ?? ""))} · {new Date(e.created_at).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function VentureSettings({ ventureId, initial }: { ventureId: string; initial: Venture }) {
  const { activeOrgId, activeMembership } = useOrg();
  const update = useUpdateVenture(activeOrgId);
  const archive = useArchiveVenture(activeOrgId);
  const canWrite = can.writeContent(activeMembership?.role);
  const canArchive = can.archiveContent(activeMembership?.role);
  const [form, setForm] = useState({
    name: initial.name,
    slug: initial.slug ?? "",
    description: initial.description ?? "",
    mission: initial.mission ?? "",
    business_model: initial.business_model ?? "",
    audience: initial.audience ?? "",
    website_url: initial.website_url ?? "",
    logo_url: initial.logo_url ?? "",
    status: initial.status as string,
    priority: initial.priority as Priority,
    current_focus: initial.current_focus ?? "",
  });

  useEffect(() => {
    setForm({
      name: initial.name,
      slug: initial.slug ?? "",
      description: initial.description ?? "",
      mission: initial.mission ?? "",
      business_model: initial.business_model ?? "",
      audience: initial.audience ?? "",
      website_url: initial.website_url ?? "",
      logo_url: initial.logo_url ?? "",
      status: initial.status as string,
      priority: initial.priority as Priority,
      current_focus: initial.current_focus ?? "",
    });
  }, [initial]);

  async function save() {
    try {
      await update.mutateAsync({
        id: ventureId,
        patch: {
          name: form.name,
          slug: form.slug || null,
          description: form.description || null,
          mission: form.mission || null,
          business_model: form.business_model || null,
          audience: form.audience || null,
          website_url: form.website_url || null,
          logo_url: form.logo_url || null,
          status: form.status as Venture["status"],
          priority: form.priority,
          current_focus: form.current_focus || null,
        },
      });
      toast.success("Venture saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      if (msg.includes("ventures_organization_id_slug_key") || msg.toLowerCase().includes("duplicate")) toast.error("That slug is already used in this organization.");
      else if (msg.toLowerCase().includes("invalid slug")) toast.error("Slug must use lowercase letters, digits, and hyphens.");
      else toast.error(msg);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {!canWrite && <p className="text-[12.5px] text-muted-foreground">You have read-only access.</p>}
      <div className="grid grid-cols-2 gap-3 text-[13.5px]">
        <Fld label="Name"><input disabled={!canWrite} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
        <Fld label="Slug"><input disabled={!canWrite} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
        <Fld label="Website"><input disabled={!canWrite} value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://" className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
        <Fld label="Logo URL"><input disabled={!canWrite} value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://" className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
        <Fld label="Status">
          <select disabled={!canWrite} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-transparent outline-none disabled:opacity-70">
            {["idea","active","paused","at_risk","closed","archived"].map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </Fld>
        <Fld label="Priority">
          <select disabled={!canWrite} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} className="w-full bg-transparent outline-none disabled:opacity-70">
            {["low","normal","high","critical"].map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>
        </Fld>
      </div>
      <Fld label="Current focus"><input disabled={!canWrite} value={form.current_focus} onChange={(e) => setForm({ ...form, current_focus: e.target.value })} className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
      <Fld label="Description"><textarea disabled={!canWrite} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full resize-none bg-transparent outline-none disabled:opacity-70" /></Fld>
      <Fld label="Mission"><textarea disabled={!canWrite} rows={3} value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} className="w-full resize-none bg-transparent outline-none disabled:opacity-70" /></Fld>
      <div className="grid grid-cols-2 gap-3">
        <Fld label="Business model"><input disabled={!canWrite} value={form.business_model} onChange={(e) => setForm({ ...form, business_model: e.target.value })} className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
        <Fld label="Audience"><input disabled={!canWrite} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
      </div>
      <div className="flex items-center justify-between">
        {canArchive ? (
          <button onClick={() => { if (confirm("Archive this venture? It will be hidden from active lists.")) archive.mutate(ventureId); }} className="text-[12.5px] text-muted-foreground hover:text-foreground">Archive venture</button>
        ) : <span />}
        {canWrite && (
          <button onClick={save} disabled={update.isPending} className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
            {update.isPending ? "Saving…" : "Save venture"}
          </button>
        )}
      </div>
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