// Unit tests for pure billing helpers. Run with: node --test src/lib/billing/billing.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  splitSetupFee,
  buildIdempotencyKey,
  normalizeCurrency,
  isValidCurrency,
  formatMoney,
  DEFAULT_CURRENCY,
} from "./money.ts";

test("splitSetupFee: even splits perfectly", () => {
  const s = splitSetupFee(10_000);
  assert.equal(s.deposit_cents, 5_000);
  assert.equal(s.final_cents, 5_000);
  assert.equal(s.deposit_cents + s.final_cents, 10_000);
});

test("splitSetupFee: odd amount preserves exact total", () => {
  const s = splitSetupFee(10_001);
  assert.equal(s.deposit_cents, 5_000);
  assert.equal(s.final_cents, 5_001);
  assert.equal(s.deposit_cents + s.final_cents, 10_001);
});

test("splitSetupFee: zero", () => {
  const s = splitSetupFee(0);
  assert.equal(s.deposit_cents, 0);
  assert.equal(s.final_cents, 0);
});

test("splitSetupFee: rejects negative and non-integer", () => {
  assert.throws(() => splitSetupFee(-1));
  assert.throws(() => splitSetupFee(1.5));
});

test("buildIdempotencyKey: stable and deterministic", () => {
  const a = buildIdempotencyKey("nsl_inv", "abc", 1, "setup_deposit");
  const b = buildIdempotencyKey("nsl_inv", "abc", 1, "setup_deposit");
  assert.equal(a, b);
  assert.equal(a, "nsl_inv:abc:1:setup_deposit");
});

test("buildIdempotencyKey: changes when any input changes", () => {
  const a = buildIdempotencyKey("nsl_inv", "abc", 1, "setup_deposit");
  const b = buildIdempotencyKey("nsl_inv", "abc", 2, "setup_deposit");
  assert.notEqual(a, b);
});

test("isValidCurrency + normalizeCurrency", () => {
  assert.equal(isValidCurrency("USD"), true);
  assert.equal(isValidCurrency("eur"), false);
  assert.equal(normalizeCurrency("eur"), "EUR");
  assert.equal(normalizeCurrency(null), DEFAULT_CURRENCY);
  assert.equal(normalizeCurrency("bogus"), DEFAULT_CURRENCY);
});

test("formatMoney: en-US display", () => {
  assert.equal(formatMoney(150_000, "USD"), "$1,500.00");
  assert.equal(formatMoney(1, "USD"), "$0.01");
});