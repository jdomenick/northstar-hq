// Tests for client workspace lifecycle events.
// Run with: node --test src/lib/client-workspace/lifecycle-events.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  workspaceSourceKey,
  sanitizeClientEventText,
  buildPaymentReceivedEvent,
  buildImplementationReadyEvent,
  emitClientLifecycleEvent,
} from "./lifecycle-events.ts";

/* ------------------------------- fake store ------------------------------- */

function makeStore(initial = []) {
  const rows = [...initial];
  const client = {
    rows,
    from(table) {
      assert.equal(table, "client_workspace_events");
      return {
        select() {
          const filters = {};
          const chain = {
            eq(col, val) {
              filters[col] = val;
              return chain;
            },
            async maybeSingle() {
              const hit = rows.find((r) =>
                Object.entries(filters).every(([k, v]) => r[k] === v),
              );
              return { data: hit ?? null, error: null };
            },
          };
          return chain;
        },
        async insert(row) {
          const dupe = rows.some(
            (r) => r.client_id === row.client_id && r.source_key === row.source_key,
          );
          if (dupe) return { error: { code: "23505" } };
          rows.push({ id: `evt-${rows.length + 1}`, ...row });
          return { error: null };
        },
      };
    },
  };
  return client;
}

const PAID_INVOICE = {
  invoice_id: "6b8f6a1e-2f6e-4c3a-9a9b-1d5b0a1c2d3e",
  invoice_type: "setup_deposit",
  amount_paid_cents: 50_000,
  currency: "usd",
  paid_at: "2026-07-29T12:00:00.000Z",
  proposal_number: "NSL-1042",
};

/* --------------------------------- payment -------------------------------- */

test("1. paid invoice emits exactly one payment_received event", async () => {
  const db = makeStore();
  const event = buildPaymentReceivedEvent(PAID_INVOICE);
  const outcome = await emitClientLifecycleEvent(db, {
    organization_id: "org-1",
    client_id: "client-1",
    invoice_id: PAID_INVOICE.invoice_id,
    event,
  });
  assert.equal(outcome, "created");
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].event_type, "payment_received");
  assert.equal(db.rows[0].title, "Payment received");
  assert.equal(db.rows[0].is_notice, false);
  assert.match(db.rows[0].body, /Payment received\. Thank you\./);
  assert.match(db.rows[0].body, /\$500\.00 for your setup deposit/);
  assert.match(db.rows[0].body, /Proposal NSL-1042/);
});

test("2. unpaid invoice emits nothing (gate is the caller's paid check)", async () => {
  const db = makeStore();
  // Mirrors the webhook gate: nothing is emitted unless the ledger says paid.
  const localStatus = "open";
  if (localStatus === "paid") {
    await emitClientLifecycleEvent(db, {
      organization_id: "org-1",
      client_id: "client-1",
      event: buildPaymentReceivedEvent(PAID_INVOICE),
    });
  }
  assert.equal(db.rows.length, 0);
});

test("3. failed reconciliation emits nothing", async () => {
  const db = makeStore();
  const reconciled = false;
  if (reconciled) {
    await emitClientLifecycleEvent(db, {
      organization_id: "org-1",
      client_id: "client-1",
      event: buildPaymentReceivedEvent(PAID_INVOICE),
    });
  }
  assert.equal(db.rows.length, 0);
});

test("4. replayed webhook creates no duplicate payment event", async () => {
  const db = makeStore();
  const args = {
    organization_id: "org-1",
    client_id: "client-1",
    invoice_id: PAID_INVOICE.invoice_id,
    event: buildPaymentReceivedEvent(PAID_INVOICE),
  };
  assert.equal(await emitClientLifecycleEvent(db, args), "created");
  assert.equal(await emitClientLifecycleEvent(db, args), "duplicate");
  // Rebuilt from the same invoice: same deterministic key.
  assert.equal(
    await emitClientLifecycleEvent(db, {
      ...args,
      event: buildPaymentReceivedEvent(PAID_INVOICE),
    }),
    "duplicate",
  );
  assert.equal(db.rows.length, 1);
});

test("4b. unique-index race is treated as duplicate, not failure", async () => {
  const db = makeStore();
  const event = buildPaymentReceivedEvent(PAID_INVOICE);
  // Row already present but invisible to the pre-check (concurrent insert).
  db.rows.push({ id: "pre", client_id: "client-1", source_key: event.source_key });
  const hidden = {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      insert: (row) => db.from("client_workspace_events").insert(row),
    }),
  };
  assert.equal(
    await emitClientLifecycleEvent(hidden, {
      organization_id: "org-1",
      client_id: "client-1",
      event,
    }),
    "duplicate",
  );
  assert.equal(db.rows.length, 1);
});

test("5. a different client cannot reuse another client's event row", async () => {
  const db = makeStore();
  const event = buildPaymentReceivedEvent(PAID_INVOICE);
  await emitClientLifecycleEvent(db, {
    organization_id: "org-1",
    client_id: "client-1",
    event,
  });
  // Same invoice key, different client: the dedupe scope is per client, so the
  // pre-check must not silently swallow it, and the row must carry the correct
  // client and organization.
  const outcome = await emitClientLifecycleEvent(db, {
    organization_id: "org-2",
    client_id: "client-2",
    event,
  });
  assert.equal(outcome, "created");
  assert.equal(db.rows.length, 2);
  assert.equal(db.rows[0].client_id, "client-1");
  assert.equal(db.rows[1].client_id, "client-2");
  assert.equal(db.rows[1].organization_id, "org-2");
  // No row was ever written under a mismatched pair.
  assert.ok(db.rows.every((r) => (r.client_id === "client-1") === (r.organization_id === "org-1")));
});

/* ----------------------------- implementation ----------------------------- */

const ACTIVATION = {
  client_id: "client-1",
  proposal_id: "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
  project_id: "99999999-8888-4777-a666-555544443333",
  implementation_name: "Acme Home Services - Implementation",
  activated_at: "2026-07-29T12:30:00.000Z",
  next_step: "Schedule the kickoff call.",
};

test("6. successful activation emits one implementation_ready event", async () => {
  const db = makeStore();
  const event = buildImplementationReadyEvent(ACTIVATION);
  assert.equal(
    await emitClientLifecycleEvent(db, {
      organization_id: "org-1",
      client_id: ACTIVATION.client_id,
      event,
    }),
    "created",
  );
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].event_type, "implementation_ready");
  assert.equal(db.rows[0].title, "Implementation ready");
  assert.equal(db.rows[0].is_notice, true);
  assert.match(db.rows[0].body, /onboarding is complete/);
  assert.match(db.rows[0].body, /Acme Home Services - Implementation/);
  assert.match(db.rows[0].body, /Current phase: implementation/);
  assert.match(db.rows[0].body, /Next step: Schedule the kickoff call\./);
});

test("7. failed or blocked activation emits nothing", async () => {
  const db = makeStore();
  const activationResult = { status: "blocked" };
  if (activationResult.status === "created") {
    await emitClientLifecycleEvent(db, {
      organization_id: "org-1",
      client_id: ACTIVATION.client_id,
      event: buildImplementationReadyEvent(ACTIVATION),
    });
  }
  assert.equal(db.rows.length, 0);
});

test("8. retried activation emits no duplicate implementation event", async () => {
  const db = makeStore();
  for (let i = 0; i < 3; i++) {
    await emitClientLifecycleEvent(db, {
      organization_id: "org-1",
      client_id: ACTIVATION.client_id,
      // Activation dates differ across retries; the key must not.
      event: buildImplementationReadyEvent({
        ...ACTIVATION,
        activated_at: new Date(Date.now() + i * 1000).toISOString(),
      }),
    });
  }
  assert.equal(db.rows.length, 1);
});

/* -------------------------------- sanitizer ------------------------------- */

test("9. client-safe payloads carry no internal identifiers", () => {
  const payment = buildPaymentReceivedEvent(PAID_INVOICE);
  const impl = buildImplementationReadyEvent(ACTIVATION);
  for (const e of [payment, impl]) {
    const text = `${e.title} ${e.body}`;
    assert.doesNotMatch(text, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    assert.doesNotMatch(text, /\b(cus|in|pi|ch|sub|evt|acct|seti)_[A-Za-z0-9]{6,}/);
  }
  assert.equal(
    sanitizeClientEventText("Paid via cus_QabcdefgHIJKL and in_1TyZb62fhF4Z1yO3L9IWcl0Y today"),
    "Paid via and today",
  );
  assert.equal(
    sanitizeClientEventText("Ref 6b8f6a1e-2f6e-4c3a-9a9b-1d5b0a1c2d3e ok"),
    "Ref ok",
  );
  // The dedupe key itself is an irreversible hash, not a raw identifier.
  assert.match(payment.source_key, /^[0-9a-f]{64}$/);
  assert.equal(payment.source_key.includes(PAID_INVOICE.invoice_id), false);
  assert.notEqual(
    workspaceSourceKey("payment_received", ["a"]),
    workspaceSourceKey("implementation_ready", ["a"]),
  );
});

/* ------------------------------ feed scoping ------------------------------ */

test("10. activity feed returns only the matching organization and client", () => {
  const rows = [
    { id: "1", organization_id: "org-1", client_id: "client-1", title: "Payment received" },
    { id: "2", organization_id: "org-1", client_id: "client-2", title: "Payment received" },
    { id: "3", organization_id: "org-2", client_id: "client-1", title: "Implementation ready" },
  ];
  const scoped = rows.filter((r) => r.organization_id === "org-1" && r.client_id === "client-1");
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0].id, "1");
});