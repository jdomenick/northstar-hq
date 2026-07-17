// Pure-function media validation. Runs against the platform media registry
// and produces structured findings the editor UI turns into badges.
//
// This is used both by the editor (client) and by publish-gates (server) so
// they cannot disagree about what a "valid" attachment looks like.

import { getPlatformMediaSpec, type AspectSpec, type MediaConstraint } from "./media-registry";

export type MediaFindingSeverity = "error" | "warning" | "info";

export type MediaFindingCode =
  | "count_under_min"
  | "count_over_max"
  | "unsupported_mime"
  | "asset_upload_incomplete"
  | "asset_upload_failed"
  | "asset_archived"
  | "file_too_large"
  | "resolution_too_small"
  | "resolution_too_large"
  | "aspect_out_of_range"
  | "aspect_unknown"
  | "duration_too_short"
  | "duration_too_long"
  | "alt_text_required"
  | "alt_text_recommended"
  | "mixed_media_not_allowed"
  | "video_not_supported"
  | "image_not_supported"
  | "asset_missing_dimensions"
  | "asset_missing_duration";

export interface MediaFinding {
  code: MediaFindingCode;
  severity: MediaFindingSeverity;
  message: string;
  assetId?: string;
  detail?: Record<string, unknown>;
}

export interface MediaAssetLike {
  id: string;
  mediaType: string;             // 'image' | 'video' | 'carousel_image' | ...
  status: string;                // 'pending' | 'uploaded' | 'failed'
  archived: boolean;
  mimeType: string | null;
  fileSizeBytes: number | null;
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: number | null;
  altText: string | null;
}

function classifyAspect(width: number, height: number, aspects: readonly AspectSpec[]): AspectSpec | null {
  const actual = width / height;
  for (const a of aspects) if (Math.abs(actual - a.ratio) / a.ratio <= a.tolerance) return a;
  return null;
}

function checkOne(asset: MediaAssetLike, cst: MediaConstraint, platformKey: string, requireAlt: boolean): MediaFinding[] {
  const out: MediaFinding[] = [];
  const { id } = asset;

  if (asset.status === "pending") out.push({ code: "asset_upload_incomplete", severity: "error", message: "Upload is not finished.", assetId: id });
  if (asset.status === "failed")  out.push({ code: "asset_upload_failed", severity: "error", message: "Upload previously failed. Retry or replace.", assetId: id });
  if (asset.archived)             out.push({ code: "asset_archived", severity: "error", message: "This asset is archived.", assetId: id });

  if (asset.mimeType && !cst.formats.includes(asset.mimeType)) {
    out.push({ code: "unsupported_mime", severity: "error", message: `${asset.mimeType} is not accepted on ${platformKey}.`, assetId: id, detail: { accepted: cst.formats } });
  }
  if (asset.fileSizeBytes != null && asset.fileSizeBytes > cst.maxBytes) {
    out.push({ code: "file_too_large", severity: "error", message: `File exceeds ${Math.round(cst.maxBytes / (1024 * 1024))} MB limit.`, assetId: id, detail: { size: asset.fileSizeBytes, max: cst.maxBytes } });
  }

  if (cst.kind === "image" || cst.kind === "thumbnail") {
    if (asset.widthPx == null || asset.heightPx == null) {
      out.push({ code: "asset_missing_dimensions", severity: "warning", message: "Image dimensions unknown; cannot verify aspect ratio.", assetId: id });
    } else {
      if (cst.minWidth && asset.widthPx < cst.minWidth) out.push({ code: "resolution_too_small", severity: "error", message: `Width ${asset.widthPx}px below required ${cst.minWidth}px.`, assetId: id });
      if (cst.minHeight && asset.heightPx < cst.minHeight) out.push({ code: "resolution_too_small", severity: "error", message: `Height ${asset.heightPx}px below required ${cst.minHeight}px.`, assetId: id });
      if (cst.maxWidth && asset.widthPx > cst.maxWidth) out.push({ code: "resolution_too_large", severity: "warning", message: `Width ${asset.widthPx}px above recommended ${cst.maxWidth}px.`, assetId: id });
      if (cst.maxHeight && asset.heightPx > cst.maxHeight) out.push({ code: "resolution_too_large", severity: "warning", message: `Height ${asset.heightPx}px above recommended ${cst.maxHeight}px.`, assetId: id });
      if (cst.aspects && cst.aspects.length > 0) {
        const hit = classifyAspect(asset.widthPx, asset.heightPx, cst.aspects);
        if (!hit) out.push({ code: "aspect_out_of_range", severity: "warning", message: `Aspect ratio not in accepted set: ${cst.aspects.map(a => a.label).join(", ")}.`, assetId: id });
      }
    }
  }

  if (cst.kind === "video") {
    if (asset.durationSeconds == null) {
      out.push({ code: "asset_missing_duration", severity: "warning", message: "Video duration unknown; cannot verify against platform limits.", assetId: id });
    } else {
      if (cst.minDurationSeconds && asset.durationSeconds < cst.minDurationSeconds) out.push({ code: "duration_too_short", severity: "error", message: `Duration ${asset.durationSeconds}s below required ${cst.minDurationSeconds}s.`, assetId: id });
      if (cst.maxDurationSeconds && asset.durationSeconds > cst.maxDurationSeconds) out.push({ code: "duration_too_long", severity: "error", message: `Duration ${asset.durationSeconds}s exceeds max ${cst.maxDurationSeconds}s.`, assetId: id });
    }
  }

  if ((cst.kind === "image" || cst.kind === "thumbnail") && requireAlt) {
    const hasAlt = (asset.altText ?? "").trim().length > 0;
    if (!hasAlt) {
      if (cst.altTextRequired) out.push({ code: "alt_text_required", severity: "error", message: "Alt text is required for accessibility on this platform.", assetId: id });
      else if (cst.altTextRecommended) out.push({ code: "alt_text_recommended", severity: "warning", message: "Alt text is strongly recommended for accessibility.", assetId: id });
    }
  }

  return out;
}

export interface MediaValidationResult {
  findings: MediaFinding[];
  errors: MediaFinding[];
  warnings: MediaFinding[];
  ok: boolean;
}

export function validateMediaForPlatform(platform: string, assets: MediaAssetLike[]): MediaValidationResult {
  const spec = getPlatformMediaSpec(platform);
  const findings: MediaFinding[] = [];

  const images = assets.filter(a => a.mediaType === "image" || a.mediaType === "carousel_image");
  const videos = assets.filter(a => a.mediaType === "video");
  const thumbnails = assets.filter(a => a.mediaType === "thumbnail");
  const others = assets.filter(a => !["image","carousel_image","video","thumbnail"].includes(a.mediaType));

  if (images.length + videos.length + thumbnails.length + others.length < spec.imageCountMin) {
    findings.push({ code: "count_under_min", severity: "error", message: `${spec.platform} requires at least ${spec.imageCountMin} media item(s).` });
  }
  if (images.length > spec.imageCountMax) {
    findings.push({ code: "count_over_max", severity: "error", message: `${spec.platform} allows at most ${spec.imageCountMax} image(s); found ${images.length}.` });
  }
  if (videos.length > spec.videoCountMax) {
    findings.push({ code: "count_over_max", severity: "error", message: `${spec.platform} allows at most ${spec.videoCountMax} video(s); found ${videos.length}.` });
  }
  if (!spec.allowsMixed && images.length > 0 && videos.length > 0) {
    findings.push({ code: "mixed_media_not_allowed", severity: "error", message: `${spec.platform} does not allow mixing images and video in the same post.` });
  }
  if (videos.length > 0 && !spec.constraints.video) {
    findings.push({ code: "video_not_supported", severity: "error", message: `${spec.platform} does not accept video.` });
  }
  if (images.length > 0 && !spec.constraints.image) {
    findings.push({ code: "image_not_supported", severity: "error", message: `${spec.platform} does not accept images.` });
  }

  const requireAlt = images.length > 0;
  if (spec.constraints.image) for (const a of images) findings.push(...checkOne(a, spec.constraints.image, spec.platform, requireAlt));
  if (spec.constraints.video) for (const a of videos) findings.push(...checkOne(a, spec.constraints.video, spec.platform, false));
  if (spec.constraints.thumbnail) for (const a of thumbnails) findings.push(...checkOne(a, spec.constraints.thumbnail, spec.platform, false));

  const errors = findings.filter(f => f.severity === "error");
  const warnings = findings.filter(f => f.severity === "warning");
  return { findings, errors, warnings, ok: errors.length === 0 };
}

export const MEDIA_VALIDATION_VERSION = "northstar.contentops.media.validation.v1";