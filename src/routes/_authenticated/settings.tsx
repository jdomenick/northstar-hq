import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { actorName } from "@/lib/actor-names";
import { useNavigate, Link } from "@tanstack/react-router";
import { ModuleConnectionsCard } from "@/components/command/module-connections-card";
import { useCommandOverview } from "@/lib/command/hooks";
import {
  useAppearance,
  type FontSizePreference,
  type ThemePreference,
} from "@/lib/appearance";

import {
  useOrganization,
  useOrgMembersFull,
  useProfile,
  useUpdateMemberRole,
  useUpdateMemberStatus,
  useUpdateOrganization,
  useUpdateProfile,
  useArchivedRecords,
  useRestoreProject,
  useRestoreKnowledge,
  useRestoreDocument,
  useRestoreVenture,
  useRestoreGoal,
  useRestoreDecision,
  useRestoreCommitment,
  useSamSettings,
  useUpsertSamSettings,
  type ArchivedType,
  type MemberStatus,
  type OrgMemberFull,
  type OrgRole,
} from "@/lib/data-hooks";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings  -  NorthStar Labs" },
      { name: "description", content: "Founder, organization, and member preferences." },
    ],
  }),
});

const SECTIONS = [
  { value: "profile", label: "Founder Profile" },
  { value: "organization", label: "Organization" },
  { value: "members", label: "Members" },
  { value: "sam", label: "SAM" },
  { value: "accountability", label: "Accountability" },
  { value: "notifications", label: "Notifications" },
  { value: "security", label: "Security" },
  { value: "data", label: "Data & Privacy" },
  { value: "integrations", label: "Integrations" },
  { value: "appearance", label: "Appearance" },
];

function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Preferences" description="Tune how NorthStar Labs works for you and your team." />
      <PageBody>
        <div className="mb-6 rounded-md border border-border/60 bg-card/40 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Founder Activation</div>
              <div className="text-muted-foreground">Seed NorthStar Labs with your real ventures, projects, goals, decisions, and commitments so SAM has the context it needs.</div>
            </div>
            <Link to="/settings/founder-activation" className="rounded-md border border-border px-3 py-1.5 text-[12.5px] hover:bg-secondary/60">Open</Link>
          </div>
        </div>
        <Tabs defaultValue="profile">
          <TabsList className="mb-10 -mx-2 h-auto flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0">
            {SECTIONS.map((s) => (
              <TabsTrigger key={s.value} value={s.value} className="relative rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[12.5px] text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="profile"><ProfileTab /></TabsContent>
          <TabsContent value="organization"><OrganizationTab /></TabsContent>
          <TabsContent value="members"><MembersTab /></TabsContent>
          <TabsContent value="data"><ArchiveCenterTab /></TabsContent>
          <TabsContent value="sam"><SamSettingsTab /></TabsContent>
          <TabsContent value="integrations"><ModuleReportingTab /></TabsContent>
          <TabsContent value="appearance"><AppearanceTab /></TabsContent>
          {["accountability","notifications","security"].map((v) => (
            <TabsContent key={v} value={v}>
              <p className="text-[13.5px] text-muted-foreground">
                This section connects in a future phase.
              </p>
            </TabsContent>
          ))}


        </Tabs>
      </PageBody>
    </div>
  );
}

function ModuleReportingTab() {
  const { activeOrgId } = useOrg();
  const overview = useCommandOverview(activeOrgId);
  if (!activeOrgId) {
    return (
      <p className="text-[13.5px] text-muted-foreground">
        Select an organization to manage module reporting connections.
      </p>
    );
  }
  const clients = (overview.data?.clients.data ?? []).map((c) => ({ id: c.id, name: c.name }));
  return (
    <div className="max-w-4xl">
      <ModuleConnectionsCard organizationId={activeOrgId} clients={clients} />
    </div>
  );
}

function SamSettingsTab() {

  const { activeOrgId, activeMembership } = useOrg();
  const samQ = useSamSettings(activeOrgId);
  const upsert = useUpsertSamSettings(activeOrgId);
  const canManage = can.manageOrg(activeMembership?.role);
  const s = samQ.data;
  if (samQ.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-card/30" />;
  const Row = (props: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[minmax(0,220px)_1fr] gap-6 border-b border-border/60 py-4 text-[13.5px] last:border-0">
      <div>
        <div className="text-muted-foreground">{props.label}</div>
        {props.hint && <div className="mt-0.5 text-[11.5px] text-muted-foreground/70">{props.hint}</div>}
      </div>
      <div>{props.children}</div>
    </div>
  );
  const set = (patch: Record<string, unknown>) => upsert.mutate(patch as never, {
    onSuccess: () => toast.success("SAM settings updated"),
    onError: (e: unknown) => toast.error((e as Error).message || "Update failed"),
  });
  const disabled = !canManage;
  return (
    <div className="max-w-2xl">
      <Section title="SAM behavior" hint="How SAM answers, cites, and treats memory. Owner/admin only.">
        <Row label="Response style">
          <select disabled={disabled} value={s?.response_style ?? "balanced"} onChange={(e) => set({ response_style: e.target.value })} className="rounded-md bg-secondary/40 px-2 py-1.5 outline-none">
            <option value="concise">Concise</option>
            <option value="balanced">Balanced</option>
            <option value="detailed">Detailed</option>
          </select>
        </Row>
        <Row label="Challenge level">
          <select disabled={disabled} value={s?.challenge_level ?? "balanced"} onChange={(e) => set({ challenge_level: e.target.value })} className="rounded-md bg-secondary/40 px-2 py-1.5 outline-none">
            <option value="supportive">Supportive</option>
            <option value="balanced">Balanced</option>
            <option value="direct">Direct</option>
          </select>
        </Row>
        <Row label="Show citations" hint="Display source records under each SAM answer.">
          <SamToggle disabled={disabled} checked={s?.include_citations ?? true} onChange={(v) => set({ include_citations: v })} />
        </Row>
        <Row label="Show confidence" hint="Display SAM's confidence band and reasons.">
          <SamToggle disabled={disabled} checked={s?.show_confidence ?? true} onChange={(v) => set({ show_confidence: v })} />
        </Row>
      </Section>
      <Section title="Memory">
        <Row label="Allow memory proposals" hint="SAM extracts candidate memory from conversations. Always requires human confirmation.">
          <SamToggle disabled={disabled} checked={s?.allow_memory_proposals ?? true} onChange={(v) => set({ allow_memory_proposals: v })} />
        </Row>
        <Row label="Include founder memory"><SamToggle disabled={disabled} checked={s?.include_founder_memory ?? true} onChange={(v) => set({ include_founder_memory: v })} /></Row>
        <Row label="Include organization memory"><SamToggle disabled={disabled} checked={s?.include_org_memory ?? true} onChange={(v) => set({ include_org_memory: v })} /></Row>
        <Row label="Include venture memory"><SamToggle disabled={disabled} checked={s?.include_venture_memory ?? true} onChange={(v) => set({ include_venture_memory: v })} /></Row>
        <Row label="Memory review reminders" hint="Nudge to review expired or stale memory.">
          <SamToggle disabled={disabled} checked={s?.memory_review_reminders ?? true} onChange={(v) => set({ memory_review_reminders: v })} />
        </Row>
      </Section>
      <Section title="Conversations">
        <Row label="Retain conversation history">
          <SamToggle disabled={disabled} checked={s?.retain_conversation_history ?? true} onChange={(v) => set({ retain_conversation_history: v })} />
        </Row>
      </Section>
    </div>
  );
}

function SamToggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
        (checked ? "bg-foreground " : "bg-secondary/60 ") +
        (disabled ? "opacity-60" : "")
      }
      aria-pressed={checked}
    >
      <span className={"inline-block h-4 w-4 transform rounded-full bg-background transition-transform " + (checked ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

const ARCHIVE_TYPES: Array<{ value: ArchivedType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "venture", label: "Ventures" },
  { value: "project", label: "Projects" },
  { value: "goal", label: "Goals" },
  { value: "decision", label: "Decisions" },
  { value: "commitment", label: "Commitments" },
  { value: "knowledge", label: "Knowledge" },
  { value: "document", label: "Documents" },
];

function ArchiveCenterTab() {
  const { activeOrgId, activeMembership } = useOrg();
  const navigate = useNavigate();
  const [type, setType] = useState<ArchivedType | "all">("all");
  const [query, setQuery] = useState("");
  const archivedQ = useArchivedRecords(activeOrgId, { type, query });
  const restoreProject = useRestoreProject(activeOrgId);
  const restoreKnowledge = useRestoreKnowledge(activeOrgId);
  const restoreDocument = useRestoreDocument(activeOrgId);
  const restoreVenture = useRestoreVenture(activeOrgId);
  const restoreGoal = useRestoreGoal(activeOrgId);
  const restoreDecision = useRestoreDecision(activeOrgId);
  const restoreCommitment = useRestoreCommitment(activeOrgId);
  const canRestore = can.archiveContent(activeMembership?.role);

  async function handleRestore(row: { id: string; type: ArchivedType; title: string; ventureId?: string | null }) {
    if (!confirm(`Restore "${row.title}"?`)) return;
    try {
      if (row.type === "project") await restoreProject.mutateAsync(row.id);
      else if (row.type === "knowledge") await restoreKnowledge.mutateAsync({ id: row.id, title: row.title, venture_id: row.ventureId ?? null });
      else if (row.type === "document") await restoreDocument.mutateAsync({ id: row.id, title: row.title, venture_id: row.ventureId ?? null });
      else if (row.type === "venture") await restoreVenture.mutateAsync(row.id);
      else if (row.type === "goal") await restoreGoal.mutateAsync(row.id);
      else if (row.type === "decision") await restoreDecision.mutateAsync(row.id);
      else if (row.type === "commitment") await restoreCommitment.mutateAsync(row.id);
      else return toast.info(`Restore for ${row.type} is not yet supported in-app.`);
      toast.success("Restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Archive Center" hint="Archived records stay in your organization and can be restored. Nothing is permanently deleted.">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search archived records…"
            className="min-w-[220px] flex-1 rounded-md bg-secondary/40 px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ArchivedType | "all")}
            className="rounded-md bg-secondary/40 px-2.5 py-2 text-[12.5px] outline-none hover:bg-secondary/60"
          >
            {ARCHIVE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
        </div>
        {archivedQ.isLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-card/30" />
        ) : (archivedQ.data ?? []).length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nothing archived here.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {(archivedQ.data ?? []).map((row) => (
              <li key={`${row.type}-${row.id}`} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-foreground">{row.title}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    <span className="capitalize">{row.type}</span>
                    {row.archivedAt && ` · archived ${row.archivedAt.slice(0, 10)}`}
                  </div>
                </div>
                <button
                  onClick={() => navigate({ to: row.route.to as any, params: row.route.params as any })}
                  className="rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
                >
                  Open
                </button>
                {canRestore && ["project", "knowledge", "document", "venture", "goal", "decision", "commitment"].includes(row.type) && (
                  <button
                    onClick={() => handleRestore(row)}
                    className="rounded-md bg-secondary/60 px-2.5 py-1 text-[12px] text-foreground hover:bg-secondary"
                  >
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[11.5px] text-muted-foreground/80">
          Restored records return with their previous relationships intact. Nothing is permanently deleted.
        </p>
      </Section>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const { activeOrgId, activeMembership } = useOrg();
  const profileQ = useProfile(user?.id);
  const update = useUpdateProfile(activeOrgId);
  const [form, setForm] = useState<{
    full_name: string;
    preferred_name: string;
    title: string;
    avatar_url: string;
    timezone: string;
    bio: string;
    pronouns: string;
    location: string;
    website: string;
    linkedin: string;
    twitter: string;
  } | null>(null);

  useEffect(() => {
    if (!profileQ.data) return;
    const links = (profileQ.data.links ?? {}) as Record<string, string | undefined>;
    setForm({
      full_name: profileQ.data.full_name ?? "",
      preferred_name: profileQ.data.preferred_name ?? "",
      title: profileQ.data.title ?? "",
      avatar_url: profileQ.data.avatar_url ?? "",
      timezone: profileQ.data.timezone ?? "UTC",
      bio: (profileQ.data as { bio?: string | null }).bio ?? "",
      pronouns: (profileQ.data as { pronouns?: string | null }).pronouns ?? "",
      location: (profileQ.data as { location?: string | null }).location ?? "",
      website: links.website ?? "",
      linkedin: links.linkedin ?? "",
      twitter: links.twitter ?? "",
    });
  }, [profileQ.data]);

  async function save() {
    if (!form || !user) return;
    try {
      const links: Record<string, string> = {};
      if (form.website.trim()) links.website = form.website.trim();
      if (form.linkedin.trim()) links.linkedin = form.linkedin.trim();
      if (form.twitter.trim()) links.twitter = form.twitter.trim();
      await update.mutateAsync({
        userId: user.id,
        patch: {
          full_name: form.full_name || null,
          preferred_name: form.preferred_name || null,
          title: form.title || null,
          avatar_url: form.avatar_url || null,
          timezone: form.timezone || "UTC",
          bio: form.bio || null,
          pronouns: form.pronouns || null,
          location: form.location || null,
          links,
        } as never,
      });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!form) return <div className="h-40 animate-pulse rounded-2xl bg-card/30" />;

  const displayName =
    form.preferred_name?.trim() ||
    form.full_name?.trim() ||
    user?.email ||
    "You";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="You">
        <div className="mb-6 flex items-center gap-5">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-secondary/40">
            {form.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.avatar_url}
                alt={displayName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[22px] font-medium text-muted-foreground">
                {initials}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] text-foreground">{displayName}</div>
            {form.title && (
              <div className="truncate text-[12.5px] text-muted-foreground">{form.title}</div>
            )}
            {form.pronouns && (
              <div className="mt-0.5 text-[11.5px] text-muted-foreground/80">{form.pronouns}</div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-[13.5px]">
          <Fld label="Full name"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full bg-transparent outline-none" /></Fld>
          <Fld label="Preferred name"><input value={form.preferred_name} onChange={(e) => setForm({ ...form, preferred_name: e.target.value })} className="w-full bg-transparent outline-none" /></Fld>
          <Fld label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-transparent outline-none" /></Fld>
          <Fld label="Pronouns"><input value={form.pronouns} onChange={(e) => setForm({ ...form, pronouns: e.target.value })} placeholder="e.g. she/her" className="w-full bg-transparent outline-none" /></Fld>
          <Fld label="Location"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, Country" className="w-full bg-transparent outline-none" /></Fld>
          <Fld label="Timezone"><input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="e.g. America/New_York" className="w-full bg-transparent outline-none" /></Fld>
          <div className="col-span-2">
            <Fld label="Avatar image URL">
              <input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" className="w-full bg-transparent outline-none" />
            </Fld>
          </div>
          <div className="col-span-2">
            <Fld label="Bio">
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="A short introduction. What you do, what you care about."
                rows={4}
                maxLength={600}
                className="w-full resize-none bg-transparent outline-none"
              />
              <div className="mt-1 text-right text-[10.5px] text-muted-foreground/70">
                {form.bio.length}/600
              </div>
            </Fld>
          </div>
        </div>
      </Section>
      <Section title="Links" hint="Optional. Shown on your profile.">
        <div className="grid grid-cols-1 gap-4 text-[13.5px]">
          <Fld label="Website"><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" className="w-full bg-transparent outline-none" /></Fld>
          <Fld label="LinkedIn"><input value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} placeholder="https://linkedin.com/in/…" className="w-full bg-transparent outline-none" /></Fld>
          <Fld label="X / Twitter"><input value={form.twitter} onChange={(e) => setForm({ ...form, twitter: e.target.value })} placeholder="https://x.com/…" className="w-full bg-transparent outline-none" /></Fld>
        </div>
      </Section>
      <Section title="Account">
        <div className="grid grid-cols-[minmax(0,200px)_1fr] gap-6 border-b border-border/60 py-4 text-[13.5px] last:border-0">
          <div className="text-muted-foreground">Email</div>
          <div className="text-foreground">{user?.email}</div>
        </div>
        <div className="grid grid-cols-[minmax(0,200px)_1fr] gap-6 border-b border-border/60 py-4 text-[13.5px] last:border-0">
          <div className="text-muted-foreground">Current organization</div>
          <div className="text-foreground">{activeMembership?.organizations?.name ?? " - "}</div>
        </div>
        <div className="grid grid-cols-[minmax(0,200px)_1fr] gap-6 border-b border-border/60 py-4 text-[13.5px] last:border-0">
          <div className="text-muted-foreground">Role</div>
          <div className="text-foreground capitalize">{activeMembership?.role ?? " - "}</div>
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">Email changes will be handled by a secure flow in a future phase.</p>
      </Section>
      <div className="flex justify-end">
        <button onClick={save} disabled={update.isPending} className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
          {update.isPending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

function OrganizationTab() {
  const { activeOrgId, activeMembership } = useOrg();
  const orgQ = useOrganization(activeOrgId);
  const update = useUpdateOrganization(activeOrgId);
  const canManage = can.manageOrg(activeMembership?.role);
  const [form, setForm] = useState<{ name: string; slug: string; description: string; industry: string; timezone: string; logo_url: string } | null>(null);

  useEffect(() => {
    if (!orgQ.data) return;
    setForm({
      name: orgQ.data.name,
      slug: orgQ.data.slug ?? "",
      description: orgQ.data.description ?? "",
      industry: orgQ.data.industry ?? "",
      timezone: orgQ.data.timezone ?? "UTC",
      logo_url: orgQ.data.logo_url ?? "",
    });
  }, [orgQ.data]);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) return toast.error("Name required");
    try {
      await update.mutateAsync({
        patch: {
          name: form.name.trim(),
          slug: form.slug.trim() || null,
          description: form.description || null,
          industry: form.industry || null,
          timezone: form.timezone || "UTC",
          logo_url: form.logo_url || null,
        },
      });
      toast.success("Organization saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      if (msg.toLowerCase().includes("duplicate") || msg.includes("organizations_slug")) toast.error("That slug is already taken.");
      else if (msg.toLowerCase().includes("invalid slug")) toast.error("Slug must use lowercase letters, digits, and hyphens.");
      else toast.error(msg);
    }
  }

  if (!form) return <div className="h-40 animate-pulse rounded-2xl bg-card/30" />;

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="Organization">
        {!canManage && <p className="mb-4 text-[12.5px] text-muted-foreground">Only owners and admins can change these fields.</p>}
        <div className="grid grid-cols-2 gap-4 text-[13.5px]">
          <Fld label="Name"><input disabled={!canManage} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
          <Fld label="Slug"><input disabled={!canManage} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="northstar" className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
          <Fld label="Industry"><input disabled={!canManage} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
          <Fld label="Timezone"><input disabled={!canManage} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
          <Fld label="Logo URL"><input disabled={!canManage} value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://" className="w-full bg-transparent outline-none disabled:opacity-70" /></Fld>
        </div>
        <div className="mt-4">
          <Fld label="Description"><textarea disabled={!canManage} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full resize-none bg-transparent outline-none disabled:opacity-70" /></Fld>
        </div>
      </Section>
      {canManage && (
        <div className="flex justify-end">
          <button onClick={save} disabled={update.isPending} className="rounded-md bg-foreground px-4 py-2 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
            {update.isPending ? "Saving…" : "Save organization"}
          </button>
        </div>
      )}
    </div>
  );
}

const ROLE_ORDER: OrgRole[] = ["owner", "admin", "executive", "member", "viewer"];

function MembersTab() {
  const { activeOrgId, activeMembership } = useOrg();
  const membersQ = useOrgMembersFull(activeOrgId);
  const updateRole = useUpdateMemberRole(activeOrgId);
  const updateStatus = useUpdateMemberStatus(activeOrgId);
  const canManage = can.manageMembers(activeMembership?.role);
  const iAmOwner = activeMembership?.role === "owner";

  const members = membersQ.data ?? [];
  const activeOwners = members.filter((m) => m.role === "owner" && m.status === "active");

  function canEditRoleOf(m: OrgMemberFull): boolean {
    if (!canManage) return false;
    if (m.role === "owner" && activeOwners.length <= 1) return false;
    if (m.role === "owner" && !iAmOwner) return false;
    return true;
  }

  function canRemove(m: OrgMemberFull): boolean {
    if (!canManage) return false;
    if (m.role === "owner" && activeOwners.length <= 1) return false;
    if (m.role === "owner" && !iAmOwner) return false;
    return true;
  }

  return (
    <div className="space-y-6">
      <Section title="Members">
        <p className="mb-4 text-[12.5px] text-muted-foreground">Member invitations will be activated in a future phase.</p>
        {membersQ.isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-card/30" />
        ) : members.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">No members yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-4 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[11.5px] font-medium text-foreground">
                  {(actorName(m.profile)[0] ?? "?").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-foreground">{actorName(m.profile)}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {m.profile?.email ?? " - "}
                    {m.profile?.title && ` · ${m.profile.title}`}
                    {m.joined_at && ` · joined ${m.joined_at.slice(0, 10)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{m.status}</span>
                  {canEditRoleOf(m) ? (
                    <select
                      value={m.role}
                      onChange={(e) => {
                        const next = e.target.value as OrgRole;
                        if (next === m.role) return;
                        if (!confirm(`Change ${actorName(m.profile)}'s role to ${next}?`)) return;
                        updateRole.mutate(
                          { membershipId: m.id, role: next, prevRole: m.role, memberName: actorName(m.profile) },
                          { onError: (err) => toast.error(err instanceof Error ? (err.message.includes("final owner") ? "Cannot demote the final owner." : err.message) : "Failed") },
                        );
                      }}
                      className="rounded-md bg-secondary/40 px-2 py-1 text-[12px] capitalize outline-none hover:bg-secondary/60"
                    >
                      {ROLE_ORDER.map((r) => (<option key={r} value={r}>{r}</option>))}
                    </select>
                  ) : (
                    <span className="rounded-md bg-secondary/40 px-2 py-1 text-[12px] capitalize text-muted-foreground">{m.role}</span>
                  )}
                  {canManage && m.status === "active" && canRemove(m) && (
                    <button onClick={() => { if (confirm(`Suspend ${actorName(m.profile)}?`)) updateStatus.mutate({ membershipId: m.id, status: "suspended" as MemberStatus, memberName: actorName(m.profile) }, { onError: (err) => toast.error(err instanceof Error ? err.message : "Failed") }); }} className="rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground">Suspend</button>
                  )}
                  {canManage && m.status === "suspended" && (
                    <button onClick={() => updateStatus.mutate({ membershipId: m.id, status: "active" as MemberStatus, memberName: actorName(m.profile) })} className="rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground">Reactivate</button>
                  )}
                  {canManage && m.status !== "removed" && canRemove(m) && (
                    <button onClick={() => { if (confirm(`Remove ${actorName(m.profile)} from the organization?`)) updateStatus.mutate({ membershipId: m.id, status: "removed" as MemberStatus, memberName: actorName(m.profile) }, { onError: (err) => toast.error(err instanceof Error ? (err.message.includes("final owner") ? "Cannot remove the final owner." : err.message) : "Failed") }); }} className="rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground">Remove</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
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
// ─────────────────────────────────────────────────────────────
// Appearance
// ─────────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "White surfaces, charcoal type" },
  { value: "dark", label: "Dark", hint: "NorthStar obsidian" },
  { value: "system", label: "System", hint: "Follow OS preference" },
];

const FONT_OPTIONS: { value: FontSizePreference; label: string; hint: string }[] = [
  { value: "compact", label: "Compact", hint: "Denser interface type" },
  { value: "default", label: "Default", hint: "Current sizing" },
  { value: "large", label: "Large", hint: "Easier to read" },
];

function AppearanceTab() {
  const { theme, resolvedTheme, fontSize, setTheme, setFontSize } = useAppearance();

  return (
    <div className="max-w-3xl space-y-10">
      <Section title="Theme" description="Applies across Command Center, Client Workspace, CRM, navigation, Settings, and SAM Messenger.">
        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              label={o.label}
              hint={o.hint}
              active={theme === o.value}
              onSelect={() => setTheme(o.value)}
            >
              <div className="mt-3 flex gap-1.5">
                <span className={`h-6 flex-1 rounded-sm border border-border ${o.value === "light" ? "bg-white" : o.value === "dark" ? "bg-[oklch(0.11_0.008_255)]" : "bg-gradient-to-r from-white to-[oklch(0.11_0.008_255)]"}`} />
              </div>
            </OptionCard>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Currently showing the {resolvedTheme} theme.
        </p>
      </Section>

      <Section title="Font size" description="Scales interface typography without changing the density of the dashboards.">
        <div className="grid gap-3 sm:grid-cols-3">
          {FONT_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              label={o.label}
              hint={o.hint}
              active={fontSize === o.value}
              onSelect={() => setFontSize(o.value)}
            >
              <div
                className="mt-3 truncate text-foreground/80"
                style={{ fontSize: o.value === "compact" ? 12 : o.value === "large" ? 16 : 14 }}
              >
                Revenue this month
              </div>
            </OptionCard>
          ))}
        </div>
      </Section>

      <p className="text-[12px] text-muted-foreground">
        Your appearance preferences are saved on this device and applied immediately.
      </p>
    </div>
  );
}

function OptionCard({
  label,
  hint,
  active,
  onSelect,
  children,
}: {
  label: string;
  hint: string;
  active: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`rounded-md border p-3 text-left transition ${
        active
          ? "border-foreground bg-secondary/50"
          : "border-border bg-card/40 hover:border-foreground/40 hover:bg-secondary/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        <span
          className={`h-2 w-2 rounded-full ${active ? "bg-foreground" : "bg-transparent border border-border"}`}
        />
      </div>
      <div className="mt-0.5 text-[11.5px] text-muted-foreground">{hint}</div>
      {children}
    </button>
  );
}
