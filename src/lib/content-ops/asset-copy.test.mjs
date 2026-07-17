import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  MAX_ASSET_COPY_BATCH,
  nextCopyDisplayName,
  storageExtension,
  copyStoragePath,
  emptyCopyResult,
  pushOutcome,
  summarizeCopyResult,
} from "./asset-copy.ts";

test("nextCopyDisplayName appends (copy) then increments", () => {
  assert.equal(nextCopyDisplayName("Hero image"), "Hero image (copy)");
  assert.equal(nextCopyDisplayName("Hero image (copy)"), "Hero image (copy 2)");
  assert.equal(nextCopyDisplayName("Hero image (copy 2)"), "Hero image (copy 3)");
  assert.equal(nextCopyDisplayName("Hero image (copy 99)"), "Hero image (copy 100)");
});

test("nextCopyDisplayName handles empty / null", () => {
  assert.equal(nextCopyDisplayName(""), "Untitled (copy)");
  assert.equal(nextCopyDisplayName(null), "Untitled (copy)");
  assert.equal(nextCopyDisplayName(undefined), "Untitled (copy)");
  assert.equal(nextCopyDisplayName("   "), "Untitled (copy)");
});

test("storageExtension extracts trailing extension safely", () => {
  assert.equal(storageExtension("org/content-media/ven/abc.png"), ".png");
  assert.equal(storageExtension("org/foo/bar.tar.gz"), ".gz");
  assert.equal(storageExtension("org/foo/no-extension"), "");
  assert.equal(storageExtension(""), "");
  assert.equal(storageExtension(null), "");
  assert.equal(storageExtension("org/foo/.hidden"), "");
  assert.equal(storageExtension("org/foo/a.reallyLongExtensionValue"), ""); // safety guard
});

test("copyStoragePath uses new asset id and preserves extension", () => {
  const p = copyStoragePath(
    "org-uuid", "ven-uuid", "new-asset-uuid",
    "org-uuid/content-media/ven-uuid/old-asset-uuid.jpg", "",
  );
  assert.equal(p, "org-uuid/content-media/ven-uuid/new-asset-uuid.jpg");
});

test("copyStoragePath prefers mime-derived extension when provided", () => {
  const p = copyStoragePath("org", "ven", "new", "any/path/no-ext", ".png");
  assert.equal(p, "org/content-media/ven/new.png");
});

test("pushOutcome tallies copied/skipped/failed truthfully", () => {
  const r = emptyCopyResult(3);
  pushOutcome(r, { sourceAssetId: "a", status: "copied", newAssetId: "n1", storagePath: "p1" });
  pushOutcome(r, { sourceAssetId: "b", status: "skipped", reason: "already exists" });
  pushOutcome(r, { sourceAssetId: "c", status: "failed", reason: "storage copy failed" });
  assert.equal(r.copied, 1);
  assert.equal(r.skipped, 1);
  assert.equal(r.failed, 1);
  assert.equal(r.totalRequested, 3);
  assert.equal(r.outcomes.length, 3);
});

test("summarizeCopyResult reports zero states truthfully", () => {
  assert.equal(summarizeCopyResult(emptyCopyResult(0)), "No assets processed");
  const r = emptyCopyResult(1);
  pushOutcome(r, { sourceAssetId: "a", status: "copied", newAssetId: "n", storagePath: "p" });
  assert.equal(summarizeCopyResult(r), "1 copied");
});

test("MAX_ASSET_COPY_BATCH is a small sensible bound", () => {
  assert.ok(MAX_ASSET_COPY_BATCH >= 1);
  assert.ok(MAX_ASSET_COPY_BATCH <= 100);
});