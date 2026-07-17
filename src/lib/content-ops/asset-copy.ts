// Pure helpers for asset copy / duplicate operations.
// Kept dependency-free so the server function and its tests share the
// same naming / extension / partial-result logic without pulling any
// server-only modules.

export const MAX_ASSET_COPY_BATCH = 50;

/**
 * Given a display name (or original filename) produce a display name for
 * the copy. Idempotent-ish: repeated duplication produces
 *   "Foo" → "Foo (copy)" → "Foo (copy 2)" → "Foo (copy 3)".
 * When the source has no name at all we fall back to "Untitled (copy)".
 */
export function nextCopyDisplayName(source: string | null | undefined): string {
  const base = (source ?? "").trim();
  if (base.length === 0) return "Untitled (copy)";
  const m = base.match(/^(.*)\s\(copy(?:\s(\d+))?\)$/i);
  if (!m) return `${base} (copy)`;
  const stem = m[1];
  const n = m[2] ? parseInt(m[2], 10) : 1;
  const next = Number.isFinite(n) && n >= 1 ? n + 1 : 2;
  return `${stem} (copy ${next})`;
}

/** Extract the extension (including the dot) from a storage path, or "". */
export function storageExtension(path: string | null | undefined): string {
  if (!path) return "";
  const slash = path.lastIndexOf("/");
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  const ext = base.slice(dot);
  // guard against pathological "extensions"
  if (ext.length > 12) return "";
  return ext;
}

/**
 * Compute the storage path for a newly created asset copy.
 * Mirrors media.functions.ts' storagePathFor() but derives extension from
 * the source path when the mime type doesn't map cleanly.
 */
export function copyStoragePath(
  organizationId: string,
  ventureId: string,
  newAssetId: string,
  sourcePath: string | null | undefined,
  extensionFromMime: string,
): string {
  const ext = extensionFromMime || storageExtension(sourcePath);
  return `${organizationId}/content-media/${ventureId}/${newAssetId}${ext}`;
}

/**
 * Per-asset outcome shape returned by copy/duplicate server fns. The result
 * is always truthful: partial failures do not raise; each asset reports its
 * own status so the UI can surface exactly what happened.
 */
export type AssetCopyOutcome =
  | { sourceAssetId: string; status: "copied"; newAssetId: string; storagePath: string }
  | { sourceAssetId: string; status: "skipped"; reason: string }
  | { sourceAssetId: string; status: "failed"; reason: string };

export interface AssetCopyResult {
  totalRequested: number;
  copied: number;
  skipped: number;
  failed: number;
  outcomes: AssetCopyOutcome[];
}

export function emptyCopyResult(totalRequested: number): AssetCopyResult {
  return { totalRequested, copied: 0, skipped: 0, failed: 0, outcomes: [] };
}

export function pushOutcome(result: AssetCopyResult, outcome: AssetCopyOutcome): void {
  result.outcomes.push(outcome);
  if (outcome.status === "copied") result.copied += 1;
  else if (outcome.status === "skipped") result.skipped += 1;
  else result.failed += 1;
}

export function summarizeCopyResult(result: AssetCopyResult): string {
  const parts: string[] = [];
  if (result.copied) parts.push(`${result.copied} copied`);
  if (result.skipped) parts.push(`${result.skipped} skipped`);
  if (result.failed) parts.push(`${result.failed} failed`);
  if (parts.length === 0) return "No assets processed";
  return parts.join(", ");
}