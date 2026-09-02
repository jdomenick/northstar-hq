/**
 * Shared reconciliation between a module's parsed deployment contract and the
 * HQ provisioning status stored on `client_module_connections`.
 *
 * Rules enforced here, once, for every module:
 * - HTTP 200 proves transport and auth only. Status always comes from the
 *   parsed remote contract.
 * - Identity mismatch is a hard failure with an explicit error, never a silent
 *   accept and never a soft downgrade.
 * - `last_success_at` is remote truth. When the remote reports none, HQ keeps
 *   whatever it already had and does not invent a success timestamp.
 */

import type { ProvisioningStatus } from "./types";

export interface DerivedStatus {
  status: ProvisioningStatus;
  reason: string | null;
}

export interface ResolvedHealth {
  status: ProvisioningStatus;
  ok: boolean;
  error: string | null;
  /** Remote-reported success timestamp, or null when the remote reports none. */
  lastSuccessAt: string | null;
}

export function resolveDeploymentHealth(params: {
  derived: DerivedStatus;
  mismatch: string | null;
  remoteLastSuccessAt: string | null;
}): ResolvedHealth {
  const status: ProvisioningStatus = params.mismatch ? "failed" : params.derived.status;
  const ok = status === "active";
  return {
    status,
    ok,
    error: params.mismatch ?? (ok ? null : params.derived.reason),
    lastSuccessAt: params.remoteLastSuccessAt,
  };
}

/** Truthful message for a non-200 response from a module deployment endpoint. */
export function describeHttpFailure(moduleLabel: string, httpStatus: number): string {
  if (httpStatus === 401 || httpStatus === 403) {
    return `${moduleLabel} rejected the shared reporting credential.`;
  }
  if (httpStatus === 404) {
    return `${moduleLabel} has no deployment record for this selector.`;
  }
  return `${moduleLabel} responded HTTP ${httpStatus}.`;
}
