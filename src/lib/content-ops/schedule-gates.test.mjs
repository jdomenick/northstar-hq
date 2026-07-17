// Deterministic tests for schedule gates + timezone conversions.
// Node test runner style.

import { test } from "node:test";
import assert from "node:assert/strict";

const gates = await import("./schedule-gates.ts");
const tz = await import("./timezone.ts");

function baseCtx(overrides = {}) {
  return {
    item: {
      id: "i", organization_id: "o", venture_id: "v",
      platform: "beehiiv", status: "ready",
      approval_status: "approved", approved_content_version: 1, content_version: 1,
      external_post_id: null, duplicate_fingerprint: "fp",
      scheduled_for: null, body: "hello there this is a body",
      title: "Subject line",
      hook: null, cta: null, hashtags: null,
      media_requirements: null, media_status: "ready",
      risk_band: "low", newsletter_subject: "Weekly note",
    },
    desiredScheduledFor: new Date(Date.now() + 3600_000),
    now: new Date(),
    autonomy: { emergency_pause: false, platform_pauses: {}, mode: "approval_required" },
    ventureSocial: { paused: false, publishing_enabled: true, allowed_platforms: null, default_timezone: "UTC", maximum_posts_per_day: 10 },
    killSwitches: [],
    connectorReady: true,
    destinationSelected: true,
    duplicateExists: false,
    maxHorizonDays: 180,
    ...overrides,
  };
}

test("passes for a healthy approved item", () => {
  const r = gates.evaluateScheduleGates(baseCtx());
  const blocking = r.failures.filter((f) => f.severity === "blocking");
  assert.equal(blocking.length, 0, JSON.stringify(r.failures));
  assert.equal(r.executableAllowed, true);
});

test("blocks unapproved items", () => {
  const r = gates.evaluateScheduleGates(baseCtx({ item: { ...baseCtx().item, approval_status: "pending" } }));
  assert.ok(r.failures.some((f) => f.gate === "approval_current"));
});

test("blocks when emergency pause is on", () => {
  const r = gates.evaluateScheduleGates(baseCtx({ autonomy: { emergency_pause: true, platform_pauses: {}, mode: "approval_required" } }));
  assert.ok(r.failures.some((f) => f.gate === "emergency_pause"));
});

test("connector_ready failure downgrades to editorial_only when platform not wired", () => {
  const r = gates.evaluateScheduleGates(baseCtx({ connectorReady: false }));
  const cr = r.failures.find((f) => f.gate === "connector_ready");
  assert.ok(cr, "expected connector_ready failure");
  assert.equal(r.editorialAllowed, true);
  assert.equal(r.executableAllowed, false);
});

test("blocks duplicates", () => {
  const r = gates.evaluateScheduleGates(baseCtx({ duplicateExists: true }));
  assert.ok(r.failures.some((f) => f.gate === "duplicate_fingerprint"));
});

test("blocks past-in-time schedules", () => {
  const r = gates.evaluateScheduleGates(baseCtx({ desiredScheduledFor: new Date(Date.now() - 300_000) }));
  assert.ok(r.failures.some((f) => f.gate === "schedule_time_future"));
});

test("blocks far-future beyond horizon", () => {
  const r = gates.evaluateScheduleGates(baseCtx({ desiredScheduledFor: new Date(Date.now() + 365 * 86400_000) }));
  assert.ok(r.failures.some((f) => f.gate === "schedule_time_within_horizon"));
});

test("retryEligibility respects attempt cap", () => {
  const r = gates.retryEligibility({ jobStatus: "failed", attemptNumber: 3, maxAttempts: 3, errorCode: "provider_error" });
  assert.equal(r.eligible, false);
});

test("retryEligibility allows retry when failed and attempts remain", () => {
  const r = gates.retryEligibility({ jobStatus: "failed", attemptNumber: 1, maxAttempts: 3, errorCode: "provider_error" });
  assert.equal(r.eligible, true);
  assert.equal(r.nextAttempt, 2);
});

test("idempotency key is stable per version, destination, and minute", () => {
  const a = gates.buildPublishIdempotencyKey({ contentItemId: "i1", contentVersion: 1, destinationKey: "beehiiv", scheduledForIsoMinute: "2026-01-01T10:00" });
  const b = gates.buildPublishIdempotencyKey({ contentItemId: "i1", contentVersion: 1, destinationKey: "beehiiv", scheduledForIsoMinute: "2026-01-01T10:00" });
  assert.equal(a, b);
});

test("idempotency key changes with content version", () => {
  const a = gates.buildPublishIdempotencyKey({ contentItemId: "i1", contentVersion: 1, destinationKey: "beehiiv", scheduledForIsoMinute: "2026-01-01T10:00" });
  const b = gates.buildPublishIdempotencyKey({ contentItemId: "i1", contentVersion: 2, destinationKey: "beehiiv", scheduledForIsoMinute: "2026-01-01T10:00" });
  assert.notEqual(a, b);
});

test("timezone conversion roundtrips UTC", () => {
  const utc = new Date("2026-06-15T14:30:00Z");
  const wall = tz.utcToWallTime(utc, "UTC");
  const back = tz.wallTimeToUtc(wall, "UTC");
  assert.equal(back.toISOString(), utc.toISOString());
});

test("timezone conversion handles DST for America/New_York in July", () => {
  // 10:00 wall time in NY in July = 14:00 UTC (EDT is UTC-4)
  const wall = { year: 2026, month: 7, day: 15, hour: 10, minute: 0 };
  const utc = tz.wallTimeToUtc(wall, "America/New_York");
  assert.equal(utc.toISOString(), "2026-07-15T14:00:00.000Z");
});

test("timezone conversion handles DST for America/New_York in January", () => {
  // 10:00 wall time in NY in January = 15:00 UTC (EST is UTC-5)
  const wall = { year: 2026, month: 1, day: 15, hour: 10, minute: 0 };
  const utc = tz.wallTimeToUtc(wall, "America/New_York");
  assert.equal(utc.toISOString(), "2026-01-15T15:00:00.000Z");
});

test("resolveVentureTimezone falls back to UTC on invalid input", () => {
  assert.equal(tz.resolveVentureTimezone(null), "UTC");
  assert.equal(tz.resolveVentureTimezone("Nowhere/Nothing"), "UTC");
  assert.equal(tz.resolveVentureTimezone("America/New_York"), "America/New_York");
});
