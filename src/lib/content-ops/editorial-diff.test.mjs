// Pure tests for the LCS line diff.

import { describe, expect, test } from "bun:test";
import { diffLines, summarizeDiff } from "./editorial-diff.ts";

describe("diffLines", () => {
  test("identical inputs are all equal", () => {
    const d = diffLines("a\nb\nc", "a\nb\nc");
    expect(d.every((l) => l.op === "equal")).toBe(true);
    expect(d).toHaveLength(3);
  });

  test("addition only", () => {
    const d = diffLines("a\nb", "a\nb\nc");
    expect(d.at(-1)).toEqual({ op: "added", text: "c", aLine: null, bLine: 3 });
  });

  test("removal only", () => {
    const d = diffLines("a\nb\nc", "a\nc");
    const removed = d.filter((l) => l.op === "removed");
    expect(removed).toHaveLength(1);
    expect(removed[0].text).toBe("b");
  });

  test("mixed edits", () => {
    const d = diffLines("one\ntwo\nthree", "one\nTWO\nthree");
    const s = summarizeDiff(d);
    expect(s.added).toBe(1);
    expect(s.removed).toBe(1);
    expect(s.unchanged).toBe(2);
    expect(s.changed).toBe(true);
  });

  test("null/empty inputs behave", () => {
    expect(diffLines(null, null)).toEqual([]);
    expect(diffLines("", "hi")).toEqual([{ op: "added", text: "hi", aLine: null, bLine: 1 }]);
  });
});