// Pure tests for the unified status label module.
import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  UNIFIED_STATUSES,
  statusDescriptor,
  statusLabel,
  unifyStatus,
  compareStatus,
  isTerminalStatus,
  isBlockedStatus,
} from "./status-labels.ts";

test("every unified status has a descriptor with label and tone", () => {
  for (const s of UNIFIED_STATUSES) {
    const d = statusDescriptor(s);
    assert.equal(d.status, s);
    assert.ok(d.label.length > 0);
    assert.ok(d.eyebrow.length > 0);
    assert.ok(d.description.length > 0);
    assert.ok(typeof d.sortRank === "number");
  }
});

test("unifyStatus maps common aliases", () => {
  assert.equal(unifyStatus("pending"), "ready_for_approval");
  assert.equal(unifyStatus("in_review"), "ready_for_approval");
  assert.equal(unifyStatus("rejected"), "needs_review");
  assert.equal(unifyStatus("queued"), "scheduled");
  assert.equal(unifyStatus("running"), "publishing");
  assert.equal(unifyStatus("succeeded"), "published");
  assert.equal(unifyStatus("cancelled"), "canceled");
  assert.equal(unifyStatus("Draft"), "draft");
  assert.equal(unifyStatus("APPROVED"), "approved");
});

test("unifyStatus returns null for unknown so callers do not lie", () => {
  assert.equal(unifyStatus(""), null);
  assert.equal(unifyStatus(null), null);
  assert.equal(unifyStatus(undefined), null);
  assert.equal(unifyStatus("frobnicated"), null);
});

test("compareStatus orders draft before published", () => {
  assert.ok(compareStatus("draft", "published") < 0);
  assert.ok(compareStatus("scheduled", "draft") > 0);
  assert.equal(compareStatus("approved", "approved"), 0);
});

test("terminal and blocked classifications", () => {
  assert.equal(isTerminalStatus("published"), true);
  assert.equal(isTerminalStatus("canceled"), true);
  assert.equal(isTerminalStatus("archived"), true);
  assert.equal(isTerminalStatus("draft"), false);
  assert.equal(isTerminalStatus("scheduled"), false);
  assert.equal(isBlockedStatus("failed"), true);
  assert.equal(isBlockedStatus("needs_review"), true);
  assert.equal(isBlockedStatus("approved"), false);
});

test("statusLabel is title case", () => {
  assert.equal(statusLabel("ready_for_approval"), "Ready for Approval");
  assert.equal(statusLabel("needs_review"), "Needs Review");
});