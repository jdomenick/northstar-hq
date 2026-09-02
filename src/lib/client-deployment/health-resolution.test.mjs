// Reconciliation tests: parsed remote contract -> HQ provisioning status.
// Pure, no network. Covers all four modules across healthy, degraded /
// not-configured, identity mismatch, remote null last_success_at, HTTP/auth
// failure, and malformed payload.
import { test, expect } from "bun:test";
import { describeHttpFailure, resolveDeploymentHealth } from "./health-resolution.ts";
import {
  SAM_DEPLOYMENT_CONTRACT,
  deriveSamProvisioningStatus,
  parseSamDeployment,
  samMappingMismatch,
} from "./sam-deployment.ts";
import {
  CCM_DEPLOYMENT_CONTRACT,
  ccmMappingMismatch,
  deriveCcmProvisioningStatus,
  parseCcmDeployment,
} from "./ccm-deployment.ts";
import {
  CRM_DEPLOYMENT_CONTRACT,
  crmMappingMismatch,
  deriveCrmProvisioningStatus,
  parseCrmDeployment,
} from "./crm-deployment.ts";
import {
  CAM_DEPLOYMENT_CONTRACT_VERSION,
  camMappingMismatch,
  deriveCamProvisioningStatus,
  parseCamDeployment,
} from "./cam-deployment.ts";

const CLIENT = "b1a7f2c0-0000-4000-8000-00000000abcd";
const OTHER_CLIENT = "b1a7f2c0-0000-4000-8000-00000000dead";
const EXTERNAL = "9f0e1d2c-0000-4000-8000-00000000beef";
const SUCCESS = "2026-09-01T00:00:00.000Z";

/* ------------------------------- payloads -------------------------------- */

const sam = (over = {}) => ({
  contract: SAM_DEPLOYMENT_CONTRACT,
  module: "sam",
  client: { external_id: EXTERNAL, northstar_client_id: CLIENT, mapped: true },
  installation: {
    status: "active",
    registered: true,
    auth_ready: true,
    capabilities: ["reasoning"],
    application_state: "provisioned",
  },
  health: {
    status: "healthy",
    last_success_at: SUCCESS,
    last_activity_at: SUCCESS,
    last_error: null,
    last_error_at: null,
    tasks_24h: 4,
    failed_tasks_24h: 0,
  },
  ...over,
});

const ccm = (over = {}, caps = {}) => ({
  contract: CCM_DEPLOYMENT_CONTRACT,
  module: "ccm",
  tenant_id: EXTERNAL,
  northstar_client_id: CLIENT,
  deployment_status: "healthy",
  last_success_at: SUCCESS,
  last_error: null,
  capabilities: {
    phone_voice: "connected",
    sms: "connected",
    calendar_booking: "configured",
    crm_sync: "configured",
    notifications: "connected",
    business_config: "configured",
    northstar_link: "connected",
    ...caps,
  },
  ...over,
});

const crm = (over = {}, readiness = {}) => ({
  contract: CRM_DEPLOYMENT_CONTRACT,
  module: "crm",
  external_id: EXTERNAL,
  northstar_client_id: CLIENT,
  tenant: "acme",
  status: "operational",
  last_success_at: SUCCESS,
  last_error: null,
  readiness: {
    auth: true,
    data_access: true,
    sam_event_integration: true,
    reporting: true,
    tenant_isolation: true,
    user_provisioning: true,
    ...readiness,
  },
  ...over,
});

const cam = (over = {}, caps = {}) => ({
  contract_version: CAM_DEPLOYMENT_CONTRACT_VERSION,
  module: "cam",
  external_id: EXTERNAL,
  external_key: "acme",
  northstar_client_id: CLIENT,
  mapped: true,
  account_status: "active",
  status: "active",
  last_success_at: SUCCESS,
  last_error: null,
  capabilities: {
    lead_capture: { ready: true, detail: null },
    lead_routing: { ready: true, detail: null },
    crm_delivery: { ready: true, detail: null },
    sam_events: { ready: true, detail: null },
    hq_mapping: { ready: true, detail: null },
    ...caps,
  },
  counts: { campaigns_total: 1, campaigns_live: 1, leads_in_window: 3 },
  ...over,
});

/* ------------------------------- resolvers -------------------------------- */

const expected = { northstarClientId: CLIENT, externalId: EXTERNAL };

function resolveSam(payload) {
  const report = parseSamDeployment(payload);
  return resolveDeploymentHealth({
    derived: deriveSamProvisioningStatus(report),
    mismatch: samMappingMismatch(report, expected),
    remoteLastSuccessAt: report.health.lastSuccessAt,
  });
}

function resolveCcm(payload) {
  const report = parseCcmDeployment(payload);
  return resolveDeploymentHealth({
    derived: deriveCcmProvisioningStatus(report),
    mismatch: ccmMappingMismatch(report, expected),
    remoteLastSuccessAt: report.lastSuccessAt,
  });
}

function resolveCrm(payload, opts = { internalDeployment: false }) {
  const report = parseCrmDeployment(payload);
  return resolveDeploymentHealth({
    derived: deriveCrmProvisioningStatus(report, opts),
    mismatch: crmMappingMismatch(report, expected),
    remoteLastSuccessAt: report.lastSuccessAt,
  });
}

function resolveCam(payload) {
  const report = parseCamDeployment(payload);
  return resolveDeploymentHealth({
    derived: deriveCamProvisioningStatus(report),
    mismatch: camMappingMismatch(report, expected),
    remoteLastSuccessAt: report.lastSuccessAt,
  });
}

const RESOLVERS = {
  sam: { resolve: resolveSam, healthy: sam },
  ccm: { resolve: resolveCcm, healthy: ccm },
  crm: { resolve: resolveCrm, healthy: crm },
  cam: { resolve: resolveCam, healthy: cam },
};

/* --------------------------------- tests ---------------------------------- */

for (const [module, { resolve, healthy }] of Object.entries(RESOLVERS)) {
  test(`${module}: healthy remote state resolves active with remote last_success_at`, () => {
    const r = resolve(healthy());
    expect(r.status).toBe("active");
    expect(r.ok).toBe(true);
    expect(r.error).toBeNull();
    expect(r.lastSuccessAt).toBe(SUCCESS);
  });

  test(`${module}: malformed payload is failed, never active`, () => {
    const r = resolve({ hello: "world" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("failed");
    expect(typeof r.error).toBe("string");
    expect(r.lastSuccessAt).toBeNull();
  });

  test(`${module}: remote null last_success_at is preserved as null`, () => {
    const r = resolve(healthy({ last_success_at: null, health: { status: "healthy" } }));
    expect(r.lastSuccessAt).toBeNull();
  });

  test(`${module}: identity mismatch is a hard failure with an explicit error`, () => {
    const r = resolve(
      healthy(
        module === "sam"
          ? { client: { external_id: EXTERNAL, northstar_client_id: OTHER_CLIENT, mapped: true } }
          : { northstar_client_id: OTHER_CLIENT },
      ),
    );
    expect(r.status).toBe("failed");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  test(`${module}: external id mismatch is a hard failure`, () => {
    const r = resolve(
      healthy(
        module === "sam"
          ? { client: { external_id: "other-external", northstar_client_id: CLIENT, mapped: true } }
          : { external_id: "other-external", tenant_id: "other-external" },
      ),
    );
    expect(r.status).toBe("failed");
    expect(r.error).toBeTruthy();
  });
}

test("sam: no_traffic is degraded, not active", () => {
  const r = resolveSam(sam({ health: { status: "no_traffic", last_success_at: null } }));
  expect(r.status).toBe("degraded");
  expect(r.ok).toBe(false);
});

test("sam: not_installed and revoked never read as active", () => {
  expect(resolveSam(sam({ installation: { status: "not_installed" } })).status).toBe("pending");
  expect(
    resolveSam(sam({ installation: { status: "revoked", registered: true, auth_ready: true } }))
      .status,
  ).toBe("failed");
});

test("ccm: degraded stays degraded and not_configured never reads active", () => {
  expect(resolveCcm(ccm({ deployment_status: "degraded" })).status).toBe("degraded");
  const notConfigured = resolveCcm(ccm({ deployment_status: "not_configured" }));
  expect(notConfigured.ok).toBe(false);
  expect(notConfigured.status).not.toBe("active");
});

test("crm: external client without tenant isolation is held, never active", () => {
  const r = resolveCrm(crm({}, { tenant_isolation: false, user_provisioning: false }));
  expect(r.ok).toBe(false);
  expect(r.status).not.toBe("active");
  expect(r.error).toBeTruthy();
});

test("crm: degraded and unmapped never read active", () => {
  expect(resolveCrm(crm({ status: "degraded" })).ok).toBe(false);
  expect(resolveCrm(crm({ status: "unmapped" })).ok).toBe(false);
  expect(resolveCrm(crm({ status: "not_configured" })).ok).toBe(false);
});

test("cam: onboarding, idle, paused and inactive never read active", () => {
  for (const status of ["onboarding", "idle", "degraded", "paused", "inactive"]) {
    const r = resolveCam(cam({ status }));
    expect(r.ok).toBe(false);
    expect(r.status).not.toBe("active");
  }
});

test("cam: unready capability blocks active even when status says active", () => {
  const r = resolveCam(cam({}, { crm_delivery: { ready: false, detail: "no destination" } }));
  expect(r.ok).toBe(false);
});

test("http and auth failures produce truthful, module-labelled errors", () => {
  expect(describeHttpFailure("CAM", 401)).toMatch(/credential/i);
  expect(describeHttpFailure("CCM", 403)).toMatch(/credential/i);
  expect(describeHttpFailure("NorthStar CRM", 404)).toMatch(/no deployment record/i);
  expect(describeHttpFailure("SAM Core", 500)).toMatch(/HTTP 500/);
});

test("a resolved failure never carries a fabricated success timestamp", () => {
  const r = resolveDeploymentHealth({
    derived: { status: "failed", reason: "boom" },
    mismatch: null,
    remoteLastSuccessAt: null,
  });
  expect(r.lastSuccessAt).toBeNull();
  expect(r.error).toBe("boom");
});
