// Pure tests for the editorial blob helpers. Runnable with `bun test`.

import { describe, expect, test } from "bun:test";
import {
  autosaveDedupeKey,
  editorialChangeRevokesApproval,
  EMPTY_EDITORIAL_BLOB,
  normalizeEditorial,
  normalizeEvergreenTags,
} from "./editorial.ts";

describe("normalizeEvergreenTags", () => {
  test("slugifies, dedupes, and caps", () => {
    const out = normalizeEvergreenTags([
      "Childhood Trauma", "childhood trauma", "PTSD!", " Anxiety ", "",
      null, 42, "Recovery", "Recovery",
    ]);
    expect(out).toEqual(["childhood-trauma", "ptsd", "anxiety", "recovery"]);
  });

  test("returns [] for non-arrays", () => {
    expect(normalizeEvergreenTags(null)).toEqual([]);
    expect(normalizeEvergreenTags("nope")).toEqual([]);
  });

  test("caps at 40 entries", () => {
    const many = Array.from({ length: 100 }, (_, i) => `topic-${i}`);
    expect(normalizeEvergreenTags(many)).toHaveLength(40);
  });
});

describe("normalizeEditorial", () => {
  test("empty input produces the empty blob", () => {
    expect(normalizeEditorial(null)).toEqual(EMPTY_EDITORIAL_BLOB);
    expect(normalizeEditorial({})).toEqual(EMPTY_EDITORIAL_BLOB);
  });

  test("filters malformed nested shapes", () => {
    const out = normalizeEditorial({
      creativeBrief: "  brief  ",
      externalLinks: [
        { url: "https://example.com", label: "Example" },
        { url: "javascript:alert(1)", label: "bad" },
        { url: null },
      ],
      sourceDocuments: [
        { title: "Doc", url: "https://a.b" },
        { title: "" },
        { url: "https://c.d" },
      ],
      referenceUrls: ["https://ok", "not-a-url", 42],
      mentionedPeople: ["Alice", "alice", "Bob"],
    });
    expect(out.creativeBrief).toBe("brief");
    expect(out.externalLinks).toEqual([{ url: "https://example.com", label: "Example" }]);
    expect(out.sourceDocuments).toEqual([{ title: "Doc", url: "https://a.b", documentId: null }]);
    expect(out.referenceUrls).toEqual(["https://ok"]);
    expect(out.mentionedPeople).toEqual(["Alice", "Bob"]);
  });
});

describe("editorialChangeRevokesApproval", () => {
  test("no-op change does not revoke", () => {
    const a = normalizeEditorial({ workingTitle: "x", internalNotes: "one" });
    const b = normalizeEditorial({ workingTitle: "x", internalNotes: "two" });
    expect(editorialChangeRevokesApproval(a, b)).toBe(false);
  });

  test("changing the final title revokes", () => {
    const a = normalizeEditorial({ finalTitle: "A" });
    const b = normalizeEditorial({ finalTitle: "B" });
    expect(editorialChangeRevokesApproval(a, b)).toBe(true);
  });

  test("changing the creative brief revokes", () => {
    const a = normalizeEditorial({ creativeBrief: "old" });
    const b = normalizeEditorial({ creativeBrief: "new" });
    expect(editorialChangeRevokesApproval(a, b)).toBe(true);
  });
});

describe("autosaveDedupeKey", () => {
  test("same inputs yield same key", () => {
    const k1 = autosaveDedupeKey({ contentItemId: "a", contentVersion: 3, clientEditToken: "t" });
    const k2 = autosaveDedupeKey({ contentItemId: "a", contentVersion: 3, clientEditToken: "t" });
    expect(k1).toBe(k2);
  });

  test("different tokens yield different keys", () => {
    const k1 = autosaveDedupeKey({ contentItemId: "a", contentVersion: 3, clientEditToken: "t1" });
    const k2 = autosaveDedupeKey({ contentItemId: "a", contentVersion: 3, clientEditToken: "t2" });
    expect(k1).not.toBe(k2);
  });
});