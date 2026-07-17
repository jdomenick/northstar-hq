// Connector registry. Connectors register themselves here so the sync engine
// can look them up by (provider, connectionType). Empty in 3D.1 - the
// website connector lands in 3D.2.

import type { IntegrationConnector, IntegrationConnectionType, IntegrationProvider } from "./types";
import { IntegrationError } from "./errors";

type Key = `${IntegrationProvider}:${IntegrationConnectionType}`;

const REGISTRY = new Map<Key, IntegrationConnector>();

function keyOf(provider: IntegrationProvider, type: IntegrationConnectionType): Key {
  return `${provider}:${type}`;
}

export function registerConnector(connector: IntegrationConnector): void {
  const k = keyOf(connector.provider, connector.connectionType);
  if (REGISTRY.has(k)) {
    throw new Error(`Integration connector already registered: ${k}`);
  }
  REGISTRY.set(k, connector);
}

export function getConnector(
  provider: IntegrationProvider,
  connectionType: IntegrationConnectionType,
): IntegrationConnector {
  const c = REGISTRY.get(keyOf(provider, connectionType));
  if (!c) {
    throw new IntegrationError("unsupported_provider", `No connector for ${provider}:${connectionType}`);
  }
  return c;
}

export function tryGetConnector(
  provider: IntegrationProvider,
  connectionType: IntegrationConnectionType,
): IntegrationConnector | null {
  return REGISTRY.get(keyOf(provider, connectionType)) ?? null;
}

export function listRegisteredConnectors(): IntegrationConnector[] {
  return Array.from(REGISTRY.values());
}