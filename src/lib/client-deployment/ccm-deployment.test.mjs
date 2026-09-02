import { test, expect } from "bun:test";
import {
  CCM_DEPLOYMENT_CONTRACT,
  blockedCapabilities,
  buildCcmDeploymentUrl,
  ccmMappingMismatch,
  ccmObservation,
  connectedCapabilities,
  deriveCcmProvisioningStatus,
  isCcmDeploymentContract,
  parseCcmDeployment,
} from "./ccm-deployment.ts";

const CLIENT = "b1a7f2c0-0000-4000-8000-000000000001";

function payload(overrides = {}, caps = {}) {
  return {
    contract: CCM_DEPLOYMENT_CONTRACT,
    module: "ccm",
    tenant_id: "tenant-1",
    northstar_client_id: CLIENT,
    northstar_organization_id: "org-1",
    deployment_status: "healthy",
    standalone: false,
    last_success_at: "2026-09-01T00:00:00.000Z",
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
    ...overrides,
  };
}

test("parses the documented payload", () => {
  const r = parseCcmDeployment(payload());
  expect(r.contract).toBe(CCM_DEPLOYMENT_CONTRACT);
  expect(r.externalId).toBe("tenant-1");
  expect(r.northstarClientId).toBe(CLIENT);
  expect(r.northstarOrganizationId).toBe("org-1");
  expect(r.deploymentStatus).toBe("healthy");
  expect(r.standalone).toBe(false);
  expect(r.capabilities.phone_voice).toBe("connected");
});

test("accepts external_id as well as tenant_id", () => {
  const r = parseCcmDeployment(payload({ tenant_id: undefined, external_id: "tenant-9" }));
  expect(r.externalId).toBe("tenant-9");
});

test("accepts object-shaped capability states and drops unknown ones", () => {
  const r = parseCcmDeployment(
    payload({}, { sms: { state: "blocked" }, crm_sync: "sorta-working", notifications: 7 }),
  );
  expect(r.capabilities.sms).toBe("blocked");
  expect(r.capabilities.crm_sync).toBeUndefined();
  expect(r.capabilities.notifications).toBeUndefined();
});

test("rejects a foreign contract", () => {
  const r = parseCcmDeployment(payload({ contract: "something.else" }));
  expect(isCcmDeploymentContract(r)).toBe(false);
  expect(deriveCcmProvisioningStatus(r).status).toBe("failed");
});

test("garbage payload never reads as healthy", () => {
  const r = parseCcmDeployment(null);
  expect(deriveCcmProvisioningStatus(r).status).toBe("failed");
});

test("healthy with capabilities and a success timestamp is active", () => {
  const d = deriveCcmProvisioningStatus(parseCcmDeployment(payload()));
  expect(d.status).toBe("active");
  expect(d.reason).toBeNull();
});

test("healthy without a production success timestamp is degraded", () => {
  const d = deriveCcmProvisioningStatus(parseCcmDeployment(payload({ last_success_at: null })));
  expect(d.status).toBe("degraded");
  expect(d.reason).toContain("no production success timestamp");
});

test("blocked capability degrades an otherwise healthy tenant", () => {
  const d = deriveCcmProvisioningStatus(parseCcmDeployment(payload({}, { sms: "blocked" })));
  expect(d.status).toBe("degraded");
  expect(d.reason).toContain("SMS");
});

test("standalone deployment is degraded, not active", () => {
  const d = deriveCcmProvisioningStatus(parseCcmDeployment(payload({ standalone: true })));
  expect(d.status).toBe("degraded");
  expect(d.reason).toContain("standalone");
});

test("not_configured maps to not_configured, not failed", () => {
  const d = deriveCcmProvisioningStatus(
    parseCcmDeployment(payload({ deployment_status: "not_configured" })),
  );
  expect(d.status).toBe("not_configured");
});

test("degraded surfaces the reported last error", () => {
  const d = deriveCcmProvisioningStatus(
    parseCcmDeployment(payload({ deployment_status: "degraded", last_error: "twilio auth failed" })),
  );
  expect(d.status).toBe("degraded");
  expect(d.reason).toContain("twilio auth failed");
});

test("missing deployment status is degraded", () => {
  const d = deriveCcmProvisioningStatus(
    parseCcmDeployment(payload({ deployment_status: undefined })),
  );
  expect(d.status).toBe("degraded");
});

test("prefers northstar_client_id over other selectors", () => {
  const url = buildCcmDeploymentUrl("https://communicationmanager.lovable.app", {
    northstarClientId: CLIENT,
    tenantId: "tenant-1",
    tenantSlug: "acme",
  });
  expect(url).toBe(
    `https://communicationmanager.lovable.app/api/public/reporting/hq-deployment?northstar_client_id=${CLIENT}`,
  );
});

test("falls back to tenant_id then tenant_slug then organization_id", () => {
  expect(buildCcmDeploymentUrl("https://x.test", { tenantId: "t1", tenantSlug: "acme" })).toContain(
    "tenant_id=t1",
  );
  expect(buildCcmDeploymentUrl("https://x.test", { tenantSlug: "acme" })).toContain(
    "tenant_slug=acme",
  );
  expect(buildCcmDeploymentUrl("https://x.test", { organizationId: "o1" })).toContain(
    "organization_id=o1",
  );
});

test("url building requires at least one selector", () => {
  expect(() => buildCcmDeploymentUrl("https://x.test", {})).toThrow();
});

test("mapping mismatch is detected", () => {
  const wrongClient = parseCcmDeployment(payload({ northstar_client_id: "other" }));
  expect(ccmMappingMismatch(wrongClient, { northstarClientId: CLIENT, externalId: "tenant-1" })).toContain(
    "different NorthStar client",
  );

  const unstamped = parseCcmDeployment(payload({ northstar_client_id: null }));
  expect(ccmMappingMismatch(unstamped, { northstarClientId: CLIENT, externalId: null })).toContain(
    "not stamped",
  );

  const wrongTenant = parseCcmDeployment(payload({ tenant_id: "tenant-2" }));
  expect(ccmMappingMismatch(wrongTenant, { northstarClientId: CLIENT, externalId: "tenant-1" })).toContain(
    "tenant id does not match",
  );

  const good = parseCcmDeployment(payload());
  expect(ccmMappingMismatch(good, { northstarClientId: CLIENT, externalId: "tenant-1" })).toBeNull();
});

test("capability helpers list blocked and connected surfaces", () => {
  const r = parseCcmDeployment(payload({}, { sms: "blocked", crm_sync: "blocked" }));
  expect(blockedCapabilities(r)).toEqual(["sms", "crm_sync"]);
  expect(connectedCapabilities(r)).toEqual(["phone_voice", "notifications", "northstar_link"]);
});

test("observation is JSON-safe and lists every capability key", () => {
  const o = ccmObservation(parseCcmDeployment(payload({}, { sms: "nope" })));
  expect(JSON.parse(JSON.stringify(o))).toEqual(o);
  expect(o.capabilities.sms).toBeNull();
  expect(o.deployment_status).toBe("healthy");
  expect(o.standalone).toBe(false);
});
