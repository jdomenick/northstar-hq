// Automation Engine pure-logic tests. No DB, no network.
// Covers retry classification, backoff computation, retry decisions,
// state transitions, dependency evaluation, cycle detection, audit
// sanitization + event-key builder, idempotency key derivation, priority
// ordering, and stale-lease detection.
//
// Run: bun test src/lib/automation/automation.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

test("classifyError maps permanent, transient, and unknown codes", async () => {
  const { classifyError } = await import("./retry.server.ts");
  assert.equal(classifyError("configuration_invalid"), "permanent");
  assert.equal(classifyError("permission_denied"), "permanent");
  assert.equal(classifyError("timeout"), "transient");
  assert.equal(classifyError("external_rate_limit"), "transient");
  assert.equal(classifyError("internal_automation_error"), "unknown");
});

test("computeRetryDelaySeconds honours kind, base, and cap", async () => {
  const { computeRetryDelaySeconds } = await import("./retry.server.ts");
  assert.equal(computeRetryDelaySeconds({ kind: "none", maxAttempts: 3 }, 1), 0);
  assert.equal(
    computeRetryDelaySeconds({ kind: "fixed", maxAttempts: 3, baseDelaySeconds: 30 }, 5),
    30,
  );
  const exp = computeRetryDelaySeconds(
    { kind: "exponential", maxAttempts: 5, baseDelaySeconds: 30, maxDelaySeconds: 300 },
    4,
  );
  // 30 * 2^3 = 240, under cap 300
  assert.equal(exp, 240);
  const capped = computeRetryDelaySeconds(
    { kind: "exponential", maxAttempts: 5, baseDelaySeconds: 30, maxDelaySeconds: 100 },
    10,
  );
  assert.equal(capped, 100);
});

test("decideRetry stops on permanent and on attempt exhaustion", async () => {
  const { decideRetry } = await import("./retry.server.ts");
  const policy = { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 10 };
  const perm = decideRetry(policy, 1, "configuration_invalid");
  assert.equal(perm.shouldRetry, false);
  assert.equal(perm.reason, "permanent");
  const trans = decideRetry(policy, 1, "timeout");
  assert.equal(trans.shouldRetry, true);
  assert.equal(trans.nextAttempt, 2);
  assert.ok(trans.delaySeconds > 0);
  const exhausted = decideRetry(policy, 3, "timeout");
  assert.equal(exhausted.shouldRetry, false);
  assert.equal(exhausted.reason, "exhausted");
});

test("isValidJobTransition enforces terminal + legal edges", async () => {
  const { isValidJobTransition } = await import("./types.ts");
  assert.equal(isValidJobTransition("queued", "running"), true);
  assert.equal(isValidJobTransition("running", "succeeded"), true);
  assert.equal(isValidJobTransition("running", "retrying"), true);
  assert.equal(isValidJobTransition("succeeded", "running"), false);
  assert.equal(isValidJobTransition("failed", "queued"), false);
  assert.equal(isValidJobTransition("cancelled", "running"), false);
});

test("evaluateDependencies blocks, fails, and passes correctly", async () => {
  const { evaluateDependencies } = await import("./dependencies.server.ts");
  const deps = [
    { id: "a", organizationId: "o", jobId: "self", dependsOnJobId: "j1",
      dependencyType: "requires_success", requiredStatus: null, createdAt: "" },
    { id: "b", organizationId: "o", jobId: "self", dependsOnJobId: "j2",
      dependencyType: "requires_completion", requiredStatus: null, createdAt: "" },
    { id: "c", organizationId: "o", jobId: "self", dependsOnJobId: "j3",
      dependencyType: "optional", requiredStatus: null, createdAt: "" },
  ];
  const blocked = evaluateDependencies(deps, new Map([
    ["j1", "running"], ["j2", "queued"], ["j3", "failed"],
  ]));
  assert.equal(blocked.satisfied, false);
  assert.deepEqual(blocked.blockedBy.sort(), ["j1", "j2"]);
  const failed = evaluateDependencies(deps, new Map([
    ["j1", "failed"], ["j2", "succeeded"], ["j3", "succeeded"],
  ]));
  assert.equal(failed.satisfied, false);
  assert.deepEqual(failed.failed, ["j1"]);
  const ok = evaluateDependencies(deps, new Map([
    ["j1", "succeeded"], ["j2", "cancelled"], ["j3", "queued"],
  ]));
  assert.equal(ok.satisfied, true);
});

test("assertNoCycleOrDepth detects cycles and depth limits", async () => {
  const { assertNoCycleOrDepth } = await import("./dependencies.server.ts");
  const acyclic = new Map([["a", ["b"]], ["b", ["c"]], ["c", []]]);
  assertNoCycleOrDepth(acyclic, "a"); // must not throw
  const cyclic = new Map([["a", ["b"]], ["b", ["a"]]]);
  assert.throws(() => assertNoCycleOrDepth(cyclic, "a"), /dependency_cycle/);
  // Deep chain past the depth limit.
  const chain = new Map();
  for (let i = 0; i < 30; i++) chain.set(`n${i}`, [`n${i + 1}`]);
  chain.set("n30", []);
  assert.throws(() => assertNoCycleOrDepth(chain, "n0", 5), /dependency_depth_exceeded/);
});

test("buildAuditEntry strips forbidden keys and rejects oversize", async () => {
  const { buildAuditEntry, buildEventKey } = await import("./audit.server.ts");
  const entry = buildAuditEntry("job_succeeded", {
    jobType: "website_sync",
    attemptNumber: 2,
    extra: {
      duration: 42,
      api_key: "sk_live_should_not_leak",
      nested: { access_token: "t", ok: true },
    },
  });
  assert.equal(entry.event, "job_succeeded");
  assert.equal(entry.metadata.job_type, "website_sync");
  assert.equal(entry.metadata.api_key, undefined);
  assert.equal(entry.metadata.nested.access_token, undefined);
  assert.equal(entry.metadata.nested.ok, true);
  const key = buildEventKey({ jobId: "j1", event: "job_succeeded", attemptNumber: 1 });
  assert.match(key, /^j1\|job_succeeded\|1\|-$/);
  // Oversize metadata should throw with the sanitized code.
  const huge = "x".repeat(50_000);
  assert.throws(
    () => buildAuditEntry("job_failed", { extra: { blob: huge } }),
    (err) => err && err.code === "job_output_too_large",
  );
});

test("priorityWeight orders critical before low, and stale-lease detection works", async () => {
  const { priorityWeight, isStaleRunningJob } = await import("./concurrency.server.ts");
  assert.ok(priorityWeight("critical") < priorityWeight("normal"));
  assert.ok(priorityWeight("normal") < priorityWeight("background"));
  const now = Date.parse("2026-07-28T12:00:00Z");
  // Started 10 minutes ago with 60s timeout + 1.5x grace => stale.
  assert.equal(
    isStaleRunningJob("2026-07-28T11:50:00Z", 60, now),
    true,
  );
  // Started 30s ago with 60s timeout => not stale.
  assert.equal(
    isStaleRunningJob("2026-07-28T11:59:30Z", 60, now),
    false,
  );
  assert.equal(isStaleRunningJob(null, 60, now), false);
});

test("isPermanentErrorCode and isTransientErrorCode classify code sets", async () => {
  const { isPermanentErrorCode, isTransientErrorCode } = await import("./errors.ts");
  assert.equal(isPermanentErrorCode("dependency_cycle"), true);
  assert.equal(isPermanentErrorCode("timeout"), false);
  assert.equal(isTransientErrorCode("external_rate_limit"), true);
  assert.equal(isTransientErrorCode("configuration_invalid"), false);
});
