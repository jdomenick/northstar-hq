// SAM Core deployment contract (sam-deployment.v1) tests. Pure, no network.
import assert from "node:assert/strict";
import test from "node:test";
import {
  SAM_DEPLOYMENT_CONTRACT,
  SAM_DEPLOYMENT_PATH,
  buildSamDeploymentUrl,
  deriveSamProvisioningStatus,
  isSamDeploymentContract,
  parseSamDeployment,
  samMappingMismatch,
  samObservation,
} from "./sam-deployment.ts";

const CLIENT = "b1a7f2c0-0000-4000-8000-000000000001";
const SAM_ORG = "9f0f0000-0000-4000-8000-0000000000aa";

function payload(over = {}) {
  return {
    contract: SAM_DEPLOYMENT_CONTRACT,
    module: "sam",
    client: { external_id: SAM_ORG, northstar_client_id: CLIENT, mapped: true },
    installation: {
      status: "active",
      registered: true,
      auth_ready: true,
      capabilities: ["reasoning", "memory"],
      application_state: "provisioned",
    },
    health: {
      status: "healthy",
      last_success_at: "2026-09-01T12:00:00Z",
      last_activity_at: "2026-09-01T12:05:00Z",
      last_error: null,
      last_error_at: null,
      tasks_24h: 12,
      failed_tasks_24h: 0,
    },
    ...over,
  };
}

test("url prefers northstar_client_id over organization_id", () => {
  const u = new URL(
    buildSamDeploymentUrl("https://sam.example.com", {
      northstarClientId: CLIENT,
      organizationId: SAM_ORG,
    }),
  );
  assert.equal(u.pathname, SAM_DEPLOYMENT_PATH);
  assert.equal(u.searchParams.get("northstar_client_id"), CLIENT);
  assert.equal(u.searchParams.get("organization_id"), null);
});

test("url falls back to organization_id when no canonical id is available", () => {
  const u = new URL(
    buildSamDeploymentUrl("https://sam.example.com/", {
      northstarClientId: null,
      organizationId: SAM_ORG,
    }),
  );
  assert.equal(u.searchParams.get("organization_id"), SAM_ORG);
  assert.equal(u.searchParams.get("northstar_client_id"), null);
});

test("url building refuses to guess a selector", () => {
  assert.throws(() =>
    buildSamDeploymentUrl("https://sam.example.com", {
      northstarClientId: null,
      organizationId: null,
    }),
  );
});

test("parses the documented payload", () => {
  const r = parseSamDeployment(payload());
  assert.equal(isSamDeploymentContract(r), true);
  assert.equal(r.externalId, SAM_ORG);
  assert.equal(r.northstarClientId, CLIENT);
  assert.equal(r.mapped, true);
  assert.equal(r.installation.status, "active");
  assert.deepEqual(r.installation.capabilities, ["reasoning", "memory"]);
  assert.equal(r.health.status, "healthy");
  assert.equal(r.health.tasks24h, 12);
  assert.equal(r.health.failedTasks24h, 0);
});

test("garbage and unknown enums parse to nulls, never to healthy", () => {
  const r = parseSamDeployment({
    contract: SAM_DEPLOYMENT_CONTRACT,
    client: {},
    installation: { status: "weird", capabilities: "nope" },
    health: { status: "great", tasks_24h: "many" },
  });
  assert.equal(r.installation.status, null);
  assert.deepEqual(r.installation.capabilities, []);
  assert.equal(r.health.status, null);
  assert.equal(r.health.tasks24h, null);
  assert.equal(r.mapped, false);
  assert.equal(deriveSamProvisioningStatus(r).status, "failed");
});

test("a wrong contract version is never trusted", () => {
  const r = parseSamDeployment(payload({ contract: "sam-deployment.v2" }));
  assert.equal(isSamDeploymentContract(r), false);
  assert.equal(deriveSamProvisioningStatus(r).status, "failed");
});

test("healthy and installed maps to active", () => {
  const d = deriveSamProvisioningStatus(parseSamDeployment(payload()));
  assert.equal(d.status, "active");
  assert.equal(d.reason, null);
});

test("no_traffic is a truthful connected state", () => {
  const d = deriveSamProvisioningStatus(
    parseSamDeployment(
      payload({ health: { status: "no_traffic", tasks_24h: 0, failed_tasks_24h: 0 } }),
    ),
  );
  assert.equal(d.status, "active");
  assert.match(d.reason, /no traffic/i);
});

test("degraded and blocked health map to degraded and failed", () => {
  const degraded = deriveSamProvisioningStatus(
    parseSamDeployment(
      payload({ health: { status: "degraded", last_error: "provider timeout" } }),
    ),
  );
  assert.equal(degraded.status, "degraded");
  assert.match(degraded.reason, /provider timeout/);

  const blocked = deriveSamProvisioningStatus(
    parseSamDeployment(payload({ health: { status: "blocked", last_error: "quota exhausted" } })),
  );
  assert.equal(blocked.status, "failed");
  assert.match(blocked.reason, /quota exhausted/);
});

test("installation state outranks health", () => {
  const cases = [
    ["not_installed", "pending"],
    ["suspended", "disabled"],
    ["revoked", "failed"],
  ];
  for (const [installStatus, expected] of cases) {
    const d = deriveSamProvisioningStatus(
      parseSamDeployment(
        payload({
          installation: { status: installStatus, registered: true, auth_ready: true },
        }),
      ),
    );
    assert.equal(d.status, expected, `${installStatus} should map to ${expected}`);
  }
});

test("unregistered is pending and unauthorized is degraded, even when healthy", () => {
  const unregistered = deriveSamProvisioningStatus(
    parseSamDeployment(
      payload({ installation: { status: "active", registered: false, auth_ready: false } }),
    ),
  );
  assert.equal(unregistered.status, "pending");

  const unauthorized = deriveSamProvisioningStatus(
    parseSamDeployment(
      payload({ installation: { status: "active", registered: true, auth_ready: false } }),
    ),
  );
  assert.equal(unauthorized.status, "degraded");
});

test("mapping mismatches are surfaced, matching mappings are silent", () => {
  const good = parseSamDeployment(payload());
  assert.equal(samMappingMismatch(good, { northstarClientId: CLIENT, externalId: SAM_ORG }), null);

  const unmapped = parseSamDeployment(
    payload({ client: { external_id: SAM_ORG, northstar_client_id: null, mapped: false } }),
  );
  assert.match(samMappingMismatch(unmapped, { northstarClientId: CLIENT, externalId: SAM_ORG }), /not have this organization mapped/);

  const otherClient = parseSamDeployment(
    payload({
      client: {
        external_id: SAM_ORG,
        northstar_client_id: "00000000-0000-4000-8000-00000000ffff",
        mapped: true,
      },
    }),
  );
  assert.match(
    samMappingMismatch(otherClient, { northstarClientId: CLIENT, externalId: SAM_ORG }),
    /different NorthStar client/,
  );

  const otherOrg = parseSamDeployment(
    payload({ client: { external_id: "other-org", northstar_client_id: CLIENT, mapped: true } }),
  );
  assert.match(
    samMappingMismatch(otherOrg, { northstarClientId: CLIENT, externalId: SAM_ORG }),
    /organization id does not match/,
  );
});

test("observation is JSON-safe and carries the operator-relevant fields", () => {
  const o = samObservation(parseSamDeployment(payload()));
  assert.deepEqual(JSON.parse(JSON.stringify(o)), o);
  assert.equal(o.installation_status, "active");
  assert.equal(o.health_status, "healthy");
  assert.equal(o.auth_ready, true);
  assert.equal(o.tasks_24h, 12);
});
