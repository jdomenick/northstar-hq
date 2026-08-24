// Cross-app module reporting tests against the real source contracts.
// No network, no database. Run: bun test src/lib/module-reporting/module-reporting.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  MODULE_URL_DEFAULT,
  REPORTING_SECRET_HEADER,
  buildOutcomeJourney,
  mergeActivity,
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
import { resolveRange, isUuid } from "./range.ts";

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const NOW = new Date("2026-08-24T02:00:00.000Z");
const TENANT_UUID = "3f2b1c44-9a1e-4a2b-8f01-2c3d4e5f6a7b";

/* ------------------------------ range logic ------------------------------- */

test("range translation uses UTC boundaries and CAM period shorthand", () => {
  const mtd = resolveRange("mtd", NOW);
  assert.equal(mtd.startIso, "2026-08-01T00:00:00.000Z");
  assert.equal(mtd.camPeriod, "mtd");

  const d30 = resolveRange("30d", NOW);
  assert.equal(d30.startIso, "2026-07-25T02:00:00.000Z");
  assert.equal(d30.camPeriod, "30d");

  const qtd = resolveRange("qtd", NOW);
  assert.equal(qtd.startIso, "2026-07-01T00:00:00.000Z");
  assert.equal(qtd.camPeriod, null);

  const ytd = resolveRange("ytd", NOW);
  assert.equal(ytd.startIso, "2026-01-01T00:00:00.000Z");
  assert.equal(ytd.camPeriod, null);

  assert.equal(resolveRange("nonsense", NOW).range, "mtd");
  assert.equal(isUuid(TENANT_UUID), true);
  assert.equal(isUuid("acme-plumbing"), false);
});

/* --------------------------- source-specific query ------------------------ */

test("CAM query uses client + period, or explicit start/end for qtd", () => {
  const scoped = new URL(
    buildReportingUrl("cam", "https://cam.example.com", "acme-plumbing", resolveRange("mtd", NOW)),
  );
  assert.equal(scoped.pathname, "/api/public/reporting/hq-dashboard");
  assert.equal(scoped.searchParams.get("client"), "acme-plumbing");
  assert.equal(scoped.searchParams.get("period"), "mtd");
  assert.equal(scoped.searchParams.get("external_id"), null);
  assert.equal(scoped.searchParams.get("range"), null);

  const portfolio = new URL(
    buildReportingUrl("cam", "https://cam.example.com", null, resolveRange("qtd", NOW)),
  );
  assert.equal(portfolio.searchParams.get("client"), null);
  assert.equal(portfolio.searchParams.get("period"), null);
  assert.equal(portfolio.searchParams.get("start"), "2026-07-01T00:00:00.000Z");
  assert.equal(portfolio.searchParams.get("end"), NOW.toISOString());
});

test("CCM query uses tenant_id for UUIDs and tenant_slug otherwise, with from/to", () => {
  const byId = new URL(
    buildReportingUrl("ccm", "https://ccm.example.com", TENANT_UUID, resolveRange("mtd", NOW)),
  );
  assert.equal(byId.searchParams.get("tenant_id"), TENANT_UUID);
  assert.equal(byId.searchParams.get("tenant_slug"), null);
  assert.equal(byId.searchParams.get("from"), "2026-08-01T00:00:00.000Z");
  assert.equal(byId.searchParams.get("to"), NOW.toISOString());

  const bySlug = new URL(
    buildReportingUrl("ccm", "https://ccm.example.com", "acme", resolveRange("mtd", NOW)),
  );
  assert.equal(bySlug.searchParams.get("tenant_slug"), "acme");
  assert.equal(bySlug.searchParams.get("tenant_id"), null);
});

test("CRM sends business_id=all when unscoped and SAM omits organization_id", () => {
  const crm = new URL(
    buildReportingUrl("crm", "https://crm.example.com", null, resolveRange("30d", NOW)),
  );
  assert.equal(crm.searchParams.get("business_id"), "all");

  const crmScoped = new URL(
    buildReportingUrl("crm", "https://crm.example.com", "harbor-dental", resolveRange("30d", NOW)),
  );
  assert.equal(crmScoped.searchParams.get("business_id"), "harbor-dental");

  const sam = new URL(
    buildReportingUrl("sam", "https://sam.example.com", null, resolveRange("30d", NOW)),
  );
  assert.equal(sam.searchParams.get("organization_id"), null);
  assert.equal(sam.searchParams.get("from"), "2026-07-25T02:00:00.000Z");

  const samScoped = new URL(
    buildReportingUrl("sam", "https://sam.example.com", TENANT_UUID, resolveRange("30d", NOW)),
  );
  assert.equal(samScoped.searchParams.get("organization_id"), TENANT_UUID);
});

test("adapter sends the shared reporting secret in the header only", async () => {
  let seenUrl = null;
  let seenHeaders = null;
  const source = await fetchModuleReport({
    module: "crm",
    baseUrl: "https://crm.example.com",
    secret: "s3cret",
    externalId: "harbor-dental",
    range: "mtd",
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenHeaders = init.headers;
      return jsonResponse({
        status: "ok",
        contract_version: "northstar.crm.hq-dashboard.v1",
        metrics: { customers_total: 12 },
      });
    },
  });

  assert.equal(seenHeaders[REPORTING_SECRET_HEADER], "s3cret");
  assert.ok(!seenUrl.includes("s3cret"));
  assert.equal(source.status, "ok");
  assert.equal(source.version, "northstar.crm.hq-dashboard.v1");
  assert.equal(source.data.customers, 12);
  assert.deepEqual(Object.keys(buildReportingHeaders("s3cret")).sort(), [
    "Accept",
    REPORTING_SECRET_HEADER,
  ].sort());
});

test("CCM without a tenant scope is not_connected instead of an invalid request", async () => {
  let called = false;
  const source = await fetchModuleReport({
    module: "ccm",
    baseUrl: "https://ccm.example.com",
    secret: "x",
    externalId: null,
    fetchImpl: async () => {
      called = true;
      return jsonResponse({});
    },
  });
  assert.equal(called, false);
  assert.equal(source.status, "not_connected");
  assert.match(source.reason, /tenant scope/i);
});

test("missing URL or secret is not_connected, not a fabricated zero", async () => {
  const noUrl = await fetchModuleReport({ module: "cam", baseUrl: null, secret: "x" });
  assert.equal(noUrl.status, "not_connected");
  assert.equal(noUrl.data, null);

  const noSecret = await fetchModuleReport({
    module: "cam",
    baseUrl: "https://cam.example.com",
    secret: "",
  });
  assert.equal(noSecret.status, "not_connected");
});

test("auth rejection, 404 and transport errors surface as unavailable with reasons", async () => {
  const denied = await fetchModuleReport({
    module: "crm",
    baseUrl: "https://crm.example.com",
    secret: "x",
    fetchImpl: async () => jsonResponse({}, 403),
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
      fetchImpl: async () => jsonResponse(camPayload()),
    }),
    fetchModuleReport({
      module: "crm",
      baseUrl: "https://crm.example.com",
      secret: "x",
      fetchImpl: async () => {
        throw new Error("boom");
      },
    }),
  ]);
  assert.equal(results[0].status, "ok");
  assert.equal(results[1].status, "unavailable");
});

/* ------------------------------ CAM contract ------------------------------ */

function camPayload() {
  return {
    status: "ok",
    source: "CAM",
    contract_version: "cam.hq-dashboard.v1",
    generated_at: "2026-08-24T02:00:00.000Z",
    range: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-24T02:00:00.000Z" },
    client_key_field: "slug",
    clients: [
      {
        client: {
          organization_id: TENANT_UUID,
          slug: "acme-plumbing",
          name: "Acme Plumbing",
          status: "active",
          external_key: "acme-plumbing",
        },
        totals: {
          leads: 318,
          qualified_leads: 204,
          appointments: 96,
          customers: 44,
          revenue: 62400.5,
          spend: null,
          cost_per_lead: null,
          roas: null,
        },
        campaigns: [],
        trend: [
          { date: "2026-08-01", leads: 12, qualified_leads: 8, appointments: 3 },
          { date: "2026-08-02", leads: 15, qualified_leads: 9, appointments: 4 },
        ],
        source_breakdown: [
          { source: "Google Ads", leads: 128 },
          { source: "Referral", leads: 38 },
        ],
        recent_leads: [
          { id: "l1", name: "Dana Ruiz", source: "Google Ads", created_at: "2026-08-23T18:00:00Z" },
        ],
        delivery_failures: [
          { reason: "CRM handoff rejected", destination: "crm", failed_at: "2026-08-23T19:00:00Z" },
        ],
      },
      {
        client: { organization_id: "b0b1", slug: "harbor-dental", name: "Harbor Dental" },
        totals: { leads: 197, qualified_leads: 120, appointments: 51, customers: 20, revenue: 41200 },
        trend: [{ date: "2026-08-01", leads: 7, qualified_leads: 3, appointments: 1 }],
        source_breakdown: [{ source: "Google Ads", leads: 40 }],
        recent_leads: [],
        delivery_failures: [],
      },
    ],
    unavailable: [],
  };
}

test("CAM scoped read selects the matching client report", () => {
  const cam = normalizeCam(camPayload(), { externalId: "acme-plumbing" });
  assert.equal(cam.leads, 318);
  assert.equal(cam.qualifiedLeads, 204);
  assert.equal(cam.appointments, 96);
  assert.equal(cam.customers, 44);
  // Major currency units, not cents, at the source.
  assert.equal(cam.revenueCents, 6240050);
  assert.equal(cam.spendCents, null);
  assert.equal(cam.cplCents, null);
  assert.equal(cam.roas, null);
  assert.deepEqual(cam.trend, [
    { label: "2026-08-01", value: 12 },
    { label: "2026-08-02", value: 15 },
  ]);
  assert.equal(cam.channels[0].channel, "Google Ads");
  assert.equal(cam.channels[0].leads, 128);
  assert.equal(cam.activity.length, 2);
  assert.equal(cam.activity[0].title, "Dana Ruiz");
  assert.equal(cam.activity[1].tone, "alert");
  assert.match(cam.activity[1].title, /CRM handoff rejected/);
});

test("CAM scoped by organization UUID matches the same report", () => {
  assert.equal(normalizeCam(camPayload(), { externalId: TENANT_UUID }).leads, 318);
});

test("CAM unscoped aggregates every client report", () => {
  const cam = normalizeCam(camPayload());
  assert.equal(cam.leads, 515);
  assert.equal(cam.qualifiedLeads, 324);
  assert.equal(cam.revenueCents, 10360050);
  assert.equal(cam.channels[0].leads, 168);
  assert.equal(cam.trend.find((p) => p.label === "2026-08-01").value, 19);
});

test("CAM with no clients reports nulls rather than zeros", () => {
  const cam = normalizeCam({ status: "ok", clients: [], unavailable: [] });
  assert.equal(cam.leads, null);
  assert.equal(cam.revenueCents, null);
  assert.deepEqual(cam.channels, []);
});

/* ------------------------------ CCM contract ------------------------------ */

function ccmPayload(overrides = {}) {
  return {
    status: "ok",
    version: "ccm.hq-dashboard.v1",
    source: "ccm",
    generated_at: "2026-08-24T02:00:00.000Z",
    tenant: { id: TENANT_UUID, slug: "acme", name: "Acme Plumbing" },
    truncated: false,
    metrics: {
      interactions: { total: 241, calls: 88, sms_messages: 153, sms_conversations: 74 },
      calls: { total: 88, answered: 61 },
      sms: {
        total: 153,
        inbound: 70,
        outbound: 83,
        delivered: 150,
        failed: 3,
        average_response_seconds: { available: true, value: 38 },
        response_samples: 64,
        ...(overrides.sms ?? {}),
      },
      appointments: { booked: 96, confirmed: 80, completed: 61, cancelled: 8, rescheduled: 5, by_source: {} },
      booking_outcomes: { show_rate: { available: false } },
      channel_trend: [
        { date: "2026-08-01", calls: 4, sms: 9, appointments: 2 },
        { date: "2026-08-02", calls: 6, sms: 11, appointments: 3 },
      ],
      recent_activity: [
        {
          type: "call",
          id: "c1",
          at: "2026-08-23T20:00:00Z",
          direction: "inbound",
          status: "completed",
          summary: "Inbound call answered",
        },
      ],
      operational_failures: [
        { type: "sms", at: "2026-08-23T21:00:00Z", summary: "SMS delivery failed", direction: "outbound" },
      ],
    },
  };
}

test("CCM maps interactions, SMS response time, appointments, trend and activity", () => {
  const ccm = normalizeCcm(ccmPayload());
  assert.equal(ccm.conversations, 241);
  assert.equal(ccm.avgResponseSeconds, 38);
  assert.equal(ccm.appointments, 96);
  assert.equal(ccm.bookingFailures, 1);
  assert.deepEqual(ccm.trend, [
    { label: "2026-08-01", value: 13 },
    { label: "2026-08-02", value: 17 },
  ]);
  assert.equal(ccm.activity[0].title, "Inbound call answered");
  assert.equal(ccm.activity[0].meta, "call · inbound");
  assert.equal(ccm.activity[1].tone, "alert");
});

test("CCM average response stays null when the source marks it unavailable", () => {
  const ccm = normalizeCcm(
    ccmPayload({ sms: { average_response_seconds: { available: false }, response_samples: 0 } }),
  );
  assert.equal(ccm.avgResponseSeconds, null);
});

/* ------------------------------ CRM contract ------------------------------ */

function crmPayload() {
  return {
    status: "ok",
    contract_version: "northstar.crm.hq-dashboard.v1",
    source: "northstar-crm",
    generated_at: "2026-08-24T02:00:00.000Z",
    range: { from: "2026-08-01T00:00:00.000Z", to: "2026-08-24T02:00:00.000Z" },
    scope: { business_id: "all" },
    businesses: [{ id: "b1", name: "Acme Plumbing" }],
    metrics: {
      contacts_created_in_range: 120,
      contacts_total: 940,
      leads_created_in_range: 88,
      lifecycle_counts: { lead: 88, customer: 168 },
      lead_status_counts: { new: 30 },
      customers_total: 168,
      open_deals: 86,
      open_pipeline_value: 1420000.25,
      deals_total: 210,
      deals_by_stage: [
        { stage_id: "s1", stage_name: "New", stage_type: "open", pipeline_id: "p1", position: 1, deal_count: 34, value: 220000 },
        { stage_id: "s2", stage_name: "Won", stage_type: "won", pipeline_id: "p1", position: 4, deal_count: 24, value: 480000 },
      ],
      won_deals_in_range: 24,
      won_value_in_range: 480000,
      won_deals_mtd: 24,
      won_value_mtd: 480000,
      lost_deals_in_range: 6,
      tasks_open: 41,
      tasks_overdue: 7,
      tasks_completed_in_range: 55,
      activities_in_range: 300,
      revenue_recognized: { available: false, reason: "CRM does not recognize revenue" },
    },
    recent_activity: [
      { type: "deal_won", at: "2026-08-23T15:00:00Z", summary: "Deal won: Acme retainer", status: "success" },
    ],
    operational_failures: [
      { type: "sync", at: "2026-08-23T16:00:00Z", summary: "Contact sync failed" },
    ],
  };
}

test("CRM maps customers, deals, pipeline value in cents and stage chart", () => {
  const crm = normalizeCrm(crmPayload());
  assert.equal(crm.customers, 168);
  assert.equal(crm.openDeals, 86);
  assert.equal(crm.pipelineValueCents, 142000025);
  assert.equal(crm.wonInRange, 24);
  // Deal value is not recognized revenue.
  assert.equal(crm.attributableRevenueCents, null);
  assert.deepEqual(crm.stages, [
    { label: "New", value: 34 },
    { label: "Won", value: 24 },
  ]);
  assert.equal(crm.activity[0].title, "Deal won: Acme retainer");
  assert.equal(crm.activity[0].tone, "ok");
  assert.equal(crm.activity[1].tone, "alert");
});

/* ---------------------------- SAM Core contract --------------------------- */

function samPayload() {
  return {
    contract_version: "hq-dashboard.v1",
    status: "ok",
    source: "sam-core",
    generated_at: "2026-08-24T02:00:00.000Z",
    scope: { organization_id: null },
    runtime: {
      status: "online",
      workers: 3,
      last_heartbeat_at: "2026-08-24T01:59:00Z",
      stalled_running_tasks: 0,
    },
    organizations: [{ organization_id: TENANT_UUID, name: "NorthStar Labs" }],
    applications: [
      { application_id: "a1", organization_id: TENANT_UUID, name: "CAM", slug: "cam", environment: "production", status: "active", emergency_revoked: false, request_count: 900, failure_count: 3, health: "healthy" },
      { application_id: "a2", organization_id: TENANT_UUID, name: "CCM", slug: "ccm", environment: "production", status: "active", emergency_revoked: false, request_count: 400, failure_count: 0, health: "healthy" },
    ],
    totals: {
      events_in_range: 12480,
      events_24h: 980,
      work_requests_in_range: 3400,
      tasks_in_range: 3300,
      processed_in_range: 3164,
      succeeded_in_range: 3140,
      failed_in_range: 24,
      blocked_in_range: 2,
      success_rate: { available: true, value: 0.992 },
      average_processing_seconds: { available: true, value: 0.412 },
    },
    active_work: { running: 4, queued: 9 },
    recent_failures: [
      { at: "2026-08-23T22:00:00Z", summary: "Task failed: outbound sync", application_name: "CAM", type: "task_failure" },
    ],
    attention: [
      { at: "2026-08-23T23:00:00Z", summary: "Worker lease expiring", type: "runtime" },
    ],
    recent_activity: [
      { at: "2026-08-24T00:30:00Z", summary: "Application registered", application_name: "CCM" },
    ],
  };
}

test("SAM maps runtime status, applications, totals and availability objects", () => {
  const sam = normalizeSam(samPayload());
  assert.equal(sam.status, "online");
  assert.equal(sam.consumers, 2);
  assert.equal(sam.events, 12480);
  assert.equal(sam.tasksProcessed, 3164);
  assert.equal(Math.round(sam.successRatePct * 10) / 10, 99.2);
  assert.equal(sam.avgProcessingMs, 412);
  assert.equal(sam.failures[0].tone, "alert");
  assert.equal(sam.failures[1].tone, "warn");
  assert.equal(sam.failures[2].tone, "muted");
  assert.equal(sam.failures[0].meta, "CAM · task_failure");
});

test("SAM leaves unavailable rates null", () => {
  const payload = samPayload();
  payload.totals.success_rate = { available: false };
  payload.totals.average_processing_seconds = { available: false };
  const sam = normalizeSam(payload);
  assert.equal(sam.successRatePct, null);
  assert.equal(sam.avgProcessingMs, null);
});

/* ------------------------------ aggregation ------------------------------- */

function dashboardFixture() {
  return {
    cam: moduleOk("cam", normalizeCam(camPayload(), { externalId: "acme-plumbing" }), "cam.hq-dashboard.v1"),
    ccm: moduleOk("ccm", normalizeCcm(ccmPayload()), "ccm.hq-dashboard.v1"),
    crm: moduleNotConnected("crm", "CRM not mapped for this client."),
    sam: moduleOk("sam", normalizeSam(samPayload()), "hq-dashboard.v1"),
  };
}

test("outcome journey uses live sources and stays truthful when unmapped", () => {
  const steps = buildOutcomeJourney(dashboardFixture(), 6240000);
  const byKey = Object.fromEntries(steps.map((s) => [s.key, s]));
  assert.equal(byKey.leads.value, "318");
  assert.equal(byKey.leads.source, "cam");
  assert.equal(byKey.conversations.value, "241");
  assert.equal(byKey.appointments.value, "96");
  // CAM does not report spend, so acquisition stays unavailable rather than $0.
  assert.equal(byKey.acquisition.value, null);
  assert.equal(byKey.sales.value, null);
  assert.match(byKey.sales.reason, /not mapped/i);
  assert.equal(byKey.revenue.value, "$62,400");
  assert.equal(byKey.revenue.source, "hq");
});

test("revenue step reports no HQ records rather than zero", () => {
  const revenue = buildOutcomeJourney(dashboardFixture(), null).find((s) => s.key === "revenue");
  assert.equal(revenue.value, null);
  assert.match(revenue.reason, /invoice records/i);
});

test("activity merges across sources newest first", () => {
  const rows = mergeActivity(dashboardFixture());
  assert.equal(rows[0].source, "sam");
  assert.equal(rows[0].occurredAt, "2026-08-24T00:30:00.000Z");
  assert.ok(rows.some((r) => r.source === "cam"));
  assert.ok(rows.some((r) => r.source === "ccm"));
});

test("live module count reflects only ok sources", () => {
  assert.equal(countLive(dashboardFixture()), 3);
  assert.equal(formatCents(null), null);
});

/* --------------------------- SAM application scope ------------------------ */

test("SAM query sends organization_id plus optional application_id", () => {
  const APP_UUID = "8c9d0e1f-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
  const withApp = new URL(
    buildReportingUrl("sam", "https://sam.example.com", TENANT_UUID, resolveRange("30d", NOW), APP_UUID),
  );
  assert.equal(withApp.searchParams.get("organization_id"), TENANT_UUID);
  assert.equal(withApp.searchParams.get("application_id"), APP_UUID);
  assert.equal(withApp.searchParams.get("from"), "2026-07-25T02:00:00.000Z");

  const withoutApp = new URL(
    buildReportingUrl("sam", "https://sam.example.com", TENANT_UUID, resolveRange("30d", NOW)),
  );
  assert.equal(withoutApp.searchParams.get("application_id"), null);
});

test("deployed production base URLs are the defaults", () => {
  assert.equal(MODULE_URL_DEFAULT.cam, "https://camleadconversion.lovable.app");
  assert.equal(MODULE_URL_DEFAULT.ccm, "https://communicationmanager.lovable.app");
  assert.equal(MODULE_URL_DEFAULT.crm, "https://northstar-connect-suite.lovable.app");
  assert.equal(MODULE_URL_DEFAULT.sam, "https://sam-core.lovable.app");
});
