// Platform-specific media constraints. Registry-driven; no hardcoded limits
// scattered across the app. Every publishing destination declares its media
// requirements here and the shared validator and UI both read from this file.

import type { EditorPlatform } from "./platform-registry";

export type MediaKind = "image" | "video" | "carousel_image" | "thumbnail" | "document" | "audio" | "other";

export type AspectRatioClass = "square" | "portrait" | "landscape" | "story" | "widescreen" | "any";

export interface AspectSpec {
  label: AspectRatioClass;
  ratio: number;         // width / height
  tolerance: number;     // e.g. 0.05 = 5%
}

export interface MediaConstraint {
  kind: MediaKind;
  formats: readonly string[];              // MIME allowlist
  maxBytes: number;                        // hard cap
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  minDurationSeconds?: number;             // video only
  maxDurationSeconds?: number;             // video only
  aspects?: readonly AspectSpec[];         // acceptable aspect ratios; empty = any
  altTextRequired?: boolean;
  altTextRecommended?: boolean;
}

export interface PlatformMediaSpec {
  platform: EditorPlatform;
  imageCountMin: number;
  imageCountMax: number;
  videoCountMax: number;
  allowsMixed: boolean;                    // images + video in the same post
  constraints: {
    image?: MediaConstraint;
    video?: MediaConstraint;
    thumbnail?: MediaConstraint;
  };
}

// Reusable aspect specs.
const SQUARE: AspectSpec = { label: "square", ratio: 1, tolerance: 0.02 };
const PORTRAIT_45: AspectSpec = { label: "portrait", ratio: 4 / 5, tolerance: 0.03 };
const LANDSCAPE_191: AspectSpec = { label: "landscape", ratio: 1.91, tolerance: 0.05 };
const LANDSCAPE_169: AspectSpec = { label: "widescreen", ratio: 16 / 9, tolerance: 0.03 };
const STORY_916: AspectSpec = { label: "story", ratio: 9 / 16, tolerance: 0.02 };

const MB = (n: number) => n * 1024 * 1024;

// Conservative, published-provider-documented caps.
// Adapters may narrow at runtime; the editor uses these to warn early.
export const PLATFORM_MEDIA_SPECS: Record<EditorPlatform, PlatformMediaSpec> = {
  facebook: {
    platform: "facebook", imageCountMin: 0, imageCountMax: 10, videoCountMax: 1, allowsMixed: false,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png","image/webp"], maxBytes: MB(30), minWidth: 600, minHeight: 315, aspects: [SQUARE, PORTRAIT_45, LANDSCAPE_191], altTextRecommended: true },
      video: { kind: "video", formats: ["video/mp4"], maxBytes: MB(4000), minDurationSeconds: 1, maxDurationSeconds: 240 * 60, aspects: [SQUARE, PORTRAIT_45, LANDSCAPE_169] },
    },
  },
  instagram: {
    platform: "instagram", imageCountMin: 1, imageCountMax: 10, videoCountMax: 1, allowsMixed: true,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png"], maxBytes: MB(30), minWidth: 320, minHeight: 320, aspects: [SQUARE, PORTRAIT_45, LANDSCAPE_191], altTextRecommended: true },
      video: { kind: "video", formats: ["video/mp4","video/quicktime"], maxBytes: MB(1000), minDurationSeconds: 3, maxDurationSeconds: 90 * 60, aspects: [SQUARE, PORTRAIT_45, STORY_916] },
    },
  },
  linkedin: {
    platform: "linkedin", imageCountMin: 0, imageCountMax: 9, videoCountMax: 1, allowsMixed: false,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png"], maxBytes: MB(10), minWidth: 400, minHeight: 400, aspects: [SQUARE, LANDSCAPE_191, LANDSCAPE_169], altTextRequired: true },
      video: { kind: "video", formats: ["video/mp4"], maxBytes: MB(5000), minDurationSeconds: 3, maxDurationSeconds: 30 * 60, aspects: [SQUARE, LANDSCAPE_169, STORY_916] },
    },
  },
  x: {
    platform: "x", imageCountMin: 0, imageCountMax: 4, videoCountMax: 1, allowsMixed: false,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png","image/gif"], maxBytes: MB(5), minWidth: 200, minHeight: 200, altTextRecommended: true },
      video: { kind: "video", formats: ["video/mp4"], maxBytes: MB(512), minDurationSeconds: 1, maxDurationSeconds: 140 },
    },
  },
  reddit: {
    platform: "reddit", imageCountMin: 0, imageCountMax: 20, videoCountMax: 1, allowsMixed: false,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png","image/gif"], maxBytes: MB(20), altTextRecommended: true },
      video: { kind: "video", formats: ["video/mp4"], maxBytes: MB(1000), maxDurationSeconds: 15 * 60 },
    },
  },
  threads: {
    platform: "threads", imageCountMin: 0, imageCountMax: 10, videoCountMax: 1, allowsMixed: false,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png"], maxBytes: MB(8), minWidth: 320, minHeight: 320, aspects: [SQUARE, PORTRAIT_45, LANDSCAPE_191], altTextRecommended: true },
      video: { kind: "video", formats: ["video/mp4"], maxBytes: MB(500), maxDurationSeconds: 5 * 60, aspects: [SQUARE, PORTRAIT_45, STORY_916] },
    },
  },
  tiktok: {
    platform: "tiktok", imageCountMin: 0, imageCountMax: 0, videoCountMax: 1, allowsMixed: false,
    constraints: {
      video: { kind: "video", formats: ["video/mp4","video/quicktime"], maxBytes: MB(4000), minDurationSeconds: 3, maxDurationSeconds: 10 * 60, aspects: [STORY_916, SQUARE] },
    },
  },
  youtube: {
    platform: "youtube", imageCountMin: 0, imageCountMax: 1, videoCountMax: 1, allowsMixed: true,
    constraints: {
      video: { kind: "video", formats: ["video/mp4"], maxBytes: MB(128 * 1024), maxDurationSeconds: 12 * 60 * 60, aspects: [LANDSCAPE_169, STORY_916] },
      image: { kind: "image", formats: ["image/jpeg","image/png"], maxBytes: MB(2), aspects: [LANDSCAPE_169] },
      thumbnail: { kind: "thumbnail", formats: ["image/jpeg","image/png"], maxBytes: MB(2), aspects: [LANDSCAPE_169] },
    },
  },
  pinterest: {
    platform: "pinterest", imageCountMin: 1, imageCountMax: 1, videoCountMax: 1, allowsMixed: false,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png"], maxBytes: MB(20), minWidth: 600, aspects: [{ label: "portrait", ratio: 2 / 3, tolerance: 0.05 }, SQUARE], altTextRecommended: true },
      video: { kind: "video", formats: ["video/mp4"], maxBytes: MB(2000), maxDurationSeconds: 15 * 60 },
    },
  },
  bluesky: {
    platform: "bluesky", imageCountMin: 0, imageCountMax: 4, videoCountMax: 1, allowsMixed: false,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png"], maxBytes: MB(1), altTextRecommended: true },
      video: { kind: "video", formats: ["video/mp4"], maxBytes: MB(50), maxDurationSeconds: 60 },
    },
  },
  beehiiv: {
    platform: "beehiiv", imageCountMin: 0, imageCountMax: 50, videoCountMax: 0, allowsMixed: false,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png","image/webp"], maxBytes: MB(10), altTextRequired: true },
    },
  },
  email: {
    platform: "email", imageCountMin: 0, imageCountMax: 20, videoCountMax: 0, allowsMixed: false,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png"], maxBytes: MB(5), altTextRequired: true },
    },
  },
  other: {
    platform: "other", imageCountMin: 0, imageCountMax: 10, videoCountMax: 1, allowsMixed: true,
    constraints: {
      image: { kind: "image", formats: ["image/jpeg","image/png","image/gif","image/webp"], maxBytes: MB(25) },
      video: { kind: "video", formats: ["video/mp4"], maxBytes: MB(500) },
    },
  },
};

export function getPlatformMediaSpec(platform: string): PlatformMediaSpec {
  const s = (PLATFORM_MEDIA_SPECS as Record<string, PlatformMediaSpec | undefined>)[platform];
  return s ?? PLATFORM_MEDIA_SPECS.other;
}

export const MEDIA_REGISTRY_VERSION = "northstar.contentops.media.registry.v1";