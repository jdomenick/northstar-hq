import { test, expect } from "bun:test";
import {
  CRM_DEPLOYMENT_CONTRACT,
  blockedReadiness,
  buildCrmDeploymentUrl,
  crmMappingMismatch,
  crmObservation,
  crmTenantIsolationVerified,
  deriveCrmProvisioningStatus,
  isCrmDeploymentContract,
  parseCrmDeployment,
} from "./crm-deployment.ts";

const CLIENT = "b1a7f2c0-0000-4000-8000-000000000002";
const BUSINESS = "9f0e1d2c-0000-4000-8000-000000000003";

function payload(overrides = {}, readiness = {}) {
  return {
    contract: CRM_DEPLOYMENT_CONTRACT,
    module: "crm",
    external_id: BUSINESS,
    northstar_client_id: CLIENT,
    tenant: "northstar-labs",
    status: "operational",
    last_success_at: "2026-09-01T00:00:00.000Z",
    last_error: null,
    readiness: {
      auth: true,
      data_access: true,
      sam_event_integration: true,
      reporting: true,
      ...readiness,
    },
    ...overrides,
  };
}

const isolated = { tenant_isolation: true, user_provisioning: true };

test("parses the documented contract", () => {
  const r = parseCrmDeployment(payload());
  expect(r.contract).toBe(CRM_DEPLOYMENT_CONTRACT);
  expect(r.module).toBe("crm");
  expect(r.externalId).toBe(BUSINESS);
  expect(r.northstarClientId).toBe(CLIENT);
  expect(r.tenant).toBe("northstar-labs");
  expect(r.deploymentStatus).toBe("operational");
  expect(r.readiness.auth).toBe(true);
  expect(isCrmDeploymentContract(r)).toBe(true);
});

test("accepts business_id as external id fallback", () => {
  const r = parseCrmDeployment(payload({ external_id: undefined, business_id: BUSINESS }));
  expect(r.externalId).toBe(BUSINESS);
});

test("drops unknown statuses and readiness values", () => {
  const r = parseCrmDeployment(payload({ status: "sideways" }, { auth: "maybe" }));
  expect(r.deploymentStatus).toBeNull();
  expect(r.readiness.auth).toBeUndefined();
});

test("accepts string and object readiness shapes", () => {
  const r = parseCrmDeployment(
    payload({}, { auth: "ready", reporting: { ready: false }, data_access: { state: "blocked" } }),
  );
  expect(r.readiness.auth).toBe(true);
  expect(r.readiness.reporting).toBe(false);
  expect(r.readiness.data_access).toBe(false);
});

test("rejects a foreign contract", () => {
  const r = parseCrmDeployment(payload({ contract: "something.else" }));
  expect(isCrmDeploymentContract(r)).toBe(false);
  expect(deriveCrmProvisioningStatus(r).status).toBe("failed");
});

test("builds a url preferring the canonical client id", () => {
  const url = buildCrmDeploymentUrl("https://crm.example.com", {
    northstarClientId: CLIENT,
    businessId: BUSINESS,
  });
  expect(url).toBe(
    `https://crm.example.com/api/public/reporting/deployment-status?northstar_client_id=${CLIENT}`,
  );
});

test("falls back to business_id", () => {
  const url = buildCrmDeploymentUrl("https://crm.example.com/", { businessId: BUSINESS });
  expect(url).toContain(`business_id=${BUSINESS}`);
});

test("requires a selector", () => {
  expect(() => buildCrmDeploymentUrl("https://crm.example.com", {})).toThrow();
});

test("external operational deployment is held at pending without isolation", () => {
  const r = parseCrmDeployment(payload());
  const d = deriveCrmProvisioningStatus(r);
  expect(d.status).toBe("pending");
  expect(d.reason).toContain("per-business RLS");
});

test("external deployment activates once isolation readiness is proven", () => {
  const r = parseCrmDeployment(payload({}, isolated));
  const d = deriveCrmProvisioningStatus(r);
  expect(d.status).toBe("active");
  expect(d.reason).toBeNull();
});

test("partial isolation readiness still blocks", () => {
  const r = parseCrmDeployment(payload({}, { tenant_isolation: true }));
  expect(crmTenantIsolationVerified(r)).toBe(false);
  expect(deriveCrmProvisioningStatus(r).status).toBe("pending");
});

test("internal deployment may activate without isolation", () => {
  const r = parseCrmDeployment(payload());
  const d = deriveCrmProvisioningStatus(r, { internalDeployment: true });
  expect(d.status).toBe("active");
});

test("degraded external deployment reports the isolation blocker", () => {
  const r = parseCrmDeployment(payload({ status: "degraded", last_error: "sync lag" }));
  const d = deriveCrmProvisioningStatus(r);
  expect(d.status).toBe("pending");
  expect(d.reason).toContain("Requires setup");
});

test("degraded internal deployment stays degraded with the source error", () => {
  const r = parseCrmDeployment(payload({ status: "degraded", last_error: "sync lag" }));
  const d = deriveCrmProvisioningStatus(r, { internalDeployment: true });
  expect(d.status).toBe("degraded");
  expect(d.reason).toContain("sync lag");
});

test("unmapped maps to pending", () => {
  const r = parseCrmDeployment(payload({ status: "unmapped" }));
  expect(deriveCrmProvisioningStatus(r, { internalDeployment: true }).status).toBe("pending");
});

test("not_configured maps to not_configured", () => {
  const r = parseCrmDeployment(payload({ status: "not_configured" }));
  expect(deriveCrmProvisioningStatus(r).status).toBe("not_configured");
});

test("missing status degrades", () => {
  const r = parseCrmDeployment(payload({ status: undefined }));
  expect(deriveCrmProvisioningStatus(r, { internalDeployment: true }).status).toBe("degraded");
});

test("incomplete core readiness degrades an internal deployment", () => {
  const r = parseCrmDeployment(payload({}, { reporting: false }));
  const d = deriveCrmProvisioningStatus(r, { internalDeployment: true });
  expect(d.status).toBe("degraded");
  expect(d.reason).toContain("Reporting");
  expect(blockedReadiness(r)).toContain("reporting");
});

test("missing success timestamp degrades an otherwise ready deployment", () => {
  const r = parseCrmDeployment(payload({ last_success_at: null }, isolated));
  expect(deriveCrmProvisioningStatus(r).status).toBe("degraded");
});

test("detects mapping mismatches", () => {
  const other = parseCrmDeployment(payload({ northstar_client_id: "someone-else" }));
  expect(crmMappingMismatch(other, { northstarClientId: CLIENT, externalId: BUSINESS })).toContain(
    "different NorthStar client",
  );
  const unstamped = parseCrmDeployment(payload({ northstar_client_id: null }));
  expect(
    crmMappingMismatch(unstamped, { northstarClientId: CLIENT, externalId: BUSINESS }),
  ).toContain("not stamped");
  const good = parseCrmDeployment(payload());
  expect(crmMappingMismatch(good, { northstarClientId: CLIENT, externalId: BUSINESS })).toBeNull();
  expect(
    crmMappingMismatch(good, { northstarClientId: CLIENT, externalId: "other-business" }),
  ).toContain("does not match");
});

test("observation is json safe and records the gate", () => {
  const r = parseCrmDeployment(payload());
  const o = crmObservation(r);
  expect(JSON.parse(JSON.stringify(o))).toEqual(o);
  expect(o.tenant_isolation_verified).toBe(false);
  expect(o.internal_deployment).toBe(false);
  expect(o.readiness.tenant_isolation).toBeNull();
  const o2 = crmObservation(parseCrmDeployment(payload({}, isolated)), {
    internalDeployment: true,
  });
  expect(o2.tenant_isolation_verified).toBe(true);
  expect(o2.internal_deployment).toBe(true);
});
