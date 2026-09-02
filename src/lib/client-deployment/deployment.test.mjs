// Client deployment contract tests. Pure derivations, no network or database.
// Run: bun test src/lib/client-deployment/deployment.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  MODULE_KEYS,
  MODULE_PROVISIONING_MODE,
  buildDeploymentSummary,
  deriveDeploymentHealth,
  deriveModuleStatus,
  emptyInstallation,
  isProvisioningStatus,
} from "./types.ts";

const ORG = "11111111-1111-1111-1111-111111111111";
const CLIENT = "22222222-2222-2222-2222-222222222222";

function install(module, over = {}) {
  return { ...emptyInstallation(ORG, CLIENT, module), ...over };
}

test("all four module keys are covered by the provisioning contract", () => {
  assert.deepEqual(MODULE_KEYS, ["cam", "ccm", "crm", "sam"]);
  for (const m of MODULE_KEYS) {
    assert.ok(["api", "requires_setup"].includes(MODULE_PROVISIONING_MODE[m]));
  }
});

test("status guard rejects unknown values", () => {
  assert.equal(isProvisioningStatus("active"), true);
  assert.equal(isProvisioningStatus("connected"), false);
  assert.equal(isProvisioningStatus(null), false);
});

test("unmapped module is never anything but not_configured", () => {
  assert.equal(deriveModuleStatus(install("cam")), "not_configured");
  assert.equal(
    deriveModuleStatus(install("cam", { status: "active", lastSuccessAt: "2026-01-01T00:00:00Z" })),
    "not_configured",
  );
});

test("mapped module with a success and no error is active", () => {
  assert.equal(
    deriveModuleStatus(
      install("crm", { externalId: "biz-1", status: "active", lastSuccessAt: "2026-01-01T00:00:00Z" }),
    ),
    "active",
  );
});

test("error after a prior success degrades, error with no success fails", () => {
  assert.equal(
    deriveModuleStatus(
      install("ccm", {
        externalId: "t1",
        status: "active",
        lastSuccessAt: "2026-01-01T00:00:00Z",
        lastError: "HTTP 500",
      }),
    ),
    "degraded",
  );
  assert.equal(
    deriveModuleStatus(install("ccm", { externalId: "t1", status: "pending", lastError: "HTTP 401" })),
    "failed",
  );
});

test("disabled intent wins over observed health", () => {
  assert.equal(
    deriveModuleStatus(
      install("sam", { externalId: "org-1", status: "disabled", lastSuccessAt: "2026-01-01T00:00:00Z" }),
    ),
    "disabled",
  );
});

test("mapped but never checked stays pending, not active", () => {
  assert.equal(deriveModuleStatus(install("cam", { externalId: "acme", status: "active" })), "pending");
});

test("shared health reflects the worst configured module", () => {
  const base = MODULE_KEYS.map((m) => install(m));
  assert.equal(deriveDeploymentHealth(base), "not_configured");

  const healthy = MODULE_KEYS.map((m) =>
    install(m, { externalId: "x", status: "active", lastSuccessAt: "2026-01-01T00:00:00Z" }),
  );
  assert.equal(deriveDeploymentHealth(healthy), "healthy");

  const withFailure = [
    ...healthy.slice(0, 3),
    install("sam", { externalId: "x", status: "failed", lastError: "HTTP 401" }),
  ];
  assert.equal(deriveDeploymentHealth(withFailure), "failed");

  const withDegraded = [
    ...healthy.slice(0, 3),
    install("sam", { externalId: "x", lastSuccessAt: "2026-01-01T00:00:00Z", lastError: "timeout" }),
  ];
  assert.equal(deriveDeploymentHealth(withDegraded), "degraded");
});

test("disabled modules do not drag shared health down", () => {
  const rows = [
    install("cam", { externalId: "x", status: "active", lastSuccessAt: "2026-01-01T00:00:00Z" }),
    install("ccm", { externalId: "y", status: "disabled" }),
    install("crm"),
    install("sam"),
  ];
  assert.equal(deriveDeploymentHealth(rows), "healthy");
});

test("checklist starts at create_client when no client record exists", () => {
  const s = buildDeploymentSummary({
    clientExists: false,
    reportingCredentialConfigured: true,
    installations: MODULE_KEYS.map((m) => install(m)),
  });
  assert.equal(s.stage, "create_client");
  assert.equal(s.checklist[0].state, "current");
  assert.equal(s.mappedModules, 0);
});

test("checklist advances to map_modules with a client and no mappings", () => {
  const s = buildDeploymentSummary({
    clientExists: true,
    reportingCredentialConfigured: true,
    installations: MODULE_KEYS.map((m) => install(m)),
  });
  assert.equal(s.stage, "map_modules");
  assert.deepEqual(s.requiresSetup, ["cam", "ccm", "crm", "sam"]);
});

test("mapped modules without a credential stop at connect_systems", () => {
  const s = buildDeploymentSummary({
    clientExists: true,
    reportingCredentialConfigured: false,
    installations: [
      install("cam", { externalId: "acme", status: "pending" }),
      install("ccm"),
      install("crm"),
      install("sam"),
    ],
  });
  assert.equal(s.stage, "connect_systems");
  assert.equal(s.mappedModules, 1);
});

test("credential plus mapping but no health check stops at validate", () => {
  const s = buildDeploymentSummary({
    clientExists: true,
    reportingCredentialConfigured: true,
    installations: [
      install("cam", { externalId: "acme", status: "pending" }),
      install("ccm"),
      install("crm"),
      install("sam"),
    ],
  });
  assert.equal(s.stage, "validate");
  assert.equal(s.checklist[3].state, "current");
});

test("a successful health check on every mapped module reaches active", () => {
  const s = buildDeploymentSummary(
    {
      clientExists: true,
      reportingCredentialConfigured: true,
      installations: [
        install("cam", {
          externalId: "acme",
          status: "active",
          lastHealthCheckAt: "2026-02-01T00:00:00Z",
          lastSuccessAt: "2026-02-01T00:00:00Z",
        }),
        install("ccm"),
        install("crm"),
        install("sam"),
      ],
    },
    CLIENT,
  );
  assert.equal(s.stage, "active");
  assert.equal(s.health, "healthy");
  assert.equal(s.activeModules, 1);
  assert.equal(s.northstarClientId, CLIENT);
  assert.equal(s.checklist[4].state, "done");
});

test("a failing module blocks the validate step", () => {
  const s = buildDeploymentSummary({
    clientExists: true,
    reportingCredentialConfigured: true,
    installations: [
      install("cam", {
        externalId: "acme",
        status: "failed",
        lastHealthCheckAt: "2026-02-01T00:00:00Z",
        lastError: "HTTP 401",
      }),
      install("ccm"),
      install("crm"),
      install("sam"),
    ],
  });
  assert.equal(s.health, "failed");
  assert.deepEqual(s.failingModules, ["cam"]);
  assert.equal(s.checklist[3].state, "blocked");
  assert.notEqual(s.stage, "active");
});
