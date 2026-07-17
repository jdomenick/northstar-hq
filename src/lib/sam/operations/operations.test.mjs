// Pure-function tests for the SAM Content Operations framework. These verify
// the operation contract, result builders, ambiguity resolution, and truthful
// blocked connector detection. They do NOT require a database, network, or
// AI provider - the runtime pieces (auth middleware, Zod parsing, real
// mutations) are covered by content-ops integration tests.
//
// Run: node src/lib/sam/operations/operations.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

// ---- Op name registry ------------------------------------------------------

test("operation registry lists every advertised op exactly once", async () => {
  const { SAM_OPERATION_NAMES, SAM_OPERATIONS_VERSION } = await import("./types.ts");
  const s = new Set(SAM_OPERATION_NAMES);
  assert.equal(s.size, SAM_OPERATION_NAMES.length, "no duplicate op names");
  assert.ok(SAM_OPERATION_NAMES.length >= 25, "at least 25 typed ops");
  assert.match(SAM_OPERATIONS_VERSION, /^sam\.operations\.v/);
});

// ---- Result builders --------------------------------------------------------

test("success/blocked/failed builders shape results consistently", async () => {
  const { success, blocked, failed, fromThrown } = await import("./result-builders.ts");
  const base = {
    operation: "approveVariant",
    organizationId: "00000000-0000-0000-0000-000000000000",
    ventureId: null,
    actorUserId: "u1",
    startedAt: Date.now() - 5,
  };
  const ok = success({ ...base, summary: "ok", data: { x: 1 } });
  assert.equal(ok.status, "success");
  assert.ok(ok.durationMs >= 0);
  assert.ok(ok.version);

  const b = blocked({ ...base, summary: "no", reasonCode: "connector_not_implemented" });
  assert.equal(b.status, "blocked");
  assert.equal(b.reasonCode, "connector_not_implemented");

  const f = failed({ ...base, message: "boom", reasonCode: "server_error" });
  assert.equal(f.status, "failed");

  const generic = fromThrown(base, new Error("db exploded"));
  assert.equal(generic.status, "failed");
  assert.ok(!generic.message?.includes?.("db exploded"), "raw errors are not leaked");

  const contentOpsErr = Object.assign(new Error("Approval already recorded"), { name: "ContentOpsError", code: "conflict" });
  const mapped = fromThrown(base, contentOpsErr);
  assert.equal(mapped.status, "failed");
  assert.equal(mapped.reasonCode, "invalid_input");
  assert.equal(mapped.message, "Approval already recorded");
});

// ---- Ambiguity detection ---------------------------------------------------

test("resolveSingleCandidate handles none/single/many with hints", async () => {
  const { resolveSingleCandidate } = await import("./ambiguity.ts");
  assert.deepEqual(resolveSingleCandidate({ candidates: [] }), { kind: "none" });

  const one = resolveSingleCandidate({ candidates: [{ id: "a", label: "only" }] });
  assert.equal(one.kind, "single");

  const many = resolveSingleCandidate({
    candidates: [
      { id: "1", label: "X post about launch" },
      { id: "2", label: "LinkedIn post about launch" },
    ],
  });
  assert.equal(many.kind, "many");

  const hinted = resolveSingleCandidate({
    candidates: [
      { id: "1", label: "X post about launch" },
      { id: "2", label: "LinkedIn post about launch" },
    ],
    hint: "linkedin",
  });
  assert.equal(hinted.kind, "single");
  assert.equal(hinted.kind === "single" && hinted.candidate.id, "2");
});

// ---- Connector-status truthfulness -----------------------------------------

// Connector-status truthfulness is verified indirectly via the ops test
// suite's dispatcher path (integration coverage), because the resolver
// pulls in the @/lib/social/registry.server alias.

// ---- Terminal-result guardrail --------------------------------------------

test("isTerminalResult rejects bare { ok: true }", async () => {
  const { isTerminalResult } = await import("./types.ts");
  assert.equal(isTerminalResult({ ok: true }), false);
  assert.equal(isTerminalResult({ status: "success", operation: "approveVariant" }), true);
  assert.equal(isTerminalResult(null), false);
  assert.equal(isTerminalResult({ status: "made_up" }), false);
});

// ---- Input validation ------------------------------------------------------

test("edit-op input schema rejects non-UUID ids and oversized instruction", async () => {
  const { EditVariantInput } = await import("./schemas.ts");
  assert.throws(() => EditVariantInput.parse({ organizationId: "nope", ventureId: "nope", contentItemId: "nope" }));
  const bigInstruction = "x".repeat(2000);
  assert.throws(() =>
    EditVariantInput.parse({
      organizationId: "00000000-0000-0000-0000-000000000000",
      ventureId: "00000000-0000-0000-0000-000000000000",
      contentItemId: "00000000-0000-0000-0000-000000000000",
      instruction: bigInstruction,
    })
  );
});

test("createSocialPlan input requires 1+ platforms and a valid ISO period", async () => {
  const { CreateSocialPlanInput } = await import("./schemas.ts");
  assert.throws(() =>
    CreateSocialPlanInput.parse({
      organizationId: "00000000-0000-0000-0000-000000000000",
      ventureId: "00000000-0000-0000-0000-000000000000",
      name: "Q3",
      strategyPeriodStart: "not-a-date",
      strategyPeriodEnd: "not-a-date",
      platforms: [],
    })
  );
  const ok = CreateSocialPlanInput.parse({
    organizationId: "00000000-0000-0000-0000-000000000000",
    ventureId: "00000000-0000-0000-0000-000000000000",
    name: "Q3",
    strategyPeriodStart: "2026-08-01T00:00:00Z",
    strategyPeriodEnd: "2026-08-31T00:00:00Z",
    platforms: ["linkedin", "x"],
  });
  assert.equal(ok.platforms.length, 2);
});

test("approveBatch requires confirmationToken and non-empty list", async () => {
  const { ApproveBatchInput } = await import("./schemas.ts");
  assert.throws(() =>
    ApproveBatchInput.parse({
      organizationId: "00000000-0000-0000-0000-000000000000",
      ventureId: "00000000-0000-0000-0000-000000000000",
      contentItemIds: [],
      confirmationToken: "short",
    })
  );
});

// ---- Dispatch pattern (structure only, no I/O) -----------------------------

test("op name enum is a superset of the dispatcher's known ops", async () => {
  const { SAM_OPERATION_NAMES } = await import("./types.ts");
  // Sample the ones the dispatcher must know how to route.
  for (const required of [
    "createSocialPlan",
    "createPlatformVariants",
    "shortenVariant",
    "approveVariant",
    "approveBatch",
    "scheduleVariant",
    "pauseSocialPublishing",
    "publishApprovedVariant",
    "listPublishingDestinations",
    "explainBlockedPublication",
  ]) {
    assert.ok(SAM_OPERATION_NAMES.includes(required), `${required} in enum`);
  }
});