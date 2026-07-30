// Executive Reporting V1 pure-logic tests. No network, no database.
// Run: node --test src/lib/reporting/reporting.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMetricValue,
  formatMetricPeriod,
  isReportActivity,
  isMetricUnit,
} from "./types.ts";
import { buildBillingSnapshot } from "./billing-snapshot.ts";

test("metric formatting is truthful per unit", () => {
  assert.equal(formatMetricValue(1234, "count"), "1,234");
  assert.equal(formatMetricValue(1500, "currency"), "$1,500");
  assert.equal(formatMetricValue(12.34, "percent"), "12.3%");
  assert.equal(formatMetricValue(45, "minutes"), "45 min");
  assert.equal(formatMetricValue(90, "minutes"), "1 hr 30 min");
});

test("period formatting handles partial ranges", () => {
  assert.equal(formatMetricPeriod(null, null), null);
  assert.match(formatMetricPeriod("2026-01-01", "2026-01-31") ?? "", / to /);
  assert.doesNotMatch(formatMetricPeriod("2026-01-01", null) ?? "", / to /);
});

test("only meaningful client events reach the report", () => {
  assert.equal(isReportActivity("payment_received"), true);
  assert.equal(isReportActivity("milestone_completed"), true);
  assert.equal(isReportActivity("deliverable_shared"), true);
  assert.equal(isReportActivity("onboarding_item_assigned"), false);
  assert.equal(isReportActivity("document_requested"), false);
});

test("unit guard rejects unknown units", () => {
  assert.equal(isMetricUnit("count"), true);
  assert.equal(isMetricUnit("bananas"), false);
});

const invoice = (over = {}) => ({
  id: over.id ?? "i1",
  label: over.label ?? "Setup deposit",
  status: over.status ?? "paid",
  amount_cents: over.amount_cents ?? 100000,
  amount_remaining_cents: over.amount_remaining_cents ?? 0,
  currency: "usd",
  due_at: over.due_at ?? null,
  paid_at: over.paid_at ?? null,
});

test("billing snapshot with no invoices invents nothing", () => {
  const b = buildBillingSnapshot("Onboarding", []);
  assert.equal(b.outstanding_cents, 0);
  assert.equal(b.last_payment, null);
  assert.equal(b.next_invoice, null);
  assert.equal(b.invoices.length, 0);
});

test("billing snapshot reports outstanding, last payment, and next invoice", () => {
  const b = buildBillingSnapshot("Implementation", [
    invoice({ id: "paid1", paid_at: "2026-01-10T00:00:00Z" }),
    invoice({
      id: "paid2",
      label: "Setup final",
      paid_at: "2026-02-10T00:00:00Z",
      amount_cents: 50000,
    }),
    invoice({
      id: "open1",
      label: "Monthly retainer",
      status: "open",
      amount_cents: 30000,
      amount_remaining_cents: 30000,
      due_at: "2026-03-01T00:00:00Z",
    }),
  ]);
  assert.equal(b.outstanding_cents, 30000);
  assert.equal(b.last_payment?.paid_at, "2026-02-10T00:00:00Z");
  assert.equal(b.last_payment?.amount_cents, 50000);
  assert.equal(b.next_invoice?.label, "Monthly retainer");
  assert.equal(b.next_invoice?.amount_cents, 30000);
});

test("paid invoices never count toward outstanding balance", () => {
  const b = buildBillingSnapshot("Active", [invoice({ paid_at: "2026-01-10T00:00:00Z" })]);
  assert.equal(b.outstanding_cents, 0);
});