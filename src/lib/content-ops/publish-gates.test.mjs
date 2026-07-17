// Pure-function tests for the publish gates. Run with: node --test
// Only covers the deterministic helpers that need no Supabase.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkApproval,
  checkContentBounds,
  checkIdempotency,
  checkSchedule,
} from "./publish-gates-pure.ts";

test("approval: rejects non-approved", () => {
  const r = checkApproval({ approval_status: "pending", approved_content_version: 1, content_version: 1 });
  assert.equal(r?.reason, "not_approved");
});
test("approval: rejects stale approved version", () => {
  const r = checkApproval({ approval_status: "approved", approved_content_version: 1, content_version: 2 });
  assert.equal(r?.reason, "approval_stale");
});
test("approval: accepts matching approved version", () => {
  const r = checkApproval({ approval_status: "approved", approved_content_version: 3, content_version: 3 });
  assert.equal(r, null);
});
test("idempotency: rejects already-published", () => {
  const r = checkIdempotency({ status: "published", external_post_id: null });
  assert.equal(r?.reason, "already_published");
});
test("idempotency: rejects when external id already stamped", () => {
  const r = checkIdempotency({ status: "scheduled", external_post_id: "post_1" });
  assert.equal(r?.reason, "already_published");
});
test("content bounds: beehiiv rejects missing subject", () => {
  const r = checkContentBounds({ platform: "beehiiv", body: "x".repeat(200), newsletter_subject: "" });
  assert.equal(r?.reason, "newsletter_subject_required");
});
test("content bounds: beehiiv rejects short body", () => {
  const r = checkContentBounds({ platform: "beehiiv", body: "short", newsletter_subject: "ok" });
  assert.equal(r?.reason, "body_too_short");
});
test("content bounds: beehiiv accepts valid", () => {
  const r = checkContentBounds({ platform: "beehiiv", body: "x".repeat(200), newsletter_subject: "ok" });
  assert.equal(r, null);
});
test("content bounds: rejects other platforms in 6a", () => {
  const r = checkContentBounds({ platform: "instagram", body: "x".repeat(200), newsletter_subject: "ok" });
  assert.equal(r?.reason, "platform_not_supported_in_6a");
});
test("schedule: manual trigger bypasses schedule check", () => {
  const r = checkSchedule({ scheduled_for: null }, "manual");
  assert.equal(r, null);
});
test("schedule: scheduled trigger without time is rejected", () => {
  const r = checkSchedule({ scheduled_for: null }, "scheduled");
  assert.equal(r?.reason, "no_scheduled_time");
});
test("schedule: future time is rejected", () => {
  const future = new Date(Date.now() + 3600_000).toISOString();
  const r = checkSchedule({ scheduled_for: future }, "scheduled", new Date());
  assert.equal(r?.reason, "scheduled_in_future");
});
test("schedule: past time passes", () => {
  const past = new Date(Date.now() - 3600_000).toISOString();
  const r = checkSchedule({ scheduled_for: past }, "scheduled", new Date());
  assert.equal(r, null);
});