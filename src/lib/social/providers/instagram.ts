// Instagram Business adapter. Same framework posture as Facebook: no HTTP
// call is executed while capabilities report publishAvailable=false.

import type {
  SocialProviderAdapter,
  PublishInput,
  PublishResult,
  MetricsResult,
} from "./index";
import { readMetaConfigStatus } from "./meta/config.server";
import { summarizeMetaCapabilities, toProviderCapabilities } from "./meta/capabilities";

const ADAPTER_VERSION = "instagram.v0.1.0-framework";

export const instagramAdapter: SocialProviderAdapter = {
  key: "instagram",
  implementationStatus: "framework_only",
  connectorVersion: ADAPTER_VERSION,

  getCapabilities() {
    const cfg = readMetaConfigStatus();
    const summary = summarizeMetaCapabilities({
      configured: cfg.configured,
      connected: false,
      grantedPermissions: [],
      destinationCount: 0,
      publishableDestinationCount: 0,
      provider: "instagram",
    });
    return toProviderCapabilities("instagram", summary, ADAPTER_VERSION);
  },

  async publish(_input: PublishInput): Promise<PublishResult> {
    const cfg = readMetaConfigStatus();
    const reason = !cfg.configured
      ? `Meta credentials required (missing: ${cfg.missing.join(", ")})`
      : "Meta account not connected";
    return {
      status: "blocked_missing_credentials",
      providerKey: "instagram",
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
      providerKey: "instagram",
      metrics: [],
      collectedAt: new Date().toISOString(),
      providerResponse: { reason: "Meta not connected" },
    };
  },

  async verifyPublication() {
    return { verified: false, reason: "Meta not connected" };
  },
};
