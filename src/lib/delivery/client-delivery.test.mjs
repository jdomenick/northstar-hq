// Node test suite for the pure delivery resolvers.
// Run: node --test src/lib/delivery/client-delivery.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  deliveryProgress,
  resolveDeliveryHealth,
  resolveDeliveryNextStep,
  stageLabelFor,
} from "./client-delivery.ts";

const milestone = (over = {}) => ({
  id: over.id ?? "m1",
  title: over.title ?? "Milestone",
  description: over.description ?? "",
  status: over.status ?? "upcoming",
  target_date: over.target_date ?? null,
  completed_at: over.completed_at ?? null,
  requires_client_action: over.requires_client_action ?? false,
  sort_order: over.sort_order ?? 0,
});

const deliverable = (over = {}) => ({
  id: over.id ?? "d1",
  title: over.title ?? "Deliverable",
  instructions: "",
  version_label: "",
  status: over.status ?? "preparing",
  requires_client_review: over.requires_client_review ?? false,
  milestone_id: null,
  file_name: null,
  has_file: true,
  shared_at: null,
  approved_at: null,
  revision_reason: "",
});

const project = (over = {}) => ({
  id: "p1",
  title: "Implementation",
  summary: "",
  stage: over.stage ?? "setup",
  stage_label: "Setup",
  next_action: over.next_action ?? "",
  started_at: null,
  completed_at: null,
});

test("progress is null when there is nothing to measure", () => {
  assert.deepEqual(deliveryProgress([]), { total: 0, complete: 0, percent: null });
  assert.deepEqual(deliveryProgress([milestone({ status: "skipped" })]), {
    total: 0,
    complete: 0,
    percent: null,
  });
});

test("progress counts only non-skipped milestones", () => {
  const result = deliveryProgress([
    milestone({ id: "a", status: "complete" }),
    milestone({ id: "b", status: "in_progress" }),
    milestone({ id: "c", status: "skipped" }),
  ]);
  assert.deepEqual(result, { total: 2, complete: 1, percent: 50 });
});

test("blocked and at risk internal status wins over everything", () => {
  assert.equal(
    resolveDeliveryHealth({
      projectStatus: "blocked",
      stage: "setup",
      milestones: [milestone({ status: "waiting_on_client" })],
      deliverables: [],
    }),
    "blocked",
  );
  assert.equal(
    resolveDeliveryHealth({
      projectStatus: "at_risk",
      stage: "setup",
      milestones: [],
      deliverables: [],
    }),
    "at_risk",
  );
});

test("waiting on client is derived from open client work", () => {
  assert.equal(
    resolveDeliveryHealth({
      projectStatus: "active",
      stage: "review",
      milestones: [],
      deliverables: [deliverable({ status: "ready_for_review", requires_client_review: true })],
    }),
    "waiting_on_client",
  );
});

test("not started when nothing has moved", () => {
  assert.equal(
    resolveDeliveryHealth({
      projectStatus: "planned",
      stage: "preparation",
      milestones: [milestone({ status: "upcoming" })],
      deliverables: [],
    }),
    "not_started",
  );
});

test("complete stage reports complete", () => {
  assert.equal(
    resolveDeliveryHealth({
      projectStatus: "active",
      stage: "complete",
      milestones: [],
      deliverables: [],
    }),
    "complete",
  );
});

test("no project yields a truthful not-started next step", () => {
  const step = resolveDeliveryNextStep({
    project: null,
    health: "not_started",
    milestones: [],
    deliverables: [],
  });
  assert.equal(step.action, "none");
  assert.match(step.headline, /not started/i);
});

test("deliverable review outranks a waiting milestone", () => {
  const step = resolveDeliveryNextStep({
    project: project(),
    health: "waiting_on_client",
    milestones: [milestone({ status: "waiting_on_client", title: "Send logins" })],
    deliverables: [
      deliverable({ id: "d9", status: "ready_for_review", requires_client_review: true, title: "Plan" }),
    ],
  });
  assert.equal(step.action, "review_deliverable");
  assert.equal(step.deliverable_id, "d9");
});

test("waiting milestone surfaces when no deliverable needs review", () => {
  const step = resolveDeliveryNextStep({
    project: project(),
    health: "waiting_on_client",
    milestones: [milestone({ id: "m7", status: "waiting_on_client", title: "Send logins" })],
    deliverables: [],
  });
  assert.equal(step.action, "complete_milestone");
  assert.equal(step.milestone_id, "m7");
});

test("operator next action is shown verbatim when nothing is pending", () => {
  const step = resolveDeliveryNextStep({
    project: project({ next_action: "Wiring your call tracking numbers." }),
    health: "on_track",
    milestones: [],
    deliverables: [],
  });
  assert.equal(step.action, "wait");
  assert.equal(step.detail, "Wiring your call tracking numbers.");
});

test("blocked health explains itself without a client action", () => {
  const step = resolveDeliveryNextStep({
    project: project(),
    health: "blocked",
    milestones: [],
    deliverables: [],
  });
  assert.equal(step.action, "wait");
  assert.match(step.headline, /blocked/i);
});

test("stage label falls back to the standard name", () => {
  assert.equal(stageLabelFor("launch", ""), "Launch");
  assert.equal(stageLabelFor("launch", "  Go live  "), "Go live");
});