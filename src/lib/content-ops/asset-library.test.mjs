// Pure-function tests for the Files & Assets Foundation helpers.
// No DB, no server imports. Run with: bun test src/lib/content-ops/asset-library.test.mjs

import { describe, it, expect } from "bun:test";
import {
  ASSET_LIBRARY_LIMITS,
  normalizeTag,
  normalizeTags,
  validateFolderName,
  buildFolderTree,
  collectDescendantIds,
  canMoveFolder,
} from "./asset-library.ts";

describe("normalizeTag", () => {
  it("lowercases and slugifies", () => {
    expect(normalizeTag("  Hero Image  ")).toBe("hero-image");
  });
  it("strips invalid characters", () => {
    expect(normalizeTag("brand/2026!")).toBe("brand2026");
  });
  it("returns null for empty", () => {
    expect(normalizeTag("   ")).toBeNull();
    expect(normalizeTag("!!!")).toBeNull();
  });
  it("truncates over max length", () => {
    const long = "a".repeat(200);
    expect(normalizeTag(long).length).toBe(ASSET_LIBRARY_LIMITS.maxTagLength);
  });
});

describe("normalizeTags", () => {
  it("dedupes and caps count", () => {
    const input = Array.from({ length: 60 }, (_, i) => `tag-${i}`);
    const out = normalizeTags([...input, "tag-1", "TAG-1"]);
    expect(out.length).toBe(ASSET_LIBRARY_LIMITS.maxTagsPerAsset);
    expect(new Set(out).size).toBe(out.length);
  });
});

describe("validateFolderName", () => {
  it("rejects empty", () => {
    expect(() => validateFolderName("   ")).toThrow();
  });
  it("rejects path separators", () => {
    expect(() => validateFolderName("foo/bar")).toThrow();
    expect(() => validateFolderName("foo\\bar")).toThrow();
  });
  it("collapses whitespace", () => {
    expect(validateFolderName("  My   Folder  ")).toBe("My Folder");
  });
});

function fold(id, parent, name, sort = 0) {
  return { id, parent_folder_id: parent, name, archived: false, sort_order: sort };
}

describe("buildFolderTree", () => {
  it("nests children and computes paths + depth", () => {
    const rows = [
      fold("a", null, "Brand"),
      fold("b", "a", "Logos"),
      fold("c", "b", "Primary"),
      fold("d", null, "Campaigns"),
    ];
    const tree = buildFolderTree(rows);
    expect(tree.map((n) => n.name)).toEqual(["Brand", "Campaigns"]);
    const brand = tree[0];
    expect(brand.depth).toBe(0);
    expect(brand.children[0].name).toBe("Logos");
    expect(brand.children[0].depth).toBe(1);
    expect(brand.children[0].children[0].path).toEqual(["Brand", "Logos", "Primary"]);
  });
  it("promotes orphans to roots", () => {
    const tree = buildFolderTree([fold("x", "missing", "Orphan")]);
    expect(tree.length).toBe(1);
    expect(tree[0].id).toBe("x");
  });
});

describe("collectDescendantIds", () => {
  it("finds all descendants", () => {
    const rows = [
      fold("a", null, "A"), fold("b", "a", "B"),
      fold("c", "b", "C"), fold("d", "a", "D"), fold("e", null, "E"),
    ];
    const d = collectDescendantIds(rows, "a");
    expect([...d].sort()).toEqual(["b", "c", "d"]);
  });
});

describe("canMoveFolder", () => {
  const rows = [
    fold("a", null, "A"), fold("b", "a", "B"), fold("c", "b", "C"),
  ];
  it("allows move to root", () => {
    expect(canMoveFolder(rows, "c", null).ok).toBe(true);
  });
  it("blocks moving into itself", () => {
    expect(canMoveFolder(rows, "a", "a").ok).toBe(false);
  });
  it("blocks moving into descendant", () => {
    expect(canMoveFolder(rows, "a", "c").ok).toBe(false);
  });
  it("blocks exceeding depth", () => {
    const deep = [];
    let parent = null;
    for (let i = 0; i < 10; i++) {
      const id = `f${i}`;
      deep.push(fold(id, parent, `L${i}`));
      parent = id;
    }
    const res = canMoveFolder(deep, "f0", "f9");
    expect(res.ok).toBe(false);
  });
});