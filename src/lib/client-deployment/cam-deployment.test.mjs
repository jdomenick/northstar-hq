import { test, expect } from "bun:test";
import {
  CAM_DEPLOYMENT_CONTRACT_VERSION,
  blockedCamCapabilities,
  buildCamDeploymentUrl,
  camMappingMismatch,
  camObservation,
  deriveCamProvisioningStatus,
  isCamDeploymentContract,
  parseCamDeployment,
  readyCamCapabilities,
} from "./cam-deployment.ts";

const CLIENT = "b1a7f2c0-0000-4000-8000-000000000004";
const ORG = "7c3b1a90-0000-4000-8000-000000000005";

function client(overrides = {}, caps = {}) {
  return {
    contract_version: CAM_DEPLOYMENT_CONTRACT_VERSION,
    module: "cam",
    external_id: ORG,
    external_key: "northstar-labs",
    northstar_client_id: CLIENT,
    mapped: true,
    account_status: "active",
    status: "active",
    last_success_at: "2026-09-01T00:00:00.000Z",
    last_error: null,
    capabilities: {
      lead_capture: { ready: true, detail: "2 forms live" },
      lead_routing: { ready: true, detail: null },
      crm_delivery: { ready: true, detail: null },
      sam_events: { ready: true, detail: null },
      hq_mapping: { ready: true, detail: null },
      ...caps,
    },
    counts: { campaigns_total: 4, campaigns_live: 2, leads_in_window: 37 },
    ...overrides,
  };
}

test("parses the deployment client payload", () => {
  const r = parseCamDeployment(client());
  expect(r.module).toBe("cam");
  expect(r.contractVersion).toBe(CAM_DEPLOYMENT_CONTRACT_VERSION);
  expect(r.externalId).toBe(ORG);
  expect(r.externalKey).toBe("northstar-labs");
  expect(r.northstarClientId).toBe(CLIENT);
  expect(r.mapped).toBe(true);
  expect(r.accountStatus).toBe("active");
  expect(r.deploymentStatus).toBe("active");
  expect(r.counts.leads_in_window).toBe(37);
  expect(r.capabilities.lead_capture).toEqual({ ready: true, detail: "2 forms live" });
  expect(isCamDeploymentContract(r)).toBe(true);
});

test("parses an enveloped response", () => {
  const r = parseCamDeployment({ contract_version: "1.0.0", client: client() });
  expect(r.externalId).toBe(ORG);
  expect(r.deploymentStatus).toBe("active");
});

test("accepts a bare boolean capability and drops junk", () => {
  const r = parseCamDeployment(client({}, { sam_events: false, hq_mapping: "yes" }));
  expect(r.capabilities.sam_events).toEqual({ ready: false, detail: null });
  expect(r.capabilities.hq_mapping).toBeUndefined();
});

test("drops unknown statuses and non-numeric counts", () => {
  const r = parseCamDeployment(client({ status: "sideways", counts: { campaigns_total: "4" } }));
  expect(r.deploymentStatus).toBeNull();
  expect(r.counts.campaigns_total).toBeUndefined();
  expect(isCamDeploymentContract(r)).toBe(false);
  expect(deriveCamProvisioningStatus(r).status).toBe("failed");
});

test("builds the deployment view url preferring the canonical client id", () => {
  const url = buildCamDeploymentUrl("https://cam.example.com", {
    northstarClientId: CLIENT,
    organizationId: ORG,
  });
  expect(url).toBe(
    `https://cam.example.com/api/public/reporting/hq-dashboard?view=deployment&client=${CLIENT}`,
  );
});

test("falls back to the organization id", () => {
  const url = buildCamDeploymentUrl("https://cam.example.com/", { organizationId: ORG });
  expect(url).toContain(`client=${ORG}`);
  expect(url).toContain("view=deployment");
});

test("requires a selector", () => {
  expect(() => buildCamDeploymentUrl("https://cam.example.com", {})).toThrow();
});

test("fully ready active deployment maps to active", () => {
  const d = deriveCamProvisioningStatus(parseCamDeployment(client()));
  expect(d.status).toBe("active");
  expect(d.reason).toBeNull();
});

test("preserves real operating statuses", () => {
  const cases = {
    onboarding: "pending",
    idle: "degraded",
    degraded: "degraded",
    paused: "disabled",
    inactive: "not_configured",
  };
  for (const [reported, expected] of Object.entries(cases)) {
    const d = deriveCamProvisioningStatus(parseCamDeployment(client({ status: reported })));
    expect(d.status).toBe(expected);
    expect(d.reason).toBeTruthy();
  }
});

test("degraded surfaces CAM's own error", () => {
  const d = deriveCamProvisioningStatus(
    parseCamDeployment(client({ status: "degraded", last_error: "routing webhook 500" })),
  );
  expect(d.reason).toContain("routing webhook 500");
});

test("unmapped active deployment degrades", () => {
  const d = deriveCamProvisioningStatus(
    parseCamDeployment(client({ mapped: false, northstar_client_id: null })),
  );
  expect(d.status).toBe("degraded");
  expect(d.reason).toContain("not mapped");
});

test("a not-ready capability degrades an active deployment", () => {
  const r = parseCamDeployment(client({}, { crm_delivery: { ready: false, detail: "no api key" } }));
  const d = deriveCamProvisioningStatus(r);
  expect(d.status).toBe("degraded");
  expect(d.reason).toContain("CRM delivery");
  expect(blockedCamCapabilities(r)).toEqual(["crm_delivery"]);
  expect(readyCamCapabilities(r)).not.toContain("crm_delivery");
});

test("missing success timestamp degrades", () => {
  const d = deriveCamProvisioningStatus(parseCamDeployment(client({ last_success_at: null })));
  expect(d.status).toBe("degraded");
});

test("detects mapping mismatches", () => {
  const other = parseCamDeployment(client({ northstar_client_id: "someone-else" }));
  expect(camMappingMismatch(other, { northstarClientId: CLIENT, externalId: ORG })).toContain(
    "different NorthStar client",
  );
  const unstamped = parseCamDeployment(client({ northstar_client_id: null }));
  expect(camMappingMismatch(unstamped, { northstarClientId: CLIENT, externalId: ORG })).toContain(
    "not stamped",
  );
  const good = parseCamDeployment(client());
  expect(camMappingMismatch(good, { northstarClientId: CLIENT, externalId: ORG })).toBeNull();
  expect(camMappingMismatch(good, { northstarClientId: CLIENT, externalId: "other-org" })).toContain(
    "does not match",
  );
});

test("observation is json safe and complete", () => {
  const o = camObservation(parseCamDeployment(client()));
  expect(JSON.parse(JSON.stringify(o))).toEqual(o);
  expect(o.external_key).toBe("northstar-labs");
  expect(o.counts.campaigns_live).toBe(2);
  expect(o.capabilities.lead_capture).toEqual({ ready: true, detail: "2 forms live" });
  const sparse = camObservation(parseCamDeployment(client({ counts: {}, capabilities: {} })));
  expect(sparse.counts.leads_in_window).toBeNull();
  expect(sparse.capabilities.sam_events).toBeNull();
});
