// Framework tests for the Meta connector. No network. No DB.
// Focus: idempotency stability, config status truth, capability summary.

import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveIdempotencyKey } from "./idempotency.ts";
import { readMetaConfigStatus, META_GRAPH_VERSION } from "./config.server.ts";
import { summarizeMetaCapabilities } from "./capabilities.ts";

test("idempotency key is stable across identical inputs", () => {
  const input = {
    organizationId: "11111111-1111-1111-1111-111111111111",
    contentItemId: "22222222-2222-2222-2222-222222222222",
    approvedVersionId: "3",
    destinationExternalId: "page_123",
    provider: "facebook",
    publishGeneration: 1,
  };
  assert.equal(deriveIdempotencyKey(input), deriveIdempotencyKey(input));
});

test("idempotency key changes when publishGeneration bumps", () => {
  const base = {
    organizationId: "11111111-1111-1111-1111-111111111111",
    contentItemId: "22222222-2222-2222-2222-222222222222",
    approvedVersionId: "3",
    destinationExternalId: "page_123",
    provider: "instagram",
    publishGeneration: 1,
  };
  const a = deriveIdempotencyKey(base);
  const b = deriveIdempotencyKey({ ...base, publishGeneration: 2 });
  assert.notEqual(a, b);
});

test("readMetaConfigStatus reports missing vars truthfully when unset", () => {
  const prior = { id: process.env.META_APP_ID, secret: process.env.META_APP_SECRET, tok: process.env.META_WEBHOOK_VERIFY_TOKEN };
  delete process.env.META_APP_ID;
  delete process.env.META_APP_SECRET;
  delete process.env.META_WEBHOOK_VERIFY_TOKEN;
  const status = readMetaConfigStatus();
  assert.equal(status.configured, false);
  assert.deepEqual(status.missing.sort(), ["META_APP_ID","META_APP_SECRET","META_WEBHOOK_VERIFY_TOKEN"].sort());
  assert.equal(status.graphVersion, META_GRAPH_VERSION);
  if (prior.id) process.env.META_APP_ID = prior.id;
  if (prior.secret) process.env.META_APP_SECRET = prior.secret;
  if (prior.tok) process.env.META_WEBHOOK_VERIFY_TOKEN = prior.tok;
});

test("capability summary is blocked when not configured", () => {
  const s = summarizeMetaCapabilities({
    configured: false, connected: false, grantedPermissions: [],
    destinationCount: 0, publishableDestinationCount: 0, provider: "facebook",
  });
  assert.equal(s.canPublish, false);
});

test("capability summary is publish-ready when configured, connected, permissions granted, destinations publishable", () => {
  const s = summarizeMetaCapabilities({
    configured: true, connected: true,
    grantedPermissions: ["pages_manage_posts","pages_read_engagement","pages_show_list"],
    destinationCount: 1, publishableDestinationCount: 1, provider: "facebook",
  });
  assert.equal(s.canPublish, true);
});
