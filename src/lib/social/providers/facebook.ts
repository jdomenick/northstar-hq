// Facebook Pages adapter. Capabilities derive live from Meta config + a
// resolved credential; publish() is never invoked while capabilities report
// publishAvailable=false. Request builders are pure (see request-builders).

import type {
  SocialProviderAdapter,
  PublishInput,
  PublishResult,
  MetricsResult,
} from "./index";
import { readMetaConfigStatus } from "./meta/config.server";
import { summarizeMetaCapabilities, toProviderCapabilities } from "./meta/capabilities";

const ADAPTER_VERSION = "facebook.v0.1.0-framework";

export const facebookAdapter: SocialProviderAdapter = {
  key: "facebook",
  implementationStatus: "framework_only",
  connectorVersion: ADAPTER_VERSION,

  getCapabilities() {
    const cfg = readMetaConfigStatus();
    // Framework capability: no resolved credential yet, so connected=false.
    const summary = summarizeMetaCapabilities({
      configured: cfg.configured,
      connected: false,
      grantedPermissions: [],
      destinationCount: 0,
      publishableDestinationCount: 0,
      provider: "facebook",
    });
    return toProviderCapabilities("facebook", summary, ADAPTER_VERSION);
  },

  async publish(_input: PublishInput): Promise<PublishResult> {
    const cfg = readMetaConfigStatus();
    const reason = !cfg.configured
      ? `Meta credentials required (missing: ${cfg.missing.join(", ")})`
      : "Meta account not connected";
    return {
      status: "blocked_missing_credentials",
      providerKey: "facebook",
      externalId: null,
      externalUrl: null,
      publishedAt: null,
      providerResponse: { blocked: true, reason },
      providerMessage: reason,
    };
  },

  async fetchMetrics(): Promise<MetricsResult> {
    return {
      status: "unavailable",
      providerKey: "facebook",
      metrics: [],
      collectedAt: new Date().toISOString(),
      providerResponse: { reason: "Meta not connected" },
    };
  },

  async verifyPublication() {
    return { verified: false, reason: "Meta not connected" };
  },
};
