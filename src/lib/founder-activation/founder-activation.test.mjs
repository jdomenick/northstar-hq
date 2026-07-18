import { strict as assert } from "node:assert";
import test from "node:test";
import { shouldFill, mergePatch, priorityRank, pickTopBy } from "./merge-policy.ts";
import { normalizeName, VENTURES, PROJECTS, GOALS, DECISIONS, COMMITMENTS } from "./proposals.ts";

test("normalizeName lowercases and collapses whitespace", () => {
  assert.equal(normalizeName("  Healing   Path  "), "healing path");
  assert.equal(normalizeName("Healing Path System"), normalizeName("healing path system"));
});

test("shouldFill treats null, undefined, and blank strings as empty", () => {
  assert.equal(shouldFill(null), true);
  assert.equal(shouldFill(undefined), true);
  assert.equal(shouldFill(""), true);
  assert.equal(shouldFill("  "), true);
  assert.equal(shouldFill("value"), false);
  assert.equal(shouldFill(0), false);
});

test("mergePatch never overwrites populated fields", () => {
  const existing = { name: "Existing", description: "Original", priority: null };
  const patch = mergePatch(existing, { name: "New", description: "Ignored", priority: "high" });
  assert.deepEqual(patch, { priority: "high" });
});

test("priorityRank orders critical > high > normal > low > unknown", () => {
  assert.ok(priorityRank("critical") > priorityRank("high"));
  assert.ok(priorityRank("high") > priorityRank("normal"));
  assert.ok(priorityRank("normal") > priorityRank("low"));
  assert.ok(priorityRank("low") > priorityRank(null));
});

test("pickTopBy returns top N by score", () => {
  const items = [{ v: 1 }, { v: 5 }, { v: 3 }];
  assert.deepEqual(pickTopBy(items, (i) => i.v, 2), [{ v: 5 }, { v: 3 }]);
});

test("proposal set matches the founder brief counts", () => {
  assert.equal(VENTURES.length, 5);
  assert.equal(PROJECTS.length, 16);
  assert.equal(GOALS.length, 5);
  assert.equal(DECISIONS.length, 7);
  assert.equal(COMMITMENTS.length, 4);
});

test("every project and goal references a real venture key", () => {
  const keys = new Set(VENTURES.map((v) => v.key));
  for (const p of PROJECTS) assert.ok(keys.has(p.ventureKey), `project ${p.name} references unknown venture ${p.ventureKey}`);
  for (const g of GOALS) assert.ok(keys.has(g.ventureKey), `goal ${g.title} references unknown venture ${g.ventureKey}`);
  for (const c of COMMITMENTS) assert.ok(keys.has(c.ventureKey), `commitment ${c.title} references unknown venture ${c.ventureKey}`);
});
