import type { CompletionProvider, ProviderPolicy } from "./types";
import { createLovableGatewayCompletionProvider } from "./lovable-gateway.server";

const DEFAULT_POLICY: ProviderPolicy = {
  primary: "lovable",
  fallback: [],
  privacyTier: "shared_cloud",
};

let cachedPrimary: CompletionProvider | null = null;

export function selectProvider(_intent: string, policy: ProviderPolicy = DEFAULT_POLICY): CompletionProvider {
  if (policy.primary === "lovable") {
    if (!cachedPrimary) cachedPrimary = createLovableGatewayCompletionProvider();
    return cachedPrimary;
  }
  throw new Error(`Unsupported provider: ${policy.primary}`);
}

export function providerHealth(): Promise<{ ok: boolean; message?: string }> {
  return selectProvider("health").healthCheck();
}