// Design-time platform registry for the shared Content Operations editor.
//
// This is the SINGLE SOURCE OF TRUTH for what the editor knows about each
// destination: field support, hard limits, soft recommendations, preview
// shape. It is independent of any connector implementation - adapters
// advertise their runtime capabilities via `getCapabilities()`; if an
// adapter narrows a field at runtime, the adapter wins at publish time,
// but the editor still uses this registry to compose the UI.
//
// Adding a new destination (TikTok, Threads, Beehiiv, email, etc.) means
// adding one entry here; the editor, validation, preview, and side-by-side
// picker all pick it up automatically. No component changes required.

import type { SocialContentType, SocialPlatform } from "@/lib/constants";

// Editor-scoped destination key. Extends SocialPlatform with non-social
// surfaces (newsletter, transactional email) that share the editor.
export type EditorPlatform = SocialPlatform | "beehiiv" | "email";

export type FieldSupport = "supported" | "unsupported" | "optional";

export interface PlatformConfig {
  key: EditorPlatform;
  displayName: string;
  // High-level category the preview and validation use.
  category: "social" | "newsletter" | "email" | "community";

  // Field support: what the editor should render for this destination.
  fields: {
    title: FieldSupport;             // e.g., Reddit post title, Pinterest title, newsletter subject-adjacent
    hook: FieldSupport;              // rhetorical opener, not always sent to provider (composed into body)
    body: FieldSupport;              // always supported
    cta: FieldSupport;
    hashtags: FieldSupport;
    mentions: FieldSupport;
    linkUrl: FieldSupport;
    firstComment: FieldSupport;
    media: FieldSupport;
    altText: FieldSupport;
    newsletterSubject: FieldSupport;
    newsletterPreview: FieldSupport;
  };

  // Hard limits enforced as errors.
  limits: {
    bodyChars: number;              // hard cap
    titleChars: number;             // hard cap (0 if unsupported)
    hookChars: number;
    ctaChars: number;
    hashtagCount: number;           // hard cap; 0 if unsupported
    hashtagChars: number;           // per hashtag
    mentionCount: number;
    mediaCount: number;
    altTextChars: number;
    firstCommentChars: number;
    newsletterSubjectChars: number;
    newsletterPreviewChars: number;
  };

  // Softer guidance surfaced as warnings, not errors.
  recommendations: {
    idealBodyChars?: number;        // above this, warn "long for this platform"
    idealHashtagCount?: number;     // above this, warn "too many hashtags"
    linkPolicy?: "in_body" | "bio_only" | "not_recommended" | "supported";
  };

  // Which SocialContentTypes are allowed on this destination.
  contentTypes: readonly SocialContentType[];

  // Which media MIME types the destination accepts.
  mediaFormats: readonly string[];

  // Whether posting requires an operator-selected destination beyond the
  // connected account (subreddit, page, publication, IG account, etc.).
  requiresDestinationSelection: boolean;

  // Preview hint for the platform-shaped preview panel.
  previewShape: "feed" | "microblog" | "carousel" | "thread" | "community" | "newsletter" | "email";
}

// Character limits are deliberately conservative; adapter caps can narrow.
// Numbers are hard limits, not aspirational.
const P = (partial: PlatformConfig): PlatformConfig => partial;

export const PLATFORM_REGISTRY: Record<EditorPlatform, PlatformConfig> = {
  facebook: P({
    key: "facebook",
    displayName: "Facebook",
    category: "social",
    fields: {
      title: "unsupported", hook: "optional", body: "supported", cta: "optional",
      hashtags: "optional", mentions: "supported", linkUrl: "supported",
      firstComment: "supported", media: "supported", altText: "supported",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 63206, titleChars: 0, hookChars: 240, ctaChars: 240,
      hashtagCount: 30, hashtagChars: 100, mentionCount: 50, mediaCount: 10,
      altTextChars: 1000, firstCommentChars: 8000,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: { idealBodyChars: 400, idealHashtagCount: 3, linkPolicy: "in_body" },
    contentTypes: ["text", "image", "carousel", "short_video", "long_video", "link"],
    mediaFormats: ["image/jpeg", "image/png", "image/webp", "video/mp4"],
    requiresDestinationSelection: true, // Page selection
    previewShape: "feed",
  }),
  instagram: P({
    key: "instagram",
    displayName: "Instagram",
    category: "social",
    fields: {
      title: "unsupported", hook: "optional", body: "supported", cta: "optional",
      hashtags: "supported", mentions: "supported", linkUrl: "unsupported",
      firstComment: "supported", media: "supported", altText: "supported",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 2200, titleChars: 0, hookChars: 200, ctaChars: 200,
      hashtagCount: 30, hashtagChars: 100, mentionCount: 20, mediaCount: 10,
      altTextChars: 1000, firstCommentChars: 2200,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: { idealBodyChars: 1400, idealHashtagCount: 8, linkPolicy: "bio_only" },
    contentTypes: ["image", "carousel", "reel", "story", "short_video"],
    mediaFormats: ["image/jpeg", "image/png", "video/mp4", "video/quicktime"],
    requiresDestinationSelection: true, // IG business account selection
    previewShape: "feed",
  }),
  linkedin: P({
    key: "linkedin",
    displayName: "LinkedIn",
    category: "social",
    fields: {
      title: "optional", hook: "optional", body: "supported", cta: "optional",
      hashtags: "supported", mentions: "supported", linkUrl: "supported",
      firstComment: "supported", media: "supported", altText: "supported",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 3000, titleChars: 200, hookChars: 200, ctaChars: 200,
      hashtagCount: 20, hashtagChars: 100, mentionCount: 30, mediaCount: 9,
      altTextChars: 300, firstCommentChars: 1250,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: { idealBodyChars: 1300, idealHashtagCount: 3, linkPolicy: "in_body" },
    contentTypes: ["text", "image", "carousel", "article", "short_video", "long_video", "link"],
    mediaFormats: ["image/jpeg", "image/png", "application/pdf", "video/mp4"],
    requiresDestinationSelection: true, // Person vs Company Page
    previewShape: "feed",
  }),
  x: P({
    key: "x",
    displayName: "X",
    category: "social",
    fields: {
      title: "unsupported", hook: "optional", body: "supported", cta: "optional",
      hashtags: "supported", mentions: "supported", linkUrl: "supported",
      firstComment: "unsupported", media: "supported", altText: "supported",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 280, titleChars: 0, hookChars: 140, ctaChars: 140,
      hashtagCount: 5, hashtagChars: 100, mentionCount: 10, mediaCount: 4,
      altTextChars: 1000, firstCommentChars: 0,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: { idealBodyChars: 240, idealHashtagCount: 2, linkPolicy: "in_body" },
    contentTypes: ["text", "image", "thread", "short_video", "poll", "link"],
    mediaFormats: ["image/jpeg", "image/png", "image/gif", "video/mp4"],
    requiresDestinationSelection: false,
    previewShape: "microblog",
  }),
  reddit: P({
    key: "reddit",
    displayName: "Reddit",
    category: "community",
    fields: {
      title: "supported", hook: "unsupported", body: "supported", cta: "optional",
      hashtags: "unsupported", mentions: "supported", linkUrl: "supported",
      firstComment: "supported", media: "supported", altText: "supported",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 40000, titleChars: 300, hookChars: 0, ctaChars: 240,
      hashtagCount: 0, hashtagChars: 0, mentionCount: 20, mediaCount: 20,
      altTextChars: 1000, firstCommentChars: 10000,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: { idealBodyChars: 4000, linkPolicy: "supported" },
    contentTypes: ["text", "image", "link", "short_video", "community_post"],
    mediaFormats: ["image/jpeg", "image/png", "image/gif", "video/mp4"],
    requiresDestinationSelection: true, // subreddit selection
    previewShape: "community",
  }),
  threads: P({
    key: "threads",
    displayName: "Threads",
    category: "social",
    fields: {
      title: "unsupported", hook: "optional", body: "supported", cta: "optional",
      hashtags: "supported", mentions: "supported", linkUrl: "supported",
      firstComment: "unsupported", media: "supported", altText: "supported",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 500, titleChars: 0, hookChars: 200, ctaChars: 200,
      hashtagCount: 5, hashtagChars: 100, mentionCount: 20, mediaCount: 10,
      altTextChars: 1000, firstCommentChars: 0,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: { idealBodyChars: 400, idealHashtagCount: 1, linkPolicy: "in_body" },
    contentTypes: ["text", "image", "carousel", "short_video", "link"],
    mediaFormats: ["image/jpeg", "image/png", "video/mp4"],
    requiresDestinationSelection: false,
    previewShape: "microblog",
  }),
  tiktok: P({
    key: "tiktok",
    displayName: "TikTok",
    category: "social",
    fields: {
      title: "unsupported", hook: "optional", body: "supported", cta: "optional",
      hashtags: "supported", mentions: "supported", linkUrl: "unsupported",
      firstComment: "unsupported", media: "supported", altText: "unsupported",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 2200, titleChars: 0, hookChars: 150, ctaChars: 150,
      hashtagCount: 30, hashtagChars: 100, mentionCount: 20, mediaCount: 1,
      altTextChars: 0, firstCommentChars: 0,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: { idealBodyChars: 300, idealHashtagCount: 4, linkPolicy: "bio_only" },
    contentTypes: ["short_video", "long_video"],
    mediaFormats: ["video/mp4", "video/quicktime"],
    requiresDestinationSelection: false,
    previewShape: "feed",
  }),
  youtube: P({
    key: "youtube",
    displayName: "YouTube",
    category: "social",
    fields: {
      title: "supported", hook: "optional", body: "supported", cta: "optional",
      hashtags: "supported", mentions: "unsupported", linkUrl: "supported",
      firstComment: "supported", media: "supported", altText: "unsupported",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 5000, titleChars: 100, hookChars: 200, ctaChars: 200,
      hashtagCount: 15, hashtagChars: 100, mentionCount: 0, mediaCount: 1,
      altTextChars: 0, firstCommentChars: 10000,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: { idealBodyChars: 1200, idealHashtagCount: 5, linkPolicy: "in_body" },
    contentTypes: ["short_video", "long_video", "community_post", "image"],
    mediaFormats: ["video/mp4", "image/jpeg", "image/png"],
    requiresDestinationSelection: true,
    previewShape: "feed",
  }),
  pinterest: P({
    key: "pinterest",
    displayName: "Pinterest",
    category: "social",
    fields: {
      title: "supported", hook: "unsupported", body: "supported", cta: "optional",
      hashtags: "optional", mentions: "unsupported", linkUrl: "supported",
      firstComment: "unsupported", media: "supported", altText: "supported",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 500, titleChars: 100, hookChars: 0, ctaChars: 200,
      hashtagCount: 20, hashtagChars: 100, mentionCount: 0, mediaCount: 1,
      altTextChars: 500, firstCommentChars: 0,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: { idealBodyChars: 300, idealHashtagCount: 4, linkPolicy: "supported" },
    contentTypes: ["image", "short_video"],
    mediaFormats: ["image/jpeg", "image/png", "video/mp4"],
    requiresDestinationSelection: true, // board
    previewShape: "feed",
  }),
  bluesky: P({
    key: "bluesky",
    displayName: "Bluesky",
    category: "social",
    fields: {
      title: "unsupported", hook: "optional", body: "supported", cta: "optional",
      hashtags: "optional", mentions: "supported", linkUrl: "supported",
      firstComment: "unsupported", media: "supported", altText: "supported",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 300, titleChars: 0, hookChars: 120, ctaChars: 120,
      hashtagCount: 5, hashtagChars: 100, mentionCount: 10, mediaCount: 4,
      altTextChars: 1000, firstCommentChars: 0,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: { idealBodyChars: 260, idealHashtagCount: 2, linkPolicy: "in_body" },
    contentTypes: ["text", "image", "short_video", "link"],
    mediaFormats: ["image/jpeg", "image/png", "video/mp4"],
    requiresDestinationSelection: false,
    previewShape: "microblog",
  }),
  beehiiv: P({
    key: "beehiiv",
    displayName: "Beehiiv",
    category: "newsletter",
    fields: {
      title: "supported", hook: "supported", body: "supported", cta: "supported",
      hashtags: "unsupported", mentions: "unsupported", linkUrl: "supported",
      firstComment: "unsupported", media: "supported", altText: "supported",
      newsletterSubject: "supported", newsletterPreview: "supported",
    },
    limits: {
      bodyChars: 200000, titleChars: 200, hookChars: 400, ctaChars: 400,
      hashtagCount: 0, hashtagChars: 0, mentionCount: 0, mediaCount: 50,
      altTextChars: 1000, firstCommentChars: 0,
      newsletterSubjectChars: 150, newsletterPreviewChars: 150,
    },
    recommendations: { idealBodyChars: 8000, linkPolicy: "supported" },
    contentTypes: ["article", "text", "link"],
    mediaFormats: ["image/jpeg", "image/png", "image/webp"],
    requiresDestinationSelection: true, // publication
    previewShape: "newsletter",
  }),
  email: P({
    key: "email",
    displayName: "Email",
    category: "email",
    fields: {
      title: "supported", hook: "supported", body: "supported", cta: "supported",
      hashtags: "unsupported", mentions: "unsupported", linkUrl: "supported",
      firstComment: "unsupported", media: "supported", altText: "supported",
      newsletterSubject: "supported", newsletterPreview: "supported",
    },
    limits: {
      bodyChars: 200000, titleChars: 200, hookChars: 400, ctaChars: 400,
      hashtagCount: 0, hashtagChars: 0, mentionCount: 0, mediaCount: 20,
      altTextChars: 1000, firstCommentChars: 0,
      newsletterSubjectChars: 150, newsletterPreviewChars: 150,
    },
    recommendations: { idealBodyChars: 4000, linkPolicy: "supported" },
    contentTypes: ["text", "article", "link"],
    mediaFormats: ["image/jpeg", "image/png"],
    requiresDestinationSelection: true,
    previewShape: "email",
  }),
  other: P({
    key: "other",
    displayName: "Other",
    category: "social",
    fields: {
      title: "optional", hook: "optional", body: "supported", cta: "optional",
      hashtags: "optional", mentions: "optional", linkUrl: "optional",
      firstComment: "unsupported", media: "optional", altText: "optional",
      newsletterSubject: "unsupported", newsletterPreview: "unsupported",
    },
    limits: {
      bodyChars: 10000, titleChars: 300, hookChars: 500, ctaChars: 500,
      hashtagCount: 20, hashtagChars: 100, mentionCount: 20, mediaCount: 10,
      altTextChars: 1000, firstCommentChars: 4000,
      newsletterSubjectChars: 0, newsletterPreviewChars: 0,
    },
    recommendations: {},
    contentTypes: ["text", "image", "link", "other"],
    mediaFormats: ["image/jpeg", "image/png", "video/mp4"],
    requiresDestinationSelection: false,
    previewShape: "feed",
  }),
};

export function getPlatformConfig(platform: string): PlatformConfig {
  const p = (PLATFORM_REGISTRY as Record<string, PlatformConfig | undefined>)[platform];
  return p ?? PLATFORM_REGISTRY.other;
}

export function listEditorPlatforms(): PlatformConfig[] {
  return Object.values(PLATFORM_REGISTRY);
}

// Well-known "promotion" classifications the editor exposes as a discrete
// dropdown. Free-form is intentionally NOT allowed here to keep learning
// signals categorical.
export const PROMOTION_CLASSIFICATIONS = [
  "education",
  "story",
  "commentary",
  "engagement",
  "product",
  "offer",
  "announcement",
  "recruitment",
] as const;
export type PromotionClassification = (typeof PROMOTION_CLASSIFICATIONS)[number];

export const REGISTRY_VERSION = "northstar.contentops.editor.registry.v1";
