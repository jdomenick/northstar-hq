// Per-operator App User Connector connect / complete / disconnect.
//
// Server-only. Tokens and connection keys never reach the browser: the popup
// only carries a one-time exchange code, which is redeemed here and stored
// encrypted against the authenticated operator.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "@/lib/content-ops/membership.server";
import {
  authorizeAppUserOAuth,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import {
  CONNECTOR_GATEWAY_BASE_URL,
  connectorReturnUrl,
  providerKeyForConnector,
  resolveConnectorSetup,
} from "./app-user-connector.server";
import {
  deleteAppUserConnection,
  getAppUserConnection,
  saveAppUserConnection,
} from "./app-user-connections.server";

const ConnectInput = z.object({
  organizationId: z.string().uuid(),
  connectorId: z.string().min(1).max(64),
});

const CompleteInput = z.object({
  organizationId: z.string().uuid(),
  connectorId: z.string().min(1).max(64),
  code: z.string().min(1).max(4096),
});

export interface ConnectorConnectResult {
  ok: boolean;
  authorizationUrl: string | null;
  reason: string | null;
  missingEnv: string[];
}

export const beginConnectorConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ConnectInput.parse(v))
  .handler(async ({ data, context }): Promise<ConnectorConnectResult> => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "executive");

    const providerKey = providerKeyForConnector(data.connectorId);
    if (!providerKey) {
      return { ok: false, authorizationUrl: null, reason: "unknown_connector", missingEnv: [] };
    }
    const setup = resolveConnectorSetup(providerKey);
    if (!setup) {
      return { ok: false, authorizationUrl: null, reason: "unknown_connector", missingEnv: [] };
    }
    if (!setup.clientApiKey || setup.missingEnv.length > 0) {
      return {
        ok: false,
        authorizationUrl: null,
        reason: "connector_client_not_configured",
        missingEnv: setup.missingEnv.length > 0 ? setup.missingEnv : [setup.clientApiKeyEnv],
      };
    }

    const request = getRequest();
    if (!request) {
      return { ok: false, authorizationUrl: null, reason: "no_request_context", missingEnv: [] };
    }

    // Reconnect passes the stored key so the gateway can confirm ownership.
    const existing = await getAppUserConnection(context.userId, setup.connectorId);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: CONNECTOR_GATEWAY_BASE_URL,
      connectorId: setup.connectorId,
      appUserId: context.userId,
      clientAPIKey: setup.clientApiKey,
      returnUrl: connectorReturnUrl(request),
      connectionAPIKey: existing?.connectionAPIKey,
      credentialsConfiguration: setup.scopes.length ? { scopes: setup.scopes } : undefined,
    });
    return { ok: true, authorizationUrl, reason: null, missingEnv: [] };
  });

export const completeConnectorConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CompleteInput.parse(v))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason: string | null }> => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "executive");

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      CONNECTOR_GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== data.connectorId) {
      return { ok: false, reason: "connector_mismatch" };
    }
    await saveAppUserConnection({
      userId: context.userId,
      connectorId,
      connectionAPIKey,
      externalIdentity: null,
    });
    return { ok: true, reason: null };
  });

export const disconnectConnector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ConnectInput.parse(v))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason: string | null }> => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "executive");

    const stored = await getAppUserConnection(context.userId, data.connectorId);
    if (stored) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: CONNECTOR_GATEWAY_BASE_URL,
          connectionAPIKey: stored.connectionAPIKey,
          connectorId: data.connectorId,
        });
      } catch {
        // Gateway revocation failed. Still drop the local key so the operator
        // is not left with an unusable connection they cannot clear.
      }
    }
    await deleteAppUserConnection(context.userId, data.connectorId);
    return { ok: true, reason: null };
  });
