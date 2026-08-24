// Cross-app module reporting tests. No network, no database.
// Run: bun test src/lib/module-reporting/module-reporting.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  REPORTING_SECRET_HEADER,
  buildOutcomeJourney,
  mergeActivity,
  mergeChannelPerformance,
  countLive,
  moduleNotConnected,
  moduleOk,
  normalizeCam,
  normalizeCcm,
  normalizeCrm,
  normalizeSam,
  formatCents,
} from "./types.ts";
import { buildReportingHeaders, buildReportingUrl, fetchModuleReport } from "./fetcher.ts";

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("adapter sends the shared reporting secret header and scoped query", async () => {
  let seenUrl = null;
  let seenHeaders = null;
  const source = await fetchModuleReport({
    module: "cam",
    baseUrl: "https://cam.example.com",
    secret: "s3cret",
    externalId: "tenant-42",
    range: "mtd",
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenHeaders = init.headers;
      return jsonResponse({ version: "1.2", leads: 318 });
    },
  });

  assert.equal(seenHeaders[REPORTING_SECRET_HEADER], "s3cret");
  assert.match(seenUrl, /\/api\/public\/reporting\/hq-dashboard/);
  assert.match(seenUrl, /external_id=tenant-42/);
  assert.match(seenUrl, /range=mtd/);
  assert.equal(source.status, "ok");
  assert.equal(source.version, "1.2");
  assert.equal(source.data.leads, 318);
  assert.equal(source.externalId, "tenant-42");
});

test("secret is never placed in the URL", () => {
  const url = buildReportingUrl("https://cam.example.com", "t1", "mtd");
  assert.ok(!url.includes("s3cret"));
  assert.deepEqual(Object.keys(buildReportingHeaders("s3cret")).sort(), [
    "Accept",
    REPORTING_SECRET_HEADER,
  ].sort());
});

test("missing URL or secret is not_connected, not a fabricated zero", async () => {
  const noUrl = await fetchModuleReport({ module: "ccm", baseUrl: null, secret: "x" });
  assert.equal(noUrl.status, "not_connected");
  assert.equal(noUrl.data, null);

  const noSecret = await fetchModuleReport({
    module: "ccm",
    baseUrl: "https://ccm.example.com",
    secret: "",
  });
  assert.equal(noSecret.status, "not_connected");
});

test("auth rejection and server errors surface as unavailable with reasons", async () => {
  const denied = await fetchModuleReport({
    module: "crm",
    baseUrl: "https://crm.example.com",
    secret: "x",
    fetchImpl: async () => jsonResponse({}, 401),
  });
  assert.equal(denied.status, "unavailable");
  assert.match(denied.reason, /credential/i);

  const missing = await fetchModuleReport({
    module: "crm",
    baseUrl: "https://crm.example.com",
    secret: "x",
    fetchImpl: async () => jsonResponse({}, 404),
  });
  assert.match(missing.reason, /404/);

  const thrown = await fetchModuleReport({
    module: "sam",
    baseUrl: "https://sam.example.com",
    secret: "x",
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
  });
  assert.equal(thrown.status, "unavailable");
  assert.match(thrown.reason, /connection refused/);
});

test("one failing source does not affect the others", async () => {
  const results = await Promise.all([
    fetchModuleReport({
      module: "cam",
      baseUrl: "https://cam.example.com",
      secret: "x",
      fetchImpl: async () => jsonResponse({ leads: 10 }),
    }),
    fetchModuleReport({
      module: "ccm",
      baseUrl: "https://ccm.example.com",
      secret: "x",
      fetchImpl: async () => {
        throw new Error("boom");
      },
    }),
  ]);
  assert.equal(results[0].status, "ok");
  assert.equal(results[1].status, "unavailable");
});

test("normalizers tolerate snake_case, camelCase and missing fields", () => {
  const cam = normalizeCam({
    data: {
      total_leads: "1,284",
      qualifiedLeads: 402,
      spend_cents: 1840000,
      cpl: 41.2,
      channels: [{ channel: "Google Ads", leads: 128, revenue: 26800, delta: 12.1 }],
      trend: [{ label: "Jan", value: 42 }, { nope: true }],
      recent_activity: [{ title: "New lead", status: "success", timestamp: "2026-08-01T10:00:00Z" }],
    },
  });
  assert.equal(cam.leads, 1284);
  assert.equal(cam.qualifiedLeads, 402);
  assert.equal(cam.spendCents, 1840000);
  assert.equal(cam.cplCents, 4120);
  assert.equal(cam.roas, null);
  assert.equal(cam.trend.length, 1);
  assert.equal(cam.channels[0].revenueCents, 2680000);
  assert.equal(cam.activity[0].tone, "ok");

  const ccm = normalizeCcm({ avg_response_minutes: 2, conversations: 241 });
  assert.equal(ccm.avgResponseSeconds, 120);
  assert.equal(ccm.appointments, null);

  const crm = normalizeCrm({ deals_by_stage: [{ name: "New", count: 34 }], open_opportunities: 86 });
  assert.equal(crm.stages[0].value, 34);
  assert.equal(crm.openDeals, 86);
  assert.equal(crm.pipelineValueCents, null);

  const sam = normalizeSam({ success_rate: 0.992, avg_processing_seconds: 0.412, status: "online" });
  assert.equal(Math.round(sam.successRatePct * 10) / 10, 99.2);
  assert.equal(sam.avgProcessingMs, 412);
  assert.equal(sam.status, "online");
});

function dashboardFixture() {
  return {
    cam: moduleOk("cam", normalizeCam({ leads: 318, spend_cents: 1840000, channels: [{ channel: "Google Ads", leads: 128 }], activity: [{ title: "Lead", timestamp: "2026-08-02T10:00:00Z" }] }), "1"),
    ccm: moduleOk("ccm", normalizeCcm({ conversations: 241, appointments: 96, trend: [{ label: "google ads", value: 41 }], activity: [{ title: "Call", timestamp: "2026-08-03T10:00:00Z" }] }), "1"),
    crm: moduleNotConnected("crm", "CRM not mapped for this client."),
    sam: moduleOk("sam", normalizeSam({ status: "online", failures: [{ title: "Retry", timestamp: "2026-08-01T09:00:00Z", status: "warning" }] }), "1"),
  };
}

test("outcome journey uses live sources and stays truthful when unmapped", () => {
  const steps = buildOutcomeJourney(dashboardFixture(), 6240000);
  const byKey = Object.fromEntries(steps.map((s) => [s.key, s]));
  assert.equal(byKey.leads.value, "318");
  assert.equal(byKey.leads.source, "cam");
  assert.equal(byKey.appointments.value, "96");
  assert.equal(byKey.sales.value, null);
  assert.match(byKey.sales.reason, /not mapped/i);
  assert.equal(byKey.revenue.value, "$62,400");
  assert.equal(byKey.revenue.source, "hq");
});

test("revenue step reports no HQ records rather than zero", () => {
  const steps = buildOutcomeJourney(dashboardFixture(), null);
  const revenue = steps.find((s) => s.key === "revenue");
  assert.equal(revenue.value, null);
  assert.match(revenue.reason, /invoice records/i);
});

test("activity merges across sources newest first with source labels", () => {
  const rows = mergeActivity(dashboardFixture());
  assert.deepEqual(rows.map((r) => r.source), ["ccm", "cam", "sam"]);
});

test("channel performance enriches CAM rows with CCM appointments", () => {
  const rows = mergeChannelPerformance(dashboardFixture());
  assert.equal(rows[0].appointments, 41);
});

test("live module count reflects only ok sources", () => {
  assert.equal(countLive(dashboardFixture()), 3);
  assert.equal(formatCents(null), null);
});
