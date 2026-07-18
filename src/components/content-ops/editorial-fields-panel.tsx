// Editorial workspace fields (S1f-2b). Renders working title, final title,
// creative brief (rich text), designer/SAM/internal notes, external links,
// source documents, mentioned entities, evergreen topic + tags, and target
// audience. Every field flows into the same EditorialBlob the server
// normalizes on save, so nothing here is presentation-only.

import { useState } from "react";
import { QuietPanel, SectionLabel } from "@/components/editorial";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { RichTextEditor } from "./rich-text-editor";

export interface EditorialDraft {
  workingTitle: string;
  finalTitle: string;
  creativeBrief: string;
  designerNotes: string;
  samNotes: string;
  internalNotes: string;
  platformNotes: string;
  externalLinksText: string;   // one "label|url" per line
  sourceDocumentsText: string; // one "title|url" per line
  referenceUrlsText: string;
  mentionedPeople: string[];
  mentionedCompanies: string[];
  mentionedBrands: string[];
  targetAudience: string;
  evergreenTopic: string;
  evergreenTags: string[];
}

export const EMPTY_EDITORIAL_DRAFT: EditorialDraft = {
  workingTitle: "",
  finalTitle: "",
  creativeBrief: "",
  designerNotes: "",
  samNotes: "",
  internalNotes: "",
  platformNotes: "",
  externalLinksText: "",
  sourceDocumentsText: "",
  referenceUrlsText: "",
  mentionedPeople: [],
  mentionedCompanies: [],
  mentionedBrands: [],
  targetAudience: "",
  evergreenTopic: "",
  evergreenTags: [],
};

/** Parse the DB editorial JSONB blob into the local draft shape. */
export function editorialFromRow(raw: unknown): EditorialDraft {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") as string[] : []);
  const linkList = (v: unknown) =>
    Array.isArray(v)
      ? v
          .filter((x) => x && typeof x === "object")
          .map((x) => {
            const o = x as { url?: string; label?: string | null };
            return `${o.label ?? ""}|${o.url ?? ""}`.replace(/^\|/, "");
          })
          .join("\n")
      : "";
  const sourceList = (v: unknown) =>
    Array.isArray(v)
      ? v
          .filter((x) => x && typeof x === "object")
          .map((x) => {
            const o = x as { title?: string; url?: string | null };
            return `${o.title ?? ""}|${o.url ?? ""}`.replace(/\|$/, "");
          })
          .join("\n")
      : "";
  return {
    workingTitle: (r.workingTitle as string) ?? "",
    finalTitle: (r.finalTitle as string) ?? "",
    creativeBrief: (r.creativeBrief as string) ?? "",
    designerNotes: (r.designerNotes as string) ?? "",
    samNotes: (r.samNotes as string) ?? "",
    internalNotes: (r.internalNotes as string) ?? "",
    platformNotes: (r.platformNotes as string) ?? "",
    externalLinksText: linkList(r.externalLinks),
    sourceDocumentsText: sourceList(r.sourceDocuments),
    referenceUrlsText: strList(r.referenceUrls).join("\n"),
    mentionedPeople: strList(r.mentionedPeople),
    mentionedCompanies: strList(r.mentionedCompanies),
    mentionedBrands: strList(r.mentionedBrands),
    targetAudience: (r.targetAudience as string) ?? "",
    evergreenTopic: (r.evergreenTopic as string) ?? "",
    evergreenTags: strList(r.evergreenTags),
  };
}

/** Serialize the local draft into the server EditorialBlob input shape. */
export function editorialToPayload(d: EditorialDraft) {
  const parseLinks = (text: string) =>
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [labelOrUrl, url] = line.split("|").map((s) => s.trim());
        return url
          ? { url, label: labelOrUrl || null }
          : { url: labelOrUrl, label: null };
      })
      .filter((l) => /^https?:\/\//i.test(l.url));
  const parseSources = (text: string) =>
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title, url] = line.split("|").map((s) => s.trim());
        return { title: title || "Untitled", url: url || null };
      })
      .filter((s) => !!s.title);
  const parseUrls = (text: string) =>
    text.split(/\n+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s));
  return {
    workingTitle: d.workingTitle || null,
    finalTitle: d.finalTitle || null,
    creativeBrief: d.creativeBrief || null,
    designerNotes: d.designerNotes || null,
    samNotes: d.samNotes || null,
    internalNotes: d.internalNotes || null,
    platformNotes: d.platformNotes || null,
    externalLinks: parseLinks(d.externalLinksText),
    sourceDocuments: parseSources(d.sourceDocumentsText),
    referenceUrls: parseUrls(d.referenceUrlsText),
    mentionedPeople: d.mentionedPeople,
    mentionedCompanies: d.mentionedCompanies,
    mentionedBrands: d.mentionedBrands,
    targetAudience: d.targetAudience || null,
    evergreenTopic: d.evergreenTopic || null,
    evergreenTags: d.evergreenTags,
  };
}

const shared = "block w-full border border-foreground/15 bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-foreground/35 focus:border-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

function TextField({ label, value, onChange, disabled, placeholder, hint, multiline, minRows, maxHint }: {
  label: string; value: string; onChange: (v: string) => void;
  disabled?: boolean; placeholder?: string; hint?: string;
  multiline?: boolean; minRows?: number; maxHint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/70">{label}</span>
        {maxHint && <span className="text-[10.5px] text-foreground/50">{maxHint}</span>}
      </div>
      {multiline ? (
        <textarea rows={minRows ?? 3} className={cn(shared, "resize-y font-body leading-relaxed")}
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
      ) : (
        <input type="text" className={shared} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
      )}
      {hint && <div className="mt-1 text-[11.5px] text-foreground/55">{hint}</div>}
    </label>
  );
}

function TagListField({ label, values, onChange, disabled, placeholder, hint }: {
  label: string; values: string[]; onChange: (next: string[]) => void;
  disabled?: boolean; placeholder?: string; hint?: string;
}) {
  const [input, setInput] = useState("");
  const commit = () => {
    const t = input.trim();
    if (!t) return;
    if (values.some((v) => v.toLowerCase() === t.toLowerCase())) { setInput(""); return; }
    onChange([...values, t].slice(0, 50));
    setInput("");
  };
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span key={`${v}:${i}`} className="inline-flex items-center gap-1 border border-foreground/15 bg-foreground/[0.03] px-2 py-0.5 text-[12px] text-foreground/85">
            {v}
            <button type="button" disabled={disabled} onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="text-foreground/50 hover:text-[oklch(0.5_0.18_27)]" aria-label={`Remove ${v}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {values.length === 0 && <span className="text-[12px] text-foreground/40">None yet.</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="text" value={input} disabled={disabled} placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); } }}
          onBlur={commit}
          className={cn(shared, "!py-1.5 !text-[13px]")}
        />
        <button type="button" disabled={disabled} onClick={commit} className="inline-flex items-center gap-1 border border-foreground/25 px-2 text-[11px] uppercase tracking-[0.2em] text-foreground/80 hover:border-foreground/60">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      {hint && <div className="mt-1 text-[11.5px] text-foreground/55">{hint}</div>}
    </div>
  );
}

interface EvergreenTopic { id: string; slug: string; label: string; category: string | null }

export function EditorialFieldsPanel({
  value, onChange, disabled, topics,
}: {
  value: EditorialDraft;
  onChange: (next: EditorialDraft) => void;
  disabled?: boolean;
  topics: EvergreenTopic[];
}) {
  const set = <K extends keyof EditorialDraft>(k: K, v: EditorialDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <QuietPanel className="!p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <SectionLabel>Editorial workspace</SectionLabel>
        <span className="text-[10.5px] uppercase tracking-[0.2em] text-foreground/45">Applies to all variants</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Working title" value={value.workingTitle} onChange={(v) => set("workingTitle", v)}
          disabled={disabled} hint="Internal working name; not published." maxHint="Max 500" />
        <TextField label="Final published title" value={value.finalTitle} onChange={(v) => set("finalTitle", v)}
          disabled={disabled} hint="Locked-in title used at publish time." maxHint="Max 500" />
      </div>

      <div className="mt-6">
        <SectionLabel>Creative brief</SectionLabel>
        <div className="mt-2">
          <RichTextEditor value={value.creativeBrief} onChange={(v) => set("creativeBrief", v)} disabled={disabled} minRows={5} ariaLabel="Creative brief" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <TextField label="Designer notes" value={value.designerNotes} onChange={(v) => set("designerNotes", v)} disabled={disabled} multiline minRows={4} />
        <TextField label="SAM notes" value={value.samNotes} onChange={(v) => set("samNotes", v)} disabled={disabled} multiline minRows={4} />
        <TextField label="Internal notes" value={value.internalNotes} onChange={(v) => set("internalNotes", v)} disabled={disabled} multiline minRows={4} />
      </div>

      <div className="mt-6">
        <TextField label="Platform notes" value={value.platformNotes} onChange={(v) => set("platformNotes", v)} disabled={disabled} multiline minRows={3}
          hint="Notes specific to how variants should differ per destination." />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <TextField label="External links" value={value.externalLinksText} onChange={(v) => set("externalLinksText", v)} disabled={disabled} multiline minRows={3}
          placeholder={"Label | https://example.com\nhttps://another.example"} hint="One per line. Format: Label | URL." />
        <TextField label="Source documents" value={value.sourceDocumentsText} onChange={(v) => set("sourceDocumentsText", v)} disabled={disabled} multiline minRows={3}
          placeholder="Doc title | https://link" hint="One per line. Format: Title | URL (URL optional)." />
      </div>

      <div className="mt-6">
        <TextField label="Reference URLs" value={value.referenceUrlsText} onChange={(v) => set("referenceUrlsText", v)} disabled={disabled} multiline minRows={3}
          placeholder="https://..." hint="One URL per line." />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <TagListField label="Mentioned people" values={value.mentionedPeople} onChange={(v) => set("mentionedPeople", v)} disabled={disabled} placeholder="Name" />
        <TagListField label="Mentioned companies" values={value.mentionedCompanies} onChange={(v) => set("mentionedCompanies", v)} disabled={disabled} placeholder="Company" />
        <TagListField label="Mentioned brands" values={value.mentionedBrands} onChange={(v) => set("mentionedBrands", v)} disabled={disabled} placeholder="Brand" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <TextField label="Target audience" value={value.targetAudience} onChange={(v) => set("targetAudience", v)} disabled={disabled} multiline minRows={2}
          hint="Who is this for? Who should it resonate with?" />
        <label className="block">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/70">Evergreen topic</span>
            <span className="text-[10.5px] text-foreground/50">{topics.length} available</span>
          </div>
          <select
            className={shared}
            value={value.evergreenTopic}
            onChange={(e) => set("evergreenTopic", e.target.value)}
            disabled={disabled}
          >
            <option value="">(unclassified)</option>
            {topics.map((t) => <option key={t.id} value={t.slug}>{t.label}</option>)}
          </select>
          <div className="mt-1 text-[11.5px] text-foreground/55">Anchors this piece to a long-lived theme.</div>
        </label>
      </div>

      <div className="mt-6">
        <TagListField label="Evergreen tags" values={value.evergreenTags} onChange={(v) => set("evergreenTags", v)} disabled={disabled}
          placeholder="Childhood trauma"
          hint="Reusable content pillar tags (slugified server-side)." />
      </div>
    </QuietPanel>
  );
}
