// EditorShell - the shared cross-platform Content Operations editor.
//
// One parent content item -> N platform variants. Every variant is edited
// through the same field set; per-platform capabilities come from the
// platform registry so future destinations plug in without changing this
// component. Save is optimistic-safe: the server refuses to overwrite an
// approved variant unless the user explicitly overrides.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeftRight, Calendar as CalendarIcon, ClipboardCheck, Copy, History, Plus, Trash2, Archive as ArchiveIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ErrorLine, QuietPanel, SectionLabel,
} from "@/components/editorial";
import {
  getPlatformConfig, listEditorPlatforms, PROMOTION_CLASSIFICATIONS,
  type EditorPlatform, type PlatformConfig,
} from "@/lib/content-ops/platform-registry";
import {
  bodyCharBudget, validateVariant, type ValidationIssue, type ValidationResult,
} from "@/lib/content-ops/editor-validation";
import {
  createVariant, deleteVariant, listVentureCampaigns, listVenturePillars,
  loadEditor, requestRevision, saveVariant, submitForApproval, updateParentMeta,
} from "@/lib/content-ops/editor.functions";
import { approveContentItem, rejectContentItem } from "@/lib/content-ops/approvals.functions";
import {
  archiveContentItem, duplicateVariant, listEvergreenTopics, unarchiveContentItem,
} from "@/lib/content-ops/editorial.functions";
import { scheduleVariant } from "@/lib/content-ops/scheduling.functions";
import { PlatformPreview, type PreviewData } from "./platform-preview";
import { MediaPickerDialog, type PickedMedia } from "./media-picker-dialog";
import { RichTextEditor } from "./rich-text-editor";
import {
  EditorialFieldsPanel, EMPTY_EDITORIAL_DRAFT, editorialFromRow, editorialToPayload,
  type EditorialDraft,
} from "./editorial-fields-panel";
import { VersionHistoryDrawer } from "./version-history-drawer";
import { useAutosave, type AutosaveState } from "@/lib/content-ops/use-autosave";

// ---- Local shapes ---------------------------------------------------------

interface VariantRow {
  id: string;
  organization_id: string;
  venture_id: string;
  parent_content_item_id: string | null;
  platform: string;
  content_type: string;
  title: string | null;
  hook: string | null;
  body: string;
  cta: string | null;
  hashtags: string[] | null;
  link_url: string | null;
  first_comment: string | null;
  alt_text: string | null;
  newsletter_subject: string | null;
  newsletter_preview: string | null;
  media_requirements: Array<{ storageRef: string; mimeType: string; altText: string | null }> | null;
  status: string;
  approval_status: string;
  content_version: number;
  campaign_id: string | null;
  risk_band: string;
  metadata: Record<string, unknown> | null;
  duplicate_fingerprint: string;
  created_at: string;
  editorial: unknown;
  working_title: string | null;
  final_title: string | null;
  evergreen_topic: string | null;
  evergreen_tags: string[] | null;
  target_audience: string | null;
}

interface DraftState {
  platform: EditorPlatform;
  contentType: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtagsText: string;    // comma / space separated at rest; parsed on save
  mentionsText: string;
  linkUrl: string;
  firstComment: string;
  altText: string;
  newsletterSubject: string;
  newsletterPreview: string;
  media: Array<{ storageRef: string; mimeType: string; altText: string | null }>;
  dirty: boolean;
}

function parseTokens(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function draftFromRow(row: VariantRow): DraftState {
  const meta = row.metadata ?? {};
  const editorPlatform = (meta.editor_platform as EditorPlatform | undefined) ?? (row.platform as EditorPlatform);
  const mentions = Array.isArray(meta.mentions) ? (meta.mentions as string[]) : [];
  const media = Array.isArray(meta.media) ? (meta.media as DraftState["media"]) : (row.media_requirements ?? []);
  return {
    platform: editorPlatform,
    contentType: row.content_type,
    title: row.title ?? "",
    hook: row.hook ?? "",
    body: row.body,
    cta: row.cta ?? "",
    hashtagsText: (row.hashtags ?? []).join(" "),
    mentionsText: mentions.join(" "),
    linkUrl: row.link_url ?? "",
    firstComment: row.first_comment ?? "",
    altText: row.alt_text ?? "",
    newsletterSubject: row.newsletter_subject ?? "",
    newsletterPreview: row.newsletter_preview ?? "",
    media,
    dirty: false,
  };
}

function draftToPreview(d: DraftState): PreviewData {
  return {
    platform: d.platform,
    title: d.title || null,
    hook: d.hook || null,
    body: d.body,
    cta: d.cta || null,
    hashtags: parseTokens(d.hashtagsText),
    mentions: parseTokens(d.mentionsText),
    linkUrl: d.linkUrl || null,
    firstComment: d.firstComment || null,
    newsletterSubject: d.newsletterSubject || null,
    newsletterPreview: d.newsletterPreview || null,
    media: d.media,
  };
}

function toValidationRun(d: DraftState, duplicateOf: string | null): ValidationResult {
  return validateVariant({
    platform: d.platform,
    contentType: d.contentType,
    title: d.title || null,
    hook: d.hook || null,
    body: d.body,
    cta: d.cta || null,
    hashtags: parseTokens(d.hashtagsText),
    mentions: parseTokens(d.mentionsText),
    linkUrl: d.linkUrl || null,
    firstComment: d.firstComment || null,
    altText: d.altText || null,
    newsletterSubject: d.newsletterSubject || null,
    newsletterPreview: d.newsletterPreview || null,
    media: d.media,
    duplicateOfContentItemId: duplicateOf,
  });
}

// ---- Small primitives -----------------------------------------------------

function LabelledInput({
  label, value, onChange, placeholder, disabled, hint, maxHint,
  multiline, minRows,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  maxHint?: string;
  multiline?: boolean;
  minRows?: number;
}) {
  const shared = "block w-full border border-foreground/15 bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-foreground/35 focus:border-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/70">{label}</span>
        {maxHint && <span className="text-[10.5px] text-foreground/50">{maxHint}</span>}
      </div>
      {multiline ? (
        <textarea
          className={cn(shared, "resize-y font-body leading-relaxed")}
          rows={minRows ?? 4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      ) : (
        <input
          type="text"
          className={shared}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
      {hint && <div className="mt-1 text-[11.5px] text-foreground/55">{hint}</div>}
    </label>
  );
}

function InkButton({
  onClick, disabled, variant = "ghost", children, title, type,
}: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost" | "danger";
  children: React.ReactNode;
  title?: string;
  type?: "button" | "submit";
}) {
  const base = "inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-50";
  const style =
    variant === "solid" ? "border-foreground bg-foreground text-background hover:bg-foreground/85"
    : variant === "danger" ? "border-[oklch(0.5_0.18_27)] text-[oklch(0.5_0.18_27)] hover:bg-[oklch(0.5_0.18_27)]/10"
    : "border-foreground/25 text-foreground/80 hover:border-foreground/60 hover:text-foreground";
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} title={title} className={cn(base, style)}>
      {children}
    </button>
  );
}

function IssueLine({ issue }: { issue: ValidationIssue }) {
  const tone =
    issue.severity === "error" ? "text-[oklch(0.5_0.18_27)]"
    : issue.severity === "warning" ? "text-[oklch(0.55_0.14_65)]"
    : "text-foreground/60";
  return (
    <li className="flex items-start gap-2 py-1.5 text-[13px] leading-snug">
      <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone)} strokeWidth={2} />
      <div className="min-w-0">
        <div className="text-foreground/90">{issue.message}</div>
        <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.2em] text-foreground/45">
          {issue.field} - {issue.ruleId}
        </div>
      </div>
    </li>
  );
}

// ---- Variant sub-editor ---------------------------------------------------

function VariantEditor({
  variant, cfg, draft, setDraft, disabled, validation,
  organizationId, ventureId, campaignId,
}: {
  variant: VariantRow;
  cfg: PlatformConfig;
  draft: DraftState;
  setDraft: (fn: (d: DraftState) => DraftState) => void;
  disabled: boolean;
  validation: ValidationResult;
  organizationId: string;
  ventureId: string;
  campaignId: string | null;
}) {
  const budget = bodyCharBudget(draft.platform, draft.body);
  const supports = (k: keyof PlatformConfig["fields"]) => cfg.fields[k] !== "unsupported";
  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((d) => ({ ...d, [key]: value, dirty: true }));

  const [pickerOpen, setPickerOpen] = useState(false);
  const addMedia = () => setPickerOpen(true);
  const handlePicked = (picked: PickedMedia) => {
    set("media", [
      ...draft.media,
      { storageRef: picked.storageRef, mimeType: picked.mimeType, altText: picked.altText },
    ]);
  };

  return (
    <>
    <MediaPickerDialog
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      onPick={handlePicked}
      organizationId={organizationId}
      ventureId={ventureId}
      campaignId={campaignId}
      platform={draft.platform}
      disabled={disabled}
    />
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <SectionLabel>Platform</SectionLabel>
            <div className="mt-2 font-display text-[22px] leading-tight text-foreground">{cfg.displayName}</div>
            <div className="mt-1 text-[11.5px] text-foreground/55">
              Version {variant.content_version} - {draft.contentType}
            </div>
          </div>
          <div>
            <SectionLabel>Body budget</SectionLabel>
            <div className={cn(
              "mt-2 font-display text-[22px] leading-tight",
              budget.remaining < 0 ? "text-[oklch(0.5_0.18_27)]"
              : budget.remaining < budget.limit * 0.1 ? "text-[oklch(0.55_0.14_65)]"
              : "text-foreground",
            )}>
              {budget.used.toLocaleString()} / {budget.limit.toLocaleString()}
            </div>
            <div className="mt-1 text-[11.5px] text-foreground/55">
              {budget.remaining >= 0
                ? `${budget.remaining.toLocaleString()} left`
                : `${Math.abs(budget.remaining).toLocaleString()} over`}
            </div>
          </div>
        </div>

        {supports("title") && (
          <LabelledInput
            label={cfg.previewShape === "community" ? "Post title" : "Title"}
            value={draft.title}
            onChange={(v) => set("title", v)}
            disabled={disabled}
            maxHint={`Max ${cfg.limits.titleChars}`}
            placeholder={cfg.previewShape === "community" ? "Reddit post title" : "Optional title"}
          />
        )}

        {supports("newsletterSubject") && (
          <LabelledInput
            label="Subject line"
            value={draft.newsletterSubject}
            onChange={(v) => set("newsletterSubject", v)}
            disabled={disabled}
            maxHint={`Max ${cfg.limits.newsletterSubjectChars}`}
          />
        )}
        {supports("newsletterPreview") && (
          <LabelledInput
            label="Preview text"
            value={draft.newsletterPreview}
            onChange={(v) => set("newsletterPreview", v)}
            disabled={disabled}
            maxHint={`Max ${cfg.limits.newsletterPreviewChars}`}
          />
        )}

        {supports("hook") && (
          <LabelledInput
            label="Hook"
            value={draft.hook}
            onChange={(v) => set("hook", v)}
            disabled={disabled}
            multiline
            minRows={2}
            maxHint={`Max ${cfg.limits.hookChars}`}
            hint="Composed above the body on publish. Optional."
          />
        )}

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/70">Body</span>
            <span className="text-[10.5px] text-foreground/50">Ideal: {cfg.recommendations.idealBodyChars ?? "no guidance"}</span>
          </div>
          <RichTextEditor value={draft.body} onChange={(v) => set("body", v)} disabled={disabled} minRows={8} ariaLabel="Body" />
        </div>

        {supports("cta") && (
          <LabelledInput
            label="Call to action"
            value={draft.cta}
            onChange={(v) => set("cta", v)}
            disabled={disabled}
            maxHint={`Max ${cfg.limits.ctaChars}`}
          />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {supports("hashtags") && (
            <LabelledInput
              label="Hashtags"
              value={draft.hashtagsText}
              onChange={(v) => set("hashtagsText", v)}
              disabled={disabled}
              placeholder="healing recovery trauma"
              hint={`Space or comma separated. Max ${cfg.limits.hashtagCount}.`}
            />
          )}
          {supports("mentions") && (
            <LabelledInput
              label="Mentions"
              value={draft.mentionsText}
              onChange={(v) => set("mentionsText", v)}
              disabled={disabled}
              placeholder="@example.co @colleague"
              hint={`Handles with or without @. Max ${cfg.limits.mentionCount}.`}
            />
          )}
        </div>

        {supports("linkUrl") && (
          <LabelledInput
            label="Link"
            value={draft.linkUrl}
            onChange={(v) => set("linkUrl", v)}
            disabled={disabled}
            placeholder="https://"
            hint={cfg.recommendations.linkPolicy === "bio_only"
              ? `${cfg.displayName} does not click through in-post; consider link-in-bio phrasing.`
              : undefined}
          />
        )}

        {supports("firstComment") && (
          <LabelledInput
            label="First comment"
            value={draft.firstComment}
            onChange={(v) => set("firstComment", v)}
            disabled={disabled}
            multiline
            minRows={3}
            hint={`Posted immediately after the main post. Max ${cfg.limits.firstCommentChars}.`}
          />
        )}

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <SectionLabel>Media</SectionLabel>
            <button
              type="button"
              onClick={addMedia}
              disabled={disabled}
              className="text-[11px] uppercase tracking-[0.2em] text-foreground/70 underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40"
            >
              + Add media
            </button>
          </div>
          {draft.media.length === 0 ? (
            <div className="mt-2 border border-dashed border-foreground/15 px-4 py-6 text-center text-[12.5px] text-foreground/50">
              No media attached. {cfg.limits.mediaCount === 0 ? `${cfg.displayName} does not accept media.` : `Up to ${cfg.limits.mediaCount} allowed.`}
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-foreground/10 border border-foreground/12">
              {draft.media.map((m, idx) => (
                <li key={m.storageRef + idx} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[12px] text-foreground/80">{m.storageRef}</div>
                    <div className="text-[10.5px] uppercase tracking-[0.2em] text-foreground/50">{m.mimeType}</div>
                    {supports("altText") && (
                      <input
                        type="text"
                        className="mt-1 block w-full border border-foreground/12 bg-background px-2 py-1 text-[12.5px] text-foreground placeholder:text-foreground/35 focus:border-foreground/50 focus:outline-none"
                        value={m.altText ?? ""}
                        placeholder="Alt text (accessibility)"
                        onChange={(e) => {
                          const nextMedia = draft.media.slice();
                          nextMedia[idx] = { ...m, altText: e.target.value };
                          set("media", nextMedia);
                        }}
                        disabled={disabled}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => set("media", draft.media.filter((_, i) => i !== idx))}
                    disabled={disabled}
                    className="text-foreground/50 hover:text-[oklch(0.5_0.18_27)]"
                    title="Remove media"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <PlatformPreview data={draftToPreview(draft)} />

        <QuietPanel className="!p-5">
          <SectionLabel>Validation</SectionLabel>
          <div className="mt-3 flex items-center gap-4 text-[12px] text-foreground/70">
            <span>{validation.errorCount} errors</span>
            <span>{validation.warningCount} warnings</span>
            <span>{validation.infoCount} info</span>
          </div>
          {validation.issues.length === 0 ? (
            <div className="mt-3 text-[12.5px] text-foreground/55">Clean for {cfg.displayName}.</div>
          ) : (
            <ul className="mt-2 divide-y divide-foreground/10">
              {validation.issues.map((i) => <IssueLine key={i.id} issue={i} />)}
            </ul>
          )}
        </QuietPanel>
      </div>
    </div>
    </>
  );
}

// ---- Side-by-side ---------------------------------------------------------

function SideBySide({ variants, drafts }: { variants: VariantRow[]; drafts: Record<string, DraftState> }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(variants.length, 3)}, minmax(0, 1fr))` }}>
      {variants.slice(0, 3).map((v) => {
        const d = drafts[v.id] ?? draftFromRow(v);
        return (
          <div key={v.id} className="space-y-2">
            <SectionLabel>{getPlatformConfig(d.platform).displayName}</SectionLabel>
            <PlatformPreview data={draftToPreview(d)} />
          </div>
        );
      })}
    </div>
  );
}

// ---- Revision drawer (see version-history-drawer.tsx) ---------------------

interface VersionRow {
  id: string;
  content_item_id: string;
  version: number;
  generated_by: string;
  generated_by_actor_id: string | null;
  change_reason: string | null;
  created_at: string;
  content_hash: string;
}
interface ApprovalRow {
  id: string;
  content_item_id: string;
  content_version: number;
  action: string;
  notes: string | null;
  approved_by: string | null;
  approved_at: string;
}

// ---- Main shell -----------------------------------------------------------

export function EditorShell({ organizationId, parentContentItemId }: {
  organizationId: string;
  parentContentItemId: string;
}) {
  const qc = useQueryClient();
  const loadFn = useServerFn(loadEditor);
  const listCampaignsFn = useServerFn(listVentureCampaigns);
  const listPillarsFn = useServerFn(listVenturePillars);
  const saveFn = useServerFn(saveVariant);
  const createFn = useServerFn(createVariant);
  const deleteFn = useServerFn(deleteVariant);
  const submitFn = useServerFn(submitForApproval);
  const requestRevisionFn = useServerFn(requestRevision);
  const approveFn = useServerFn(approveContentItem);
  const rejectFn = useServerFn(rejectContentItem);
  const updateParentFn = useServerFn(updateParentMeta);
  const duplicateFn = useServerFn(duplicateVariant);
  const archiveFn = useServerFn(archiveContentItem);
  const unarchiveFn = useServerFn(unarchiveContentItem);
  const scheduleFn = useServerFn(scheduleVariant);
  const listTopicsFn = useServerFn(listEvergreenTopics);

  const editorKey = ["content-ops", "editor", organizationId, parentContentItemId];
  const editorQ = useQuery({
    queryKey: editorKey,
    queryFn: () => loadFn({ data: { organizationId, parentContentItemId } }),
  });

  const parent = editorQ.data?.parent as VariantRow | undefined;
  const ventureId = parent?.venture_id;

  const campaignsQ = useQuery({
    queryKey: ["content-ops", "campaigns", organizationId, ventureId],
    enabled: !!ventureId,
    queryFn: () => listCampaignsFn({ data: { organizationId, ventureId: ventureId! } }),
  });
  const pillarsQ = useQuery({
    queryKey: ["content-ops", "pillars", organizationId, ventureId],
    enabled: !!ventureId,
    queryFn: () => listPillarsFn({ data: { organizationId, ventureId: ventureId! } }),
  });

  const variants = (editorQ.data?.variants ?? []) as VariantRow[];
  const versions = (editorQ.data?.versions ?? []) as VersionRow[];
  const approvals = (editorQ.data?.approvals ?? []) as ApprovalRow[];
  const duplicates = (editorQ.data?.duplicates ?? []) as Array<{ fingerprint: string; contentItemId: string }>;

  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [editorialDrafts, setEditorialDrafts] = useState<Record<string, EditorialDraft>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "compare" | "history">("edit");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!variants.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const v of variants) if (!next[v.id]) next[v.id] = draftFromRow(v);
      return next;
    });
    setEditorialDrafts((prev) => {
      const next = { ...prev };
      for (const v of variants) if (!next[v.id]) {
        const draft = editorialFromRow(v.editorial);
        // Merge dedicated columns that live outside the JSONB blob.
        next[v.id] = {
          ...draft,
          workingTitle: v.working_title ?? draft.workingTitle ?? "",
          finalTitle: v.final_title ?? draft.finalTitle ?? "",
          evergreenTopic: v.evergreen_topic ?? draft.evergreenTopic ?? "",
          evergreenTags: (v.evergreen_tags ?? draft.evergreenTags ?? []).filter(Boolean),
          targetAudience: v.target_audience ?? draft.targetAudience ?? "",
        };
      }
      return next;
    });
    setActiveId((prev) => prev ?? variants[0]?.id ?? null);
  }, [variants]);

  const active = variants.find((v) => v.id === activeId) ?? null;
  const activeDraft = active ? drafts[active.id] : null;
  const activeCfg = active && activeDraft ? getPlatformConfig(activeDraft.platform) : null;
  const activeEditorial = active ? (editorialDrafts[active.id] ?? EMPTY_EDITORIAL_DRAFT) : EMPTY_EDITORIAL_DRAFT;

  const topicsQ = useQuery({
    queryKey: ["content-ops", "evergreen-topics", organizationId, ventureId],
    enabled: !!ventureId,
    queryFn: () => listTopicsFn({ data: { organizationId, ventureId: ventureId! } }),
  });

  const dupOfActive = useMemo(() => {
    if (!active) return null;
    const match = duplicates.find((d) => d.fingerprint === active.duplicate_fingerprint);
    return match?.contentItemId ?? null;
  }, [active, duplicates]);

  const validation = useMemo(() => {
    if (!activeDraft) return null;
    return toValidationRun(activeDraft, dupOfActive);
  }, [activeDraft, dupOfActive]);

  const setActiveDraft = useCallback((fn: (d: DraftState) => DraftState) => {
    if (!activeId) return;
    setDrafts((prev) => ({ ...prev, [activeId]: fn(prev[activeId]!) }));
  }, [activeId]);

  const setActiveEditorial = useCallback((next: EditorialDraft) => {
    if (!activeId) return;
    setEditorialDrafts((prev) => ({ ...prev, [activeId]: next }));
    setDrafts((prev) => activeId && prev[activeId] ? { ...prev, [activeId]: { ...prev[activeId]!, dirty: true } } : prev);
  }, [activeId]);

  // ---- Mutations ---------------------------------------------------------

  const invalidate = () => qc.invalidateQueries({ queryKey: editorKey });

  const saveMut = useMutation({
    mutationFn: async (opts: { overrideApproved: boolean; changeReason?: string; clientEditToken?: string }) => {
      if (!active || !activeDraft || !ventureId) throw new Error("no active variant");
      const ed = editorialToPayload(activeEditorial);
      const payload = {
        organizationId, ventureId,
        contentItemId: active.id,
        platform: activeDraft.platform,
        contentType: activeDraft.contentType,
        title: activeDraft.title || null,
        hook: activeDraft.hook || null,
        body: activeDraft.body,
        cta: activeDraft.cta || null,
        hashtags: parseTokens(activeDraft.hashtagsText),
        mentions: parseTokens(activeDraft.mentionsText),
        linkUrl: activeDraft.linkUrl || null,
        firstComment: activeDraft.firstComment || null,
        altText: activeDraft.altText || null,
        newsletterSubject: activeDraft.newsletterSubject || null,
        newsletterPreview: activeDraft.newsletterPreview || null,
        media: activeDraft.media,
        changeReason: opts.changeReason,
        overrideApproved: opts.overrideApproved,
        workingTitle: ed.workingTitle,
        finalTitle: ed.finalTitle,
        editorial: ed,
        evergreenTopic: ed.evergreenTopic,
        evergreenTags: ed.evergreenTags,
        targetAudience: ed.targetAudience,
        clientEditToken: opts.clientEditToken,
      };
      return saveFn({ data: payload });
    },
    onSuccess: () => {
      setError(null);
      setDrafts((prev) => activeId ? { ...prev, [activeId]: { ...prev[activeId]!, dirty: false } } : prev);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  // Autosave: fires while editing. Never shows "Saved" until the server
  // acknowledges. Cannot silently override an approved variant - it disables
  // itself in that case so the operator has to explicitly click Save.
  const autosaveEnabled = !!active
    && active.approval_status !== "approved"
    && active.status !== "published"
    && active.status !== "publishing"
    && !!activeDraft?.dirty;
  const autosave = useAutosave({
    enabled: autosaveEnabled,
    getSnapshot: () => (active && activeDraft ? { id: active.id, v: active.content_version } : null),
    save: async (_snap, token) => {
      await new Promise<void>((resolve, reject) => {
        saveMut.mutate(
          { overrideApproved: false, clientEditToken: token, changeReason: "autosave" },
          { onSuccess: () => resolve(), onError: (e) => reject(e as Error) },
        );
      });
    },
  });
  useEffect(() => { if (autosaveEnabled) autosave.notifyEdit(); }, [
    autosaveEnabled, activeDraft, activeEditorial,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSave = () => {
    if (!active) return;
    if (active.approval_status === "approved") {
      const confirmed = window.confirm(
        "This variant is already approved. Saving will REVOKE approval and require re-approval. Continue?",
      );
      if (!confirmed) return;
      saveMut.mutate({ overrideApproved: true, changeReason: "override_approved_variant" });
    } else {
      saveMut.mutate({ overrideApproved: false });
    }
  };

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!active || !ventureId) throw new Error();
      return submitFn({ data: { organizationId, ventureId, contentItemId: active.id } });
    },
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const requestRevMut = useMutation({
    mutationFn: async () => {
      if (!active || !ventureId) throw new Error();
      const notes = window.prompt("Notes for the author (3-2000 chars):");
      if (!notes) throw new Error("cancelled");
      return requestRevisionFn({ data: { organizationId, ventureId, contentItemId: active.id, notes } });
    },
    onSuccess: invalidate,
    onError: (e: Error) => { if (e.message !== "cancelled") setError(e.message); },
  });

  const approveMut = useMutation({
    mutationFn: async () => {
      if (!active || !ventureId) throw new Error();
      return approveFn({ data: { organizationId, ventureId, contentItemId: active.id, action: "approved" as const } });
    },
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      if (!active || !ventureId) throw new Error();
      const reason = window.prompt("Rejection reason (3-2000 chars):");
      if (!reason) throw new Error("cancelled");
      return rejectFn({ data: { organizationId, ventureId, contentItemId: active.id, reason } });
    },
    onSuccess: invalidate,
    onError: (e: Error) => { if (e.message !== "cancelled") setError(e.message); },
  });

  const addVariantMut = useMutation({
    mutationFn: async (platform: EditorPlatform) => {
      if (!parent || !ventureId) throw new Error();
      const cfg = getPlatformConfig(platform);
      const contentType = cfg.contentTypes[0] ?? "text";
      return createFn({
        data: { organizationId, ventureId, parentContentItemId: parent.id, platform, contentType },
      });
    },
    onSuccess: (res) => {
      invalidate();
      if ("id" in res) setActiveId(res.id);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!ventureId) throw new Error();
      return deleteFn({ data: { organizationId, ventureId, contentItemId: id } });
    },
    onSuccess: (_, id) => {
      invalidate();
      if (activeId === id) setActiveId(variants.find((v) => v.id !== id)?.id ?? null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const duplicateMut = useMutation({
    mutationFn: async () => {
      if (!active || !ventureId) throw new Error("no active variant");
      return duplicateFn({ data: { organizationId, ventureId, contentItemId: active.id } });
    },
    onSuccess: (res) => { invalidate(); if (res?.id) setActiveId(res.id); },
    onError: (e: Error) => setError(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: async () => {
      if (!active || !ventureId) throw new Error("no active variant");
      const isArchived = active.status === "archived";
      return isArchived
        ? unarchiveFn({ data: { organizationId, ventureId, contentItemId: active.id } })
        : archiveFn({ data: { organizationId, ventureId, contentItemId: active.id } });
    },
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  const scheduleMut = useMutation({
    mutationFn: async () => {
      if (!active || !ventureId) throw new Error("no active variant");
      const input = window.prompt("Schedule for (ISO datetime, e.g. 2026-08-01T14:30:00Z):");
      if (!input) throw new Error("cancelled");
      const when = new Date(input);
      if (Number.isNaN(when.getTime())) throw new Error("Invalid date/time");
      return scheduleFn({
        data: {
          organizationId, ventureId,
          contentItemId: active.id,
          scheduledFor: when.toISOString(),
          contentVersion: active.content_version,
        } as never,
      });
    },
    onSuccess: invalidate,
    onError: (e: Error) => { if (e.message !== "cancelled") setError(e.message); },
  });

  const parentMeta = (parent?.metadata as Record<string, unknown> | null) ?? {};
  const parentCampaignId = parent?.campaign_id ?? null;
  const parentPillarId = (parentMeta.pillar_id as string | null) ?? null;
  const parentObjective = (parentMeta.objective as string | null) ?? null;
  const parentPromotion = (parentMeta.promotion_classification as string | null) ?? null;
  const parentRiskScore = (parentMeta.risk_score as number | null) ?? null;
  const generationProv = (parentMeta.generation_provenance as Record<string, unknown> | null) ?? null;

  interface ParentPatch {
    organizationId: string;
    ventureId: string;
    contentItemId: string;
    campaignId?: string | null;
    pillarId?: string | null;
    objective?: string | null;
    promotionClassification?: string | null;
    riskBand?: string;
    riskScore?: number | null;
  }
  const updateParent = async (patch: ParentPatch) => {
    try {
      await updateParentFn({ data: patch as never });
      invalidate();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ---- Render ------------------------------------------------------------

  if (editorQ.isLoading) {
    return <div className="text-[13px] text-foreground/60">Loading editor...</div>;
  }
  if (editorQ.isError || !parent || !ventureId) {
    return <ErrorLine message={(editorQ.error as Error | undefined)?.message ?? "Could not load this content item."} />;
  }

  const availablePlatforms = listEditorPlatforms().filter((p) =>
    !variants.some((v) => {
      const meta = v.metadata ?? {};
      const ep = (meta.editor_platform as string | undefined) ?? v.platform;
      return ep === p.key;
    })
  );

  return (
    <div className="space-y-8">
      {error && <ErrorLine message={error} onRetry={() => setError(null)} />}

      {/* Parent metadata */}
      <QuietPanel>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <SectionLabel>Campaign</SectionLabel>
            <select
              className="mt-2 block w-full border border-foreground/15 bg-background px-2 py-1.5 text-[13px] focus:border-foreground/60 focus:outline-none"
              value={parentCampaignId ?? ""}
              onChange={(e) => updateParent({
                organizationId, ventureId, contentItemId: parent.id,
                campaignId: e.target.value || null,
              })}
            >
              <option value="">(none)</option>
              {(campaignsQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <SectionLabel>Content pillar</SectionLabel>
            <select
              className="mt-2 block w-full border border-foreground/15 bg-background px-2 py-1.5 text-[13px] focus:border-foreground/60 focus:outline-none"
              value={parentPillarId ?? ""}
              onChange={(e) => updateParent({
                organizationId, ventureId, contentItemId: parent.id,
                pillarId: e.target.value || null,
              })}
            >
              <option value="">(none)</option>
              {(pillarsQ.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <SectionLabel>Promotion</SectionLabel>
            <select
              className="mt-2 block w-full border border-foreground/15 bg-background px-2 py-1.5 text-[13px] focus:border-foreground/60 focus:outline-none"
              value={parentPromotion ?? ""}
              onChange={(e) => updateParent({
                organizationId, ventureId, contentItemId: parent.id,
                promotionClassification: (e.target.value || null) as never,
              })}
            >
              <option value="">(unclassified)</option>
              {PROMOTION_CLASSIFICATIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <SectionLabel>Risk band</SectionLabel>
            <select
              className="mt-2 block w-full border border-foreground/15 bg-background px-2 py-1.5 text-[13px] focus:border-foreground/60 focus:outline-none"
              value={parent.risk_band}
              onChange={(e) => updateParent({
                organizationId, ventureId, contentItemId: parent.id,
                riskBand: e.target.value as never,
              })}
            >
              {["low", "moderate", "high", "critical", "unknown"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {parentRiskScore != null && (
              <div className="mt-1 text-[11px] text-foreground/55">Score {parentRiskScore.toFixed(2)}</div>
            )}
          </label>
        </div>

        <div className="mt-6">
          <LabelledInput
            label="Objective"
            value={parentObjective ?? ""}
            onChange={(v) => updateParent({
              organizationId, ventureId, contentItemId: parent.id,
              objective: v || null,
            })}
            multiline
            minRows={2}
            hint="Free text, applied to the whole content group."
          />
        </div>

        {generationProv && (
          <div className="mt-4 text-[11.5px] text-foreground/55">
            Generated by <span className="font-mono">{String(generationProv.actor ?? "unknown")}</span>
            {generationProv.engine_version ? <> - engine {String(generationProv.engine_version)}</> : null}
          </div>
        )}
      </QuietPanel>

      {/* Mode + variant tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-foreground/12 pb-2">
        <div className="flex flex-wrap gap-1">
          {variants.map((v) => {
            const meta = v.metadata ?? {};
            const ep = (meta.editor_platform as EditorPlatform | undefined) ?? (v.platform as EditorPlatform);
            const cfg = getPlatformConfig(ep);
            const isActive = v.id === activeId && mode === "edit";
            const dirty = drafts[v.id]?.dirty;
            const approved = v.approval_status === "approved";
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => { setActiveId(v.id); setMode("edit"); }}
                className={cn(
                  "border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em]",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/20 text-foreground/70 hover:border-foreground/50",
                )}
              >
                {cfg.displayName}
                {dirty && <span className="ml-1.5 text-[9px]">*</span>}
                {approved && <span className="ml-1.5 text-[9px]">[approved]</span>}
              </button>
            );
          })}
          {availablePlatforms.length > 0 && (
            <div className="relative">
              <select
                className="cursor-pointer appearance-none border border-dashed border-foreground/30 bg-transparent px-3 py-1.5 pr-8 text-[11px] uppercase tracking-[0.2em] text-foreground/70 hover:border-foreground/60"
                value=""
                onChange={(e) => {
                  if (e.target.value) addVariantMut.mutate(e.target.value as EditorPlatform);
                  e.target.value = "";
                }}
              >
                <option value="">+ Add variant</option>
                {availablePlatforms.map((p) => (
                  <option key={p.key} value={p.key}>{p.displayName}</option>
                ))}
              </select>
              <Plus className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-foreground/50" />
            </div>
          )}
        </div>

        <div className="ml-auto flex gap-2">
          <InkButton
            variant={mode === "compare" ? "solid" : "ghost"}
            onClick={() => setMode(mode === "compare" ? "edit" : "compare")}
            disabled={variants.length < 2}
            title={variants.length < 2 ? "Add another variant to compare" : "Side-by-side"}
          >
            <ArrowLeftRight className="h-3 w-3" /> Compare
          </InkButton>
          <InkButton
            variant={mode === "history" ? "solid" : "ghost"}
            onClick={() => setMode(mode === "history" ? "edit" : "history")}
          >
            <History className="h-3 w-3" /> History
          </InkButton>
        </div>
      </div>

      {/* Modes */}
      {mode === "compare" && (
        <div>
          <SectionLabel>Side by side</SectionLabel>
          <div className="mt-4"><SideBySide variants={variants} drafts={drafts} /></div>
        </div>
      )}

      {mode === "history" && (
        <div>
          <SectionLabel>Revision history</SectionLabel>
          <div className="mt-4">
            {active ? (
              <VersionHistoryDrawer
                organizationId={organizationId}
                ventureId={ventureId}
                contentItemId={active.id}
                currentVersion={active.content_version}
                currentApprovalStatus={active.approval_status}
                versions={versions}
                approvals={approvals}
              />
            ) : (
              <div className="text-[13px] text-foreground/60">Select a variant to view history.</div>
            )}
          </div>
        </div>
      )}

      {mode === "edit" && active && activeDraft && activeCfg && validation && (
        <>
          <EditorialFieldsPanel
            value={activeEditorial}
            onChange={setActiveEditorial}
            disabled={active.status === "published" || active.status === "publishing"}
            topics={(topicsQ.data ?? []) as Array<{ id: string; slug: string; label: string; category: string | null }>}
          />

          <VariantEditor
            variant={active}
            cfg={activeCfg}
            draft={activeDraft}
            setDraft={setActiveDraft}
            disabled={active.status === "published" || active.status === "publishing"}
            validation={validation}
            organizationId={organizationId}
            ventureId={ventureId}
            campaignId={parentCampaignId}
          />

          {/* Action bar */}
          <div className="sticky bottom-0 z-10 -mx-6 border-t border-foreground/15 bg-background/95 px-6 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-[11.5px] text-foreground/60">
                <ClipboardCheck className="h-3.5 w-3.5" />
                <span>Status: <b className="font-medium text-foreground/85">{active.status}</b></span>
                <span>Approval: <b className="font-medium text-foreground/85">{active.approval_status}</b></span>
                {activeDraft.dirty && <span className="text-[oklch(0.55_0.14_65)]">Unsaved changes</span>}
                <AutosaveStatusPill state={autosave.state} enabled={autosaveEnabled} />
              </div>
              <div className="flex flex-wrap gap-2">
                <InkButton
                  variant="danger"
                  onClick={() => {
                    if (window.confirm("Delete this variant? The other variants stay.")) {
                      deleteMut.mutate(active.id);
                    }
                  }}
                  disabled={!active.parent_content_item_id}
                  title={!active.parent_content_item_id ? "Cannot delete the parent variant" : undefined}
                >
                  <Trash2 className="h-3 w-3" /> Delete variant
                </InkButton>
                <InkButton
                  onClick={() => duplicateMut.mutate()}
                  disabled={duplicateMut.isPending}
                  title="Create an editable copy as a new draft"
                >
                  <Copy className="h-3 w-3" /> {duplicateMut.isPending ? "Duplicating..." : "Duplicate"}
                </InkButton>
                <InkButton
                  onClick={() => archiveMut.mutate()}
                  disabled={archiveMut.isPending || active.status === "publishing"}
                  title={active.status === "archived" ? "Restore from archive" : "Move to archive"}
                >
                  <ArchiveIcon className="h-3 w-3" /> {active.status === "archived" ? "Unarchive" : "Archive"}
                </InkButton>
                <InkButton
                  onClick={doSave}
                  disabled={saveMut.isPending || !activeDraft.dirty}
                >
                  {saveMut.isPending ? "Saving..." : "Save draft"}
                </InkButton>
                <InkButton
                  onClick={() => requestRevMut.mutate()}
                  disabled={requestRevMut.isPending || active.approval_status === "changes_requested"}
                >
                  Request revision
                </InkButton>
                <InkButton
                  onClick={() => submitMut.mutate()}
                  disabled={submitMut.isPending || validation.blocksSubmit || activeDraft.dirty}
                  title={validation.blocksSubmit ? "Fix errors first" : activeDraft.dirty ? "Save first" : undefined}
                >
                  Submit for approval
                </InkButton>
                <InkButton
                  variant="danger"
                  onClick={() => rejectMut.mutate()}
                  disabled={rejectMut.isPending || active.approval_status === "rejected"}
                >
                  Reject
                </InkButton>
                <InkButton
                  variant="solid"
                  onClick={() => approveMut.mutate()}
                  disabled={approveMut.isPending || validation.blocksApprove || activeDraft.dirty || active.approval_status === "approved"}
                  title={validation.blocksApprove ? "Fix errors first" : undefined}
                >
                  Approve
                </InkButton>
                <InkButton
                  onClick={() => scheduleMut.mutate()}
                  disabled={scheduleMut.isPending || active.approval_status !== "approved"}
                  title={active.approval_status !== "approved" ? "Approve first" : "Enqueue for scheduled publication"}
                >
                  <CalendarIcon className="h-3 w-3" /> {scheduleMut.isPending ? "Scheduling..." : "Schedule"}
                </InkButton>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AutosaveStatusPill({ state, enabled }: { state: AutosaveState; enabled: boolean }) {
  if (!enabled && state.status === "idle") return null;
  const label =
    state.status === "saving" ? "Saving..."
    : state.status === "saved" ? (state.lastSavedAt ? `Saved ${timeAgo(state.lastSavedAt)}` : "Saved")
    : state.status === "retrying" ? `Retrying (attempt ${state.attempt + 1})...`
    : state.status === "failed" ? "Autosave failed"
    : state.status === "offline" ? "Offline - will save when back online"
    : "";
  if (!label) return null;
  const tone =
    state.status === "failed" ? "text-[oklch(0.5_0.18_27)]"
    : state.status === "retrying" || state.status === "offline" ? "text-[oklch(0.55_0.14_65)]"
    : "text-foreground/70";
  return <span className={cn("text-[11px]", tone)} title={state.errorMessage ?? undefined}>{label}</span>;
}

function timeAgo(t: number): string {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
