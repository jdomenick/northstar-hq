// Deterministic per-variant validation for the shared Content Operations
// editor. Pure functions - no network, no DB, no React. The same module is
// consumed by the client editor (live feedback), by server-side save/submit
// gates, and by the future publish gate. Rules are versioned so audit
// records can pin the exact ruleset that graded a variant.

import { getPlatformConfig, type EditorPlatform, type PlatformConfig } from "./platform-registry";

export const EDITOR_VALIDATION_VERSION = "northstar.contentops.editor.validation.v1";

export type ValidationSeverity = "error" | "warning" | "info";
export type ValidationField =
  | "title" | "hook" | "body" | "cta" | "hashtags" | "mentions"
  | "linkUrl" | "firstComment" | "media" | "altText"
  | "newsletterSubject" | "newsletterPreview"
  | "duplicate" | "structure";

export interface ValidationIssue {
  id: string;
  field: ValidationField;
  severity: ValidationSeverity;
  message: string;
  ruleId: string;
  detail?: Record<string, unknown>;
}

export interface ValidationInput {
  platform: EditorPlatform;
  contentType: string;
  title: string | null;
  hook: string | null;
  body: string;
  cta: string | null;
  hashtags: string[];
  mentions: string[];
  linkUrl: string | null;
  firstComment: string | null;
  altText: string | null;
  newsletterSubject: string | null;
  newsletterPreview: string | null;
  media: Array<{ storageRef: string; mimeType: string; altText: string | null }>;
  // Non-editor context passed through for cross-field rules.
  duplicateOfContentItemId?: string | null;
}

export interface ValidationResult {
  platform: EditorPlatform;
  version: string;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  blocksSubmit: boolean;
  blocksApprove: boolean;
}

function issue(
  id: string,
  field: ValidationField,
  severity: ValidationSeverity,
  message: string,
  ruleId: string,
  detail?: Record<string, unknown>,
): ValidationIssue {
  return { id, field, severity, message, ruleId, detail };
}

function graphemeLength(s: string): number {
  // Reasonably accurate visible-length for validation. Intl.Segmenter is
  // widely available in modern runtimes; we fall back to code-point length
  // when unavailable so tests remain deterministic.
  const seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<unknown> } }).Segmenter;
  if (seg) {
    const it = new seg("en", { granularity: "grapheme" }).segment(s);
    let n = 0;
    for (const _ of it) n++;
    return n;
  }
  return Array.from(s).length;
}

function validateHashtag(tag: string, cfg: PlatformConfig): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const trimmed = tag.trim();
  if (!trimmed) {
    out.push(issue("hashtag_empty", "hashtags", "error", "Hashtag is empty.", "hashtag.empty"));
    return out;
  }
  if (!/^#?[\p{L}\p{N}_]+$/u.test(trimmed)) {
    out.push(issue(
      `hashtag_invalid:${trimmed}`,
      "hashtags",
      "error",
      `"${trimmed}" is not a valid hashtag. Use letters, numbers, and underscores only.`,
      "hashtag.format",
    ));
  }
  if (graphemeLength(trimmed) > cfg.limits.hashtagChars) {
    out.push(issue(
      `hashtag_toolong:${trimmed}`,
      "hashtags",
      "error",
      `Hashtag exceeds ${cfg.limits.hashtagChars} characters on ${cfg.displayName}.`,
      "hashtag.length",
    ));
  }
  return out;
}

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Run the full deterministic ruleset against one variant.
 * `blocksSubmit` is true if any error is present. `blocksApprove` mirrors
 * that today; kept separate so future stages can differentiate.
 */
export function validateVariant(input: ValidationInput): ValidationResult {
  const cfg = getPlatformConfig(input.platform);
  const issues: ValidationIssue[] = [];

  // ---- body ---------------------------------------------------------------
  const bodyLen = graphemeLength(input.body);
  if (bodyLen === 0) {
    issues.push(issue("body_empty", "body", "error", "Body is empty.", "body.empty"));
  } else if (bodyLen > cfg.limits.bodyChars) {
    issues.push(issue(
      "body_overlimit", "body", "error",
      `Body is ${bodyLen} characters. ${cfg.displayName} allows ${cfg.limits.bodyChars}.`,
      "body.length.hard",
      { bodyLen, limit: cfg.limits.bodyChars },
    ));
  } else if (cfg.recommendations.idealBodyChars && bodyLen > cfg.recommendations.idealBodyChars) {
    issues.push(issue(
      "body_longforplatform", "body", "warning",
      `Body is ${bodyLen} characters. ${cfg.displayName} performs best under ${cfg.recommendations.idealBodyChars}.`,
      "body.length.soft",
      { bodyLen, ideal: cfg.recommendations.idealBodyChars },
    ));
  }

  // ---- title --------------------------------------------------------------
  if (input.title && cfg.fields.title === "unsupported") {
    issues.push(issue("title_unsupported", "title", "warning",
      `${cfg.displayName} does not use a title; it will be dropped on publish.`,
      "title.unsupported"));
  }
  if (input.title && graphemeLength(input.title) > cfg.limits.titleChars) {
    issues.push(issue("title_overlimit", "title", "error",
      `Title exceeds ${cfg.limits.titleChars} characters on ${cfg.displayName}.`,
      "title.length.hard"));
  }
  if (!input.title && cfg.fields.title === "supported" && cfg.previewShape === "community") {
    issues.push(issue("title_missing", "title", "error",
      `${cfg.displayName} requires a post title.`,
      "title.required"));
  }

  // ---- hook / cta ---------------------------------------------------------
  if (input.hook && graphemeLength(input.hook) > cfg.limits.hookChars) {
    issues.push(issue("hook_overlimit", "hook", "warning",
      `Hook exceeds ${cfg.limits.hookChars} characters.`, "hook.length"));
  }
  if (input.cta && graphemeLength(input.cta) > cfg.limits.ctaChars) {
    issues.push(issue("cta_overlimit", "cta", "warning",
      `CTA exceeds ${cfg.limits.ctaChars} characters.`, "cta.length"));
  }

  // ---- hashtags -----------------------------------------------------------
  if (input.hashtags.length > 0 && cfg.fields.hashtags === "unsupported") {
    issues.push(issue("hashtags_unsupported", "hashtags", "warning",
      `${cfg.displayName} does not use hashtags; they will be dropped on publish.`,
      "hashtags.unsupported"));
  } else {
    if (input.hashtags.length > cfg.limits.hashtagCount) {
      issues.push(issue("hashtag_count_over", "hashtags", "error",
        `${input.hashtags.length} hashtags exceeds ${cfg.displayName}'s limit of ${cfg.limits.hashtagCount}.`,
        "hashtags.count.hard"));
    } else if (
      cfg.recommendations.idealHashtagCount != null &&
      input.hashtags.length > cfg.recommendations.idealHashtagCount
    ) {
      issues.push(issue("hashtag_count_soft", "hashtags", "warning",
        `Consider fewer hashtags. ${cfg.displayName} performs best with under ${cfg.recommendations.idealHashtagCount}.`,
        "hashtags.count.soft"));
    }
    const dupTracker = new Set<string>();
    for (const tag of input.hashtags) {
      const norm = tag.replace(/^#/, "").toLowerCase();
      if (dupTracker.has(norm)) {
        issues.push(issue(`hashtag_dup:${norm}`, "hashtags", "warning",
          `Duplicate hashtag "${tag}".`, "hashtags.duplicate"));
      } else {
        dupTracker.add(norm);
      }
      issues.push(...validateHashtag(tag, cfg));
    }
  }

  // ---- mentions -----------------------------------------------------------
  if (input.mentions.length > 0 && cfg.fields.mentions === "unsupported") {
    issues.push(issue("mentions_unsupported", "mentions", "warning",
      `${cfg.displayName} does not support mentions; they will be dropped.`,
      "mentions.unsupported"));
  } else if (input.mentions.length > cfg.limits.mentionCount) {
    issues.push(issue("mentions_over", "mentions", "error",
      `${input.mentions.length} mentions exceeds ${cfg.displayName}'s limit of ${cfg.limits.mentionCount}.`,
      "mentions.count"));
  }
  for (const m of input.mentions) {
    if (!/^@?[A-Za-z0-9_./-]{1,64}$/.test(m.trim())) {
      issues.push(issue(`mention_invalid:${m}`, "mentions", "error",
        `"${m}" is not a valid mention handle.`, "mentions.format"));
    }
  }

  // ---- linkUrl ------------------------------------------------------------
  if (input.linkUrl) {
    if (cfg.fields.linkUrl === "unsupported") {
      issues.push(issue("link_unsupported", "linkUrl", "warning",
        `${cfg.displayName} does not attach links; move it to the bio or drop it.`,
        "link.unsupported"));
    } else if (!isSafeUrl(input.linkUrl)) {
      issues.push(issue("link_bad", "linkUrl", "error",
        "Link must be an http(s) URL.", "link.scheme"));
    } else if (cfg.recommendations.linkPolicy === "bio_only") {
      issues.push(issue("link_bio_only", "linkUrl", "warning",
        `Links do not click through on ${cfg.displayName}; consider "link in bio" phrasing.`,
        "link.bio_only"));
    }
  }

  // ---- first comment ------------------------------------------------------
  if (input.firstComment && cfg.fields.firstComment === "unsupported") {
    issues.push(issue("firstcomment_unsupported", "firstComment", "warning",
      `${cfg.displayName} does not post a separate first comment.`,
      "firstComment.unsupported"));
  } else if (input.firstComment && graphemeLength(input.firstComment) > cfg.limits.firstCommentChars) {
    issues.push(issue("firstcomment_over", "firstComment", "error",
      `First comment exceeds ${cfg.limits.firstCommentChars} characters.`,
      "firstComment.length"));
  }

  // ---- media --------------------------------------------------------------
  if (input.media.length > 0 && cfg.fields.media === "unsupported") {
    issues.push(issue("media_unsupported", "media", "warning",
      `${cfg.displayName} does not accept media on this content type.`,
      "media.unsupported"));
  }
  if (input.media.length > cfg.limits.mediaCount) {
    issues.push(issue("media_count", "media", "error",
      `${input.media.length} media items exceeds ${cfg.displayName}'s limit of ${cfg.limits.mediaCount}.`,
      "media.count"));
  }
  for (const m of input.media) {
    if (cfg.mediaFormats.length && !cfg.mediaFormats.includes(m.mimeType)) {
      issues.push(issue(`media_format:${m.storageRef}`, "media", "error",
        `${cfg.displayName} does not accept ${m.mimeType}.`, "media.format",
        { accepted: cfg.mediaFormats }));
    }
    if (cfg.fields.altText === "supported" && !m.altText) {
      issues.push(issue(`media_alt:${m.storageRef}`, "altText", "warning",
        "Media is missing alt text (accessibility).", "media.altText.missing"));
    }
    if (m.altText && graphemeLength(m.altText) > cfg.limits.altTextChars) {
      issues.push(issue(`media_alt_over:${m.storageRef}`, "altText", "error",
        `Alt text exceeds ${cfg.limits.altTextChars} characters on ${cfg.displayName}.`,
        "media.altText.length"));
    }
  }
  // Missing media for a content type that requires it.
  const requiresMedia =
    ["image", "carousel", "reel", "short_video", "long_video", "story"].includes(input.contentType);
  if (requiresMedia && input.media.length === 0) {
    issues.push(issue("media_missing", "media", "error",
      `Content type "${input.contentType}" requires at least one media attachment.`,
      "media.required"));
  }

  // ---- newsletter fields --------------------------------------------------
  if (cfg.fields.newsletterSubject === "supported") {
    if (!input.newsletterSubject) {
      issues.push(issue("subject_missing", "newsletterSubject", "error",
        `${cfg.displayName} requires a subject line.`, "newsletter.subject.required"));
    } else if (graphemeLength(input.newsletterSubject) > cfg.limits.newsletterSubjectChars) {
      issues.push(issue("subject_over", "newsletterSubject", "error",
        `Subject exceeds ${cfg.limits.newsletterSubjectChars} characters.`,
        "newsletter.subject.length"));
    }
  }
  if (cfg.fields.newsletterPreview === "supported" && input.newsletterPreview
      && graphemeLength(input.newsletterPreview) > cfg.limits.newsletterPreviewChars) {
    issues.push(issue("preview_over", "newsletterPreview", "error",
      `Preview text exceeds ${cfg.limits.newsletterPreviewChars} characters.`,
      "newsletter.preview.length"));
  }

  // ---- content type allowed on platform ----------------------------------
  if (!cfg.contentTypes.includes(input.contentType as (typeof cfg.contentTypes)[number])) {
    issues.push(issue("contenttype_bad", "structure", "error",
      `${cfg.displayName} does not accept content type "${input.contentType}".`,
      "contentType.unsupported",
      { accepted: cfg.contentTypes }));
  }

  // ---- duplicate ----------------------------------------------------------
  if (input.duplicateOfContentItemId) {
    issues.push(issue("duplicate_of", "duplicate", "warning",
      "A near-identical variant already exists for this venture.",
      "duplicate.fingerprint",
      { duplicateOfContentItemId: input.duplicateOfContentItemId }));
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  return {
    platform: input.platform,
    version: EDITOR_VALIDATION_VERSION,
    issues,
    errorCount,
    warningCount,
    infoCount,
    blocksSubmit: errorCount > 0,
    blocksApprove: errorCount > 0,
  };
}

/** Convenience for computing a live character count against the hard cap. */
export function bodyCharBudget(platform: EditorPlatform, body: string): { used: number; limit: number; remaining: number } {
  const cfg = getPlatformConfig(platform);
  const used = graphemeLength(body);
  return { used, limit: cfg.limits.bodyChars, remaining: cfg.limits.bodyChars - used };
}
