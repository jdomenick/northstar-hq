// Client-side hooks for the client deployment layer. All reads and writes go
// through tenant-scoped server functions; nothing talks to the tables directly.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getClientDeployment,
  removeClientModuleMapping,
  runClientModuleHealthCheck,
  setClientModuleStatus,
  upsertClientModuleMapping,
  type ClientDeploymentResult,
  type ModuleHealthResult,
} from "./deployment.functions";
import type { JsonValue, ModuleKey, ProvisioningStatus } from "./types";

const key = (orgId: string | null, clientId: string | null) => [
  "client-deployment",
  orgId,
  clientId,
];

export function useClientDeployment(orgId: string | null, northstarClientId: string | null) {
  const fetchDeployment = useServerFn(getClientDeployment);
  return useQuery<ClientDeploymentResult>({
    enabled: Boolean(orgId && northstarClientId),
    queryKey: key(orgId, northstarClientId),
    queryFn: () =>
      fetchDeployment({
        data: {
          organizationId: orgId as string,
          northstarClientId: northstarClientId as string,
        },
      }),
  });
}

function useInvalidate(orgId: string | null, clientId: string | null) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: key(orgId, clientId) });
    void qc.invalidateQueries({ queryKey: ["command.modules"] });
    void qc.invalidateQueries({ queryKey: ["command.modules.mapping"] });
  };
}

export interface UpsertMappingInput {
  module: ModuleKey;
  externalId: string;
  externalName?: string | null;
  endpointUrl?: string | null;
  configuration?: Record<string, JsonValue> | null;
  status?: ProvisioningStatus;
}

export function useUpsertModuleMapping(orgId: string | null, clientId: string | null) {
  const call = useServerFn(upsertClientModuleMapping);
  const invalidate = useInvalidate(orgId, clientId);
  return useMutation({
    mutationFn: (input: UpsertMappingInput) =>
      call({
        data: {
          organizationId: orgId as string,
          northstarClientId: clientId as string,
          ...input,
        },
      }),
    onSuccess: invalidate,
  });
}

export function useSetModuleStatus(orgId: string | null, clientId: string | null) {
  const call = useServerFn(setClientModuleStatus);
  const invalidate = useInvalidate(orgId, clientId);
  return useMutation({
    mutationFn: (input: { module: ModuleKey; status: ProvisioningStatus }) =>
      call({
        data: {
          organizationId: orgId as string,
          northstarClientId: clientId as string,
          ...input,
        },
      }),
    onSuccess: invalidate,
  });
}

export function useRemoveModuleMapping(orgId: string | null, clientId: string | null) {
  const call = useServerFn(removeClientModuleMapping);
  const invalidate = useInvalidate(orgId, clientId);
  return useMutation({
    mutationFn: (input: { module: ModuleKey }) =>
      call({
        data: {
          organizationId: orgId as string,
          northstarClientId: clientId as string,
          module: input.module,
        },
      }),
    onSuccess: invalidate,
  });
}

export function useModuleHealthCheck(orgId: string | null, clientId: string | null) {
  const call = useServerFn(runClientModuleHealthCheck);
  const invalidate = useInvalidate(orgId, clientId);
  return useMutation<ModuleHealthResult[], Error, { module?: ModuleKey | null }>({
    mutationFn: (input) =>
      call({
        data: {
          organizationId: orgId as string,
          northstarClientId: clientId as string,
          module: input.module ?? null,
        },
      }),
    onSuccess: invalidate,
  });
}
