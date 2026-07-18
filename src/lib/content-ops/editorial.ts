// Editorial blob shared shapes and pure helpers. The blob rides on
// social_content_items.editorial JSONB and is snapshotted verbatim into
// social_content_versions.editorial so revision history and restore always
// capture the full editorial context. Pure - no DB, no React, no I/O.

export const EDITORIAL_SCHEMA_VERSION = "northstar.contentops.editorial.v1";

export interface EditorialLink {
  url: string;
  label: string | null;
}

export interface EditorialSource {
  title: string;
  url: string | null;
  documentId: string | null;
}

export interface EditorialBlob {
  workingTitle: string | null;
  finalTitle: string | null;
  creativeBrief: string | null;
  designerNotes: string | null;
  samNotes: string | null;
  internalNotes: string | null;
  platformNotes: string | null;
  externalLinks: EditorialLink[];
  sourceDocuments: EditorialSource[];
  referenceUrls: string[];
  mentionedPeople: string[];
  mentionedCompanies: string[];
  mentionedBrands: string[];
  targetAudience: string | null;
  evergreenTopic: string | null;
  evergreenTags: string[];
}

export const EMPTY_EDITORIAL_BLOB: EditorialBlob = {
  workingTitle: null,
  finalTitle: null,
  creativeBrief: null,
  designerNotes: null,
  samNotes: null,
  internalNotes: null,
  platformNotes: null,
  externalLinks: [],
  sourceDocuments: [],
  referenceUrls: [],
  mentionedPeople: [],
  mentionedCompanies: [],
  mentionedBrands: [],
  targetAudience: null,
  evergreenTopic: null,
  evergreenTags: [],
};

const MAX_LIST = 50;
const MAX_STR = 4_000;
const MAX_URL = 2_048;

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > MAX_STR ? t.slice(0, MAX_STR) : t;
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (!t) continue;
    const norm = t.slice(0, 240);
    const key = norm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

function urlArray(v: unknown): string[] {
  return stringArray(v)
    .map((s) => (s.length > MAX_URL ? s.slice(0, MAX_URL) : s))
    .filter((s) => /^https?:\/\//i.test(s));
}

function linkArray(v: unknown): EditorialLink[] {
  if (!Array.isArray(v)) return [];
  const out: EditorialLink[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const url = trimOrNull((raw as { url?: unknown }).url);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const label = trimOrNull((raw as { label?: unknown }).label);
    out.push({ url: url.slice(0, MAX_URL), label });
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

function sourceArray(v: unknown): EditorialSource[] {
  if (!Array.isArray(v)) return [];
  const out: EditorialSource[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const title = trimOrNull(r.title);
    if (!title) continue;
    const url = trimOrNull(r.url);
    const documentId = trimOrNull(r.documentId);
    out.push({
      title,
      url: url && /^https?:\/\//i.test(url) ? url.slice(0, MAX_URL) : null,
      documentId,
    });
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

/**
 * Coerce an arbitrary JSON value (as it comes back from the DB) into a fully
 * shaped EditorialBlob. Unknown fields are dropped; malformed nested shapes
 * are ignored. Deterministic - identical inputs always return the same
 * output.
 */
export function normalizeEditorial(raw: unknown): EditorialBlob {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    workingTitle: trimOrNull(r.workingTitle),
    finalTitle: trimOrNull(r.finalTitle),
    creativeBrief: trimOrNull(r.creativeBrief),
    designerNotes: trimOrNull(r.designerNotes),
    samNotes: trimOrNull(r.samNotes),
    internalNotes: trimOrNull(r.internalNotes),
    platformNotes: trimOrNull(r.platformNotes),
    externalLinks: linkArray(r.externalLinks),
    sourceDocuments: sourceArray(r.sourceDocuments),
    referenceUrls: urlArray(r.referenceUrls),
    mentionedPeople: stringArray(r.mentionedPeople),
    mentionedCompanies: stringArray(r.mentionedCompanies),
    mentionedBrands: stringArray(r.mentionedBrands),
    targetAudience: trimOrNull(r.targetAudience),
    evergreenTopic: trimOrNull(r.evergreenTopic),
    evergreenTags: normalizeEvergreenTags(r.evergreenTags),
  };
}

/** Slugify + dedupe + cap. Used for both the editable input and the
 *  dedicated evergreen_tags[] column. */
export function normalizeEvergreenTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const slug = item
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64);
    if (!slug) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= 40) break;
  }
  return out;
}

/** Fields whose change forces approval revocation. Body/title/hook/cta live
 *  in dedicated columns and are already checked in saveVariant; this covers
 *  the editorial-blob members that also count as "the copy people approved". */
export const APPROVAL_MATERIAL_EDITORIAL_FIELDS = [
  "workingTitle",
  "finalTitle",
  "creativeBrief",
  "platformNotes",
] as const satisfies readonly (keyof EditorialBlob)[];

/**
 * True when any approval-material editorial field differs between two
 * normalized blobs. Used server-side to decide whether an in-place save
 * revokes an existing approval.
 */
export function editorialChangeRevokesApproval(
  before: EditorialBlob,
  after: EditorialBlob,
): boolean {
  for (const key of APPROVAL_MATERIAL_EDITORIAL_FIELDS) {
    const a = before[key];
    const b = after[key];
    if ((a ?? null) !== (b ?? null)) return true;
  }
  return false;
}

/** Stable, low-cost key used by the client's autosave dedupe. Same string
 *  for the same intent so the server can idempotently ignore a re-send. */
export function autosaveDedupeKey(args: {
  contentItemId: string;
  contentVersion: number;
  clientEditToken: string;
}): string {
  return `${args.contentItemId}:${args.contentVersion}:${args.clientEditToken}`;
}