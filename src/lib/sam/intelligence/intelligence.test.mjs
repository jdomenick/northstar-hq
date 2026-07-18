// Pure-function tests for SAM Executive Intelligence detectors, health,
// recommendations, and digest. No I/O; runs under `node --test`.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  detectStalledProjects,
  detectInactiveVentures,
  detectPostponedCommitments,
  detectMissingOwners,
  detectDuplicateProjects,
  detectDecisionReversals,
  detectGoalDrift,
  detectLongRunningProjects,
  runAllDetectors,
  orderFindings,
} from "./detectors.ts";
import { computeHealth, healthBand } from "./health.ts";
import { recommendationsFor, recommendationsForAll } from "./recommendations.ts";
import { assembleDigest } from "./digest.ts";

const ORG = "00000000-0000-0000-0000-00000000000a";
const NOW = new Date("2026-07-18T12:00:00Z");

function emptyDataset(overrides = {}) {
  return {
    now: NOW,
    organizationId: ORG,
    ventures: [],
    projects: [],
    tasks: [],
    commitments: [],
    decisions: [],
    goals: [],
    activity: [],
    memoryConflicts: [],
    ...overrides,
  };
}

function project(over = {}) {
  return {
    id: "p-" + Math.random().toString(36).slice(2, 10),
    organization_id: ORG,
    venture_id: null,
    name: "Untitled project",
    status: "active",
    owner_user_id: "u1",
    progress_percentage: 20,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    deadline: null,
    deleted_at: null,
    ...over,
  };
}

function commitment(over = {}) {
  return {
    id: "c-" + Math.random().toString(36).slice(2, 10),
    organization_id: ORG,
    venture_id: null,
    title: "Do the thing",
    status: "open",
    owner_user_id: "u1",
    due_date: null,
    postponement_count: 0,
    completed_at: null,
    updated_at: "2026-07-10T00:00:00Z",
    deleted_at: null,
    ...over,
  };
}

test("stalled project detector fires when no activity in > 14 days", () => {
  const ds = emptyDataset({
    projects: [project({ id: "p1", updated_at: "2026-06-01T00:00:00Z", status: "active" })],
  });
  const out = detectStalledProjects(ds);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternKey, "stalled_project");
  assert.equal(out[0].entityRef, "project:p1");
});

test("stalled project detector skips completed projects", () => {
  const ds = emptyDataset({
    projects: [project({ status: "completed", updated_at: "2026-01-01T00:00:00Z" })],
  });
  assert.equal(detectStalledProjects(ds).length, 0);
});

test("postponed commitment detector fires after threshold", () => {
  const ds = emptyDataset({
    commitments: [commitment({ id: "c1", postponement_count: 4 })],
  });
  const out = detectPostponedCommitments(ds);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternKey, "postponed_commitment");
});

test("postponed commitment detector ignores canceled commitments (enum spelling)", () => {
  const ds = emptyDataset({
    commitments: [commitment({ postponement_count: 9, status: "canceled" })],
  });
  assert.equal(detectPostponedCommitments(ds).length, 0);
});

test("missing owner detector fires on ownerless open project", () => {
  const ds = emptyDataset({
    projects: [project({ id: "p2", owner_user_id: null, status: "planned" })],
  });
  const out = detectMissingOwners(ds);
  assert.equal(out.length, 1);
  assert.equal(out[0].entityRef, "project:p2");
});

test("duplicate project detector uses jaccard on names", () => {
  const ds = emptyDataset({
    projects: [
      project({ id: "a", name: "Launch marketing site v1" }),
      project({ id: "b", name: "Launch marketing site v2" }),
    ],
  });
  const out = detectDuplicateProjects(ds);
  assert.ok(out.length >= 1);
  assert.equal(out[0].patternKey, "duplicate_project");
});

test("decision reversal detector fires on revisit_later status", () => {
  const ds = emptyDataset({
    decisions: [
      {
        id: "d1",
        organization_id: ORG,
        venture_id: null,
        title: "Pick database",
        status: "revisit_later",
        final_decision: null,
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-07-01T00:00:00Z",
        review_date: null,
        deleted_at: null,
      },
    ],
  });
  const out = detectDecisionReversals(ds);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternKey, "decision_reversal");
});

test("inactive venture detector fires when no activity in window", () => {
  const ds = emptyDataset({
    ventures: [
      { id: "v1", organization_id: ORG, name: "Warpath", stage: "growth", updated_at: "2026-05-01T00:00:00Z", deleted_at: null },
    ],
  });
  const out = detectInactiveVentures(ds);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternKey, "inactive_venture");
});

test("long-running project detector fires after 90 days", () => {
  const ds = emptyDataset({
    projects: [project({ id: "lr", created_at: "2026-01-01T00:00:00Z", status: "active" })],
  });
  const out = detectLongRunningProjects(ds);
  assert.equal(out.length, 1);
  assert.equal(out[0].patternKey, "long_running_project");
});

test("goal drift detector fires on active goal with stale progress", () => {
  const ds = emptyDataset({
    goals: [
      {
        id: "g1",
        organization_id: ORG,
        venture_id: null,
        title: "Reach 1000 users",
        status: "active",
        progress_percentage: 5,
        target_date: "2026-08-01",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      },
    ],
  });
  const out = detectGoalDrift(ds);
  assert.ok(out.length >= 1);
  assert.equal(out[0].patternKey, "goal_drift");
});

test("runAllDetectors composes and orderFindings sorts critical first", () => {
  const ds = emptyDataset({
    projects: [project({ id: "s1", updated_at: "2026-01-01T00:00:00Z", status: "active" })],
    commitments: [commitment({ postponement_count: 10 })],
  });
  const findings = runAllDetectors(ds);
  assert.ok(findings.length >= 2);
  const ordered = orderFindings(findings);
  const rank = { critical: 0, high: 1, normal: 2, low: 3 };
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(rank[ordered[i - 1].priority] <= rank[ordered[i].priority]);
  }
});

test("computeHealth returns bounded overall in [0,1]", () => {
  const ds = emptyDataset({
    projects: [project({ status: "completed", updated_at: NOW.toISOString() })],
  });
  const health = computeHealth(ds);
  assert.ok(health.overall >= 0 && health.overall <= 1);
  assert.ok(Object.keys(health.categories).length > 0);
});

test("healthBand maps ranges", () => {
  assert.equal(healthBand(0.9), "very_high");
  assert.equal(healthBand(0.7), "high");
  assert.equal(healthBand(0.5), "moderate");
  assert.equal(healthBand(0.1), "low");
});

test("recommendations engine maps findings to cited actions", () => {
  const ds = emptyDataset({
    projects: [project({ id: "stale", updated_at: "2026-01-01T00:00:00Z", status: "active" })],
  });
  const findings = detectStalledProjects(ds);
  const drafts = recommendationsForAll(findings);
  assert.ok(drafts.length >= 1);
  assert.ok(drafts[0].title.length > 0);
  const per = recommendationsFor(findings[0]);
  assert.ok(per.length >= 1);
});

test("digest assembles at least one section when there are findings", () => {
  const ds = emptyDataset({
    commitments: [
      commitment({ id: "d1", due_date: "2026-07-10T00:00:00Z", status: "open" }),
    ],
  });
  const health = computeHealth(ds);
  const digest = assembleDigest({
    dataset: ds,
    insights: [],
    recommendations: [],
    health,
    healthSnapshotId: "hs1",
    recentlyLearned: [],
    recentWins: [],
  });
  assert.ok(Array.isArray(digest.sections));
  assert.ok(digest.sections.length > 0);
});