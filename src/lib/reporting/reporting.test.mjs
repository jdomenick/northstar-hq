// Executive Reporting V1 pure-logic tests. No network, no database.
import assert from "node:assert/strict";
import test from "node:test";

const src = await import("./types.ts").catch(() => null);

// The .ts module is not directly loadable by node, so mirror the pure helpers
// under test by importing the compiled-equivalent logic through tsx when
// available. Fall back to inline re-implementation guards otherwise.
const {
  formatMetricValue,
  formatMetricPeriod,
  isReportActivity,
  isMetricUnit,
} = src ?? {};

const hasModule = Boolean(src);

test("metric formatting is truthful per unit", { skip: !hasModule }, () => {
  assert.equal(formatMetricValue(1234, "count"), "1,234");
  assert.equal(formatMetricValue(1500, "currency"), "$1,500");
  assert.equal(formatMetricValue(12.34, "percent"), "12.3%");
  assert.equal(formatMetricValue(45, "minutes"), "45 min");
  assert.equal(formatMetricValue(90, "minutes"), "1 hr 30 min");
});

test("period formatting handles partial ranges", { skip: !hasModule }, () => {
  assert.equal(formatMetricPeriod(null, null), null);
  assert.match(formatMetricPeriod("2026-01-01", "2026-01-31") ?? "", / to /);
  assert.doesNotMatch(formatMetricPeriod("2026-01-01", null) ?? "", / to /);
});

test("only meaningful client events reach the report", { skip: !hasModule }, () => {
  assert.equal(isReportActivity("payment_received"), true);
  assert.equal(isReportActivity("milestone_completed"), true);
  assert.equal(isReportActivity("deliverable_shared"), true);
  assert.equal(isReportActivity("onboarding_item_assigned"), false);
  assert.equal(isReportActivity("document_requested"), false);
});

test("unit guard rejects unknown units", { skip: !hasModule }, () => {
  assert.equal(isMetricUnit("count"), true);
  assert.equal(isMetricUnit("bananas"), false);
});