// Executable tests for SAM chat->action detection and directive context
// rendering. Pure functions only - no DB or model.
//
// Run: bun test src/lib/sam/actions/actions.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

test("directive detector matches the founder command form", async () => {
  const { detectSamAction } = await import("./detect.ts");
  const cases = [
    "Set standing directive: prioritize revenue-generating work first",
    "SAM, set a directive: never publish on Sundays",
    "set directive - respond in first person",
    "Add directive: escalate blockers within one hour",
    "directive: keep every artifact under 500 words",
    "From now on, prioritize revenue-generating work first",
  ];
  for (const msg of cases) {
    const d = detectSamAction(msg);
    assert.equal(d.kind, "set_directive", `expected set_directive for: ${msg}`);
    assert.ok(d.title && d.title.length > 0, `empty title for: ${msg}`);
    assert.ok(!/^(set|add)\s+.*directive/i.test(d.title), `title still has command prefix: ${d.title}`);
  }
});

test("directive detector rejects an empty command body", async () => {
  const { detectSamAction } = await import("./detect.ts");
  const d = detectSamAction("set standing directive:");
  assert.equal(d.kind, "none");
});

test("mission detector matches create-mission phrasing", async () => {
  const { detectSamAction } = await import("./detect.ts");
  for (const msg of [
    "Create a mission to acquire our first 3 paying customers",
    "SAM, start a mission: land the first Fortune-100 pilot",
    "Our next mission is to reach $10k MRR",
    "get me 5 new leads this month",
  ]) {
    const d = detectSamAction(msg);
    assert.equal(d.kind, "create_mission", `expected create_mission for: ${msg}`);
  }
});

test("proof detector fires on the founder proof phrase", async () => {
  const { detectSamAction } = await import("./detect.ts");
  for (const msg of [
    "Run SAM proof mission",
    "SAM, prove you can execute end-to-end",
    "execute proof mission now",
  ]) {
    const d = detectSamAction(msg);
    assert.equal(d.kind, "run_proof_mission", `expected run_proof_mission for: ${msg}`);
  }
});

test("directive detector does NOT hijack a plain question", async () => {
  const { detectSamAction } = await import("./detect.ts");
  const d = detectSamAction("What are our current priorities?");
  assert.equal(d.kind, "none");
});

test("active + effective directives are included; expired/paused/future excluded", async () => {
  const { selectEffectiveDirectives, renderDirectivesBlock } = await import(
    "../directives/render.ts"
  );
  const now = "2026-07-20T12:00:00Z";
  const rows = [
    {
      id: "d1", text: "Prioritize revenue first",
      scope: "permanent", priority: 100, status: "active",
      starts_at: "2026-07-01T00:00:00Z", expires_at: null, venture_id: null,
    },
    {
      id: "d2", text: "Focus sprint on onboarding",
      scope: "temporary", priority: 200, status: "active",
      starts_at: "2026-07-15T00:00:00Z", expires_at: "2026-07-30T00:00:00Z", venture_id: null,
    },
    {
      id: "d3", text: "Expired campaign rule",
      scope: "temporary", priority: 300, status: "active",
      starts_at: "2026-06-01T00:00:00Z", expires_at: "2026-07-10T00:00:00Z", venture_id: null,
    },
    {
      id: "d4", text: "Paused rule",
      scope: "permanent", priority: 500, status: "paused",
      starts_at: "2026-07-01T00:00:00Z", expires_at: null, venture_id: null,
    },
    {
      id: "d5", text: "Not-yet-started rule",
      scope: "permanent", priority: 400, status: "active",
      starts_at: "2026-08-01T00:00:00Z", expires_at: null, venture_id: null,
    },
  ];
  const eff = selectEffectiveDirectives(rows, now);
  const ids = eff.map((d) => d.id);
  assert.deepEqual(ids, ["d2", "d1"], "priority DESC of only effective rows");

  const block = renderDirectivesBlock(eff);
  assert.match(block, /<founder-directives>/);
  assert.match(block, /Focus sprint on onboarding/);
  assert.match(block, /Prioritize revenue first/);
  assert.doesNotMatch(block, /Expired campaign rule/);
  assert.doesNotMatch(block, /Paused rule/);
  assert.doesNotMatch(block, /Not-yet-started rule/);
  assert.match(block, /<\/founder-directives>/);
});

test("renderDirectivesBlock returns empty string when nothing effective", async () => {
  const { renderDirectivesBlock } = await import("../directives/render.ts");
  assert.equal(renderDirectivesBlock([]), "");
});

// (Removed sanity check; DESTRUCTIVE_OPERATIONS shape is covered by
// operations.test.mjs.)