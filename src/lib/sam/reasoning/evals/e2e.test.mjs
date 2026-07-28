// End-to-end reasoning evaluation. Runs all 12 fixtures through the real
// strategy dispatcher via an injected mock provider, then enforces the
// per-fixture and aggregate thresholds. Fails the suite when any threshold
// is breached. Do not weaken thresholds to make tests pass.

import assert from "node:assert/strict";
import { test } from "node:test";

test("E2E: all 12 fixtures execute through real strategies", async () => {
  const { runAllFixtures } = await import("./runner.ts");
  const { REASONING_FIXTURES } = await import("./fixtures.ts");
  const { results } = await runAllFixtures();
  assert.equal(results.length, REASONING_FIXTURES.length, "not all fixtures ran");
  const strategies = new Set(results.map((r) => r.strategyUsed));
  assert.ok(strategies.has("deterministic_only"), "no deterministic_only run");
  assert.ok(strategies.has("single_pass"), "no single_pass run");
  assert.ok(strategies.has("plan_then_critique"), "no plan_then_critique run");
  assert.ok(strategies.has("multi_actor"), "no multi_actor run");
});

test("E2E: thresholds hold for per-fixture organization_isolation and citation_validity", async () => {
  const { runAllFixtures, checkThresholds } = await import("./runner.ts");
  const { results, summary } = await runAllFixtures();
  const report = checkThresholds(results, summary);
  const perFixture = report.perFixtureFailures.map(
    (f) => `${f.fixtureId}.${f.dimension}=${f.value}<${f.min}`,
  );
  assert.equal(
    report.perFixtureFailures.length,
    0,
    `per-fixture threshold breaches: ${perFixture.join(", ")}`,
  );
});

test("E2E: aggregate quality thresholds hold", async () => {
  const { runAllFixtures, checkThresholds } = await import("./runner.ts");
  const { results, summary } = await runAllFixtures();
  const report = checkThresholds(results, summary);
  const agg = report.aggregateFailures.map((f) => `${f.dimension}=${f.value}<${f.min}`);
  assert.equal(
    report.aggregateFailures.length,
    0,
    `aggregate threshold breaches: ${agg.join(", ")}`,
  );
});

test("E2E: provider failure fixture falls back truthfully", async () => {
  const { runAllFixtures } = await import("./runner.ts");
  const { results } = await runAllFixtures({
    fixtureId: "provider_failure_or_invalid_structured_output",
  });
  assert.equal(results.length, 1);
  const r = results[0];
  assert.equal(r.fellBack, true, "expected provider fallback");
  assert.equal(r.score.failures.length, 0, `failures: ${r.score.failures.join(", ")}`);
});

test("E2E: prompt-injection fixture ignores the injected instruction", async () => {
  const { runAllFixtures } = await import("./runner.ts");
  const { results } = await runAllFixtures({ fixtureId: "prompt_injection_in_context" });
  const r = results[0];
  assert.equal(r.candidate.injectionIgnored, true);
  assert.equal(r.score.failures.length, 0, r.score.failures.join(", "));
});

test("E2E: replay produces stable context and output hashes for the same plan+provider", async () => {
  const { runAllFixtures } = await import("./runner.ts");
  const a = await runAllFixtures({ fixtureId: "two_plausible_strategic_options" });
  const b = await runAllFixtures({ fixtureId: "two_plausible_strategic_options" });
  assert.equal(a.results[0].contextHash, b.results[0].contextHash);
  assert.equal(a.results[0].outputHash, b.results[0].outputHash);
});