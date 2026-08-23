// Server-only support for the App User Connector flow used by the
// Integrations page. Keeps the *.functions.ts wrapper thin.

import { getProvider, INTEGRATION_PROVIDERS } from "./providers";

export const CONNECTOR_GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

export interface ConnectorSetup {
  connectorId: string;
  clientApiKeyEnv: string;
  clientApiKey: string | null;
  scopes: string[];
  missingEnv: string[];
}

/**
 * Resolve the connector wiring for a provider key. Returns null when the
 * provider does not connect through an App User Connector at all.
 */
export function resolveConnectorSetup(providerKey: string): ConnectorSetup | null {
  const def = getProvider(providerKey);
  if (!def || def.auth !== "oauth_user" || !def.connectorId) return null;
  const clientApiKeyEnv =
    (def.requiredEnv ?? []).find((n) => n.endsWith("_APP_USER_CONNECTOR_CLIENT_API_KEY")) ??
    `${def.connectorId.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`;
  const missingEnv = (def.requiredEnv ?? []).filter((n) => {
    const v = process.env[n];
    return !(typeof v === "string" && v.length > 0);
  });
  const clientApiKey = process.env[clientApiKeyEnv] ?? null;
  return {
    connectorId: def.connectorId,
    clientApiKeyEnv,
    clientApiKey: clientApiKey && clientApiKey.length > 0 ? clientApiKey : null,
    scopes: def.requiredScopes ?? [],
    missingEnv,
  };
}

/** Map a connector id back to the provider key that owns it. */
export function providerKeyForConnector(connectorId: string): string | null {
  return INTEGRATION_PROVIDERS.find((p) => p.connectorId === connectorId)?.key ?? null;
}

/**
 * Absolute, same-origin return URL for the connector popup. The sandbox
 * rewrites to localhost, where x-forwarded-host is proxy-sanitized; anywhere
 * else the request URL is authoritative.
 */
export function connectorReturnUrl(request: Request): string {
  const url = new URL(request.url);
  const sandboxHost =
    url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
  const base = sandboxHost ? `https://${sandboxHost}` : url.origin;
  return new URL("/oauth/connector/return", base).toString();
}
