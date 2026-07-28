import type { CompletionProvider, ProviderPolicy } from "./types";
import { createLovableGatewayCompletionProvider } from "./lovable-gateway.server";

const DEFAULT_POLICY: ProviderPolicy = {
  primary: "lovable",
  fallback: [],
  privacyTier: "shared_cloud",
};

let cachedPrimary: CompletionProvider | null = null;
let testProvider: CompletionProvider | null = null;

export function selectProvider(_intent: string, policy: ProviderPolicy = DEFAULT_POLICY): CompletionProvider {
  if (testProvider) return testProvider;
  if (policy.primary === "lovable") {
    if (!cachedPrimary) cachedPrimary = createLovableGatewayCompletionProvider();
    return cachedPrimary;
  }
  throw new Error(`Unsupported provider: ${policy.primary}`);
}

export function providerHealth(): Promise<{ ok: boolean; message?: string }> {
  return selectProvider("health").healthCheck();
}

// TEST-ONLY injection hook. Used exclusively by the reasoning eval harness to
// exercise the real strategy contracts against canned outputs. Not exported
// from any client-reachable module.
export function __setTestProvider(p: CompletionProvider | null): void {
  testProvider = p;
}
export function __getTestProvider(): CompletionProvider | null {
  return testProvider;
}