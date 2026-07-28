// Reasoning strategy tests. Pure logic  -  no DB, no model. Covers:
//   1. Router decisions per intent and per high-consequence phrasing.
//   2. Deterministic-only strategy shape (insufficient-data response).
//   3. Fixture scoring on both passing and failing candidate outputs.
//
// Run: bun test src/lib/sam/reasoning/reasoning.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

test("router selects deterministic_only when context is empty", async () => {
  const { selectStrategy } = await import("./router.ts");
  const d = selectStrategy({
    intent: "priority_review",
    message: "What should I focus on this week?",
    hasAnyContext: false,
  });
  assert.equal(d.strategy, "deterministic_only");
});

test("router selects plan_then_critique for priority_review", async () => {
  const { selectStrategy } = await import("./router.ts");
  const d = selectStrategy({
    intent: "priority_review",
    message: "What are my highest-leverage priorities?",
    hasAnyContext: true,
  });
  assert.equal(d.strategy, "plan_then_critique");
});

test("router selects multi_actor for decision_review with financial context", async () => {
  const { selectStrategy } = await import("./router.ts");
  const d = selectStrategy({
    intent: "decision_review",
    message: "Should we accept the customer's pricing request?",
    hasAnyContext: true,
  });
  assert.equal(d.strategy, "multi_actor");
  assert.ok(d.specialists.includes("strategic_alignment"));
  assert.ok(d.specialists.includes("financial_risk"));
});

test("router escalates high-consequence phrasing to multi_actor even for general questions", async () => {
  const { selectStrategy } = await import("./router.ts");
  const d = selectStrategy({
    intent: "general_executive_question",
    message: "Walk me through what happens if we have to lay off the delivery team.",
    hasAnyContext: true,
  });
  assert.equal(d.strategy, "multi_actor");
  assert.ok(d.specialists.includes("financial_risk"));
});

test("router keeps summary intents on single_pass", async () => {
  const { selectStrategy } = await import("./router.ts");
  for (const intent of [
    "organization_overview",
    "venture_overview",
    "knowledge_lookup",
    "activity_summary",
    "general_executive_question",
  ]) {
    const d = selectStrategy({ intent, message: "summary please", hasAnyContext: true });
    assert.equal(d.strategy, "single_pass", `expected single_pass for ${intent}`);
  }
});

test("router returns single_pass refusal for unsupported action requests", async () => {
  const { selectStrategy } = await import("./router.ts");
  const d = selectStrategy({
    intent: "unsupported_action_request",
    message: "Delete the archived project.",
    hasAnyContext: true,
  });
  assert.equal(d.strategy, "single_pass");
});

test("deterministic_only strategy returns an insufficient-data response with a full trace", async () => {
  const { runDeterministicOnly } = await import("./strategies/deterministic-only.server.ts");
  const context = {
    version: "sam.context.v1.0.0",
    precedenceVersion: "x",
    decayVersion: "x",
    org: null,
    founder: null,
    ventures: [],
    activeVenture: null,
    projects: [],
    tasks: [],
    goals: [],
    decisions: [],
    commitments: [],
    knowledge: [],
    documents: [],
    activity: [],
    directives: [],
    memory: {
      trusted: [],
      uncertain: [],
      considered_ids: [],
      selected_ids: [],
      excluded_ids: [],
      conflict_count: 0,
    },
    memoryToggles: { founder: true, org: true, venture: true },
    counts: {},
    truncations: [],
  };
  const r = runDeterministicOnly({
    intent: "priority_review",
    context,
    reason: "no context",
  });
  assert.equal(r.trace.strategy, "deterministic_only");
  assert.ok(r.response.missing_information.length > 0);
  assert.equal(r.response.model_confidence_hint, "low");
  assert.equal(r.provider, null);
});

test("scoreFixture passes a well-formed multi-actor fundraise recommendation", async () => {
  const { REASONING_FIXTURES } = await import("./evals/fixtures.ts");
  const { scoreFixture } = await import("./evals/score.ts");
  const fixture = REASONING_FIXTURES.find((f) => f.id === "financially_risky_recommendation");
  const candidate = {
    response: {
      answer: "Multiple options exist.",
      executive_summary: "Two viable paths.",
      observations: [],
      risks: ["Runway compresses under a delayed close."],
      opportunities: [],
      recommendations: ["Bridge from existing revenue", "Raise seed"],
      missing_information: [],
      assumptions: ["Payroll is the sole driver."],
      next_question: null,
      model_confidence_hint: "moderate",
      citations: [],
      unsupported_action: null,
    },
    confidence: { score: 0.6, band: "moderate" },
    trace: {
      strategy: "multi_actor",
      risks: ["Runway compresses under a delayed close."],
      candidate_actions: [
        { action: "Bridge from existing revenue", rationale: "", supporting_citation_indexes: [] },
        { action: "Raise seed", rationale: "", supporting_citation_indexes: [] },
      ],
      evidence_against: [],
      assumptions: ["Payroll is the sole driver."],
    },
    strategy: "multi_actor",
  };
  const s = scoreFixture(fixture, candidate);
  assert.equal(s.failures.length, 0, `unexpected failures: ${JSON.stringify(s.failures)}`);
  assert.equal(s.overall, 1);
});

test("scoreFixture flags an unsupported_action_request that answered instead of refusing", async () => {
  const { REASONING_FIXTURES } = await import("./evals/fixtures.ts");
  const { scoreFixture } = await import("./evals/score.ts");
  const fixture = REASONING_FIXTURES.find((f) => f.id === "unsupported_action_request");
  const bad = {
    response: {
      answer: "Deleted.",
      executive_summary: null,
      observations: [],
      risks: [],
      opportunities: [],
      recommendations: ["done"],
      missing_information: [],
      assumptions: [],
      next_question: null,
      model_confidence_hint: null,
      citations: [],
      unsupported_action: null,
    },
    confidence: { score: 0.5, band: "moderate" },
    trace: { strategy: "single_pass", risks: [], candidate_actions: [], evidence_against: [], assumptions: [] },
    strategy: "single_pass",
  };
  const s = scoreFixture(fixture, bad);
  assert.ok(s.failures.some((f) => /unsupported_action refusal/.test(f)));
  assert.ok(s.overall < 1);
});

test("scoreFixture caps confidence when it exceeds the fixture bound", async () => {
  const { REASONING_FIXTURES } = await import("./evals/fixtures.ts");
  const { scoreFixture } = await import("./evals/score.ts");
  const fixture = REASONING_FIXTURES.find((f) => f.id === "high_confidence_unsupported");
  const bad = {
    response: {
      answer: "All ventures are healthy.",
      executive_summary: null,
      observations: [],
      risks: [],
      opportunities: [],
      recommendations: [],
      missing_information: [],
      assumptions: [],
      next_question: null,
      model_confidence_hint: "very_high",
      citations: [],
      unsupported_action: null,
    },
    confidence: { score: 0.95, band: "very_high" },
    trace: { strategy: "single_pass", risks: [], candidate_actions: [], evidence_against: [], assumptions: [] },
    strategy: "single_pass",
  };
  const s = scoreFixture(fixture, bad);
  assert.ok(s.failures.some((f) => /confidence/.test(f)));
});

test("summarizeScores averages per-dimension across fixtures", async () => {
  const { summarizeScores } = await import("./evals/score.ts");
  const summary = summarizeScores([
    { fixtureId: "a", overall: 1, dimensions: { factual_grounding: 1, risk_detection: 1 }, failures: [] },
    { fixtureId: "b", overall: 0, dimensions: { factual_grounding: 0, risk_detection: 0 }, failures: ["x"] },
  ]);
  assert.equal(summary.overall, 0.5);
  assert.equal(summary.dimensions.factual_grounding, 0.5);
  assert.equal(summary.dimensions.risk_detection, 0.5);
});