// Instagram Business adapter (framework only). Same posture as Facebook.

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
  implementationStatus: "blocked_no_credentials",
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
      externalPostId: null,
      externalPostUrl: null,
      providerMessage: reason,
      raw: { blocked: true, reason },
    };
  },

  async fetchMetrics(): Promise<MetricsResult> {
    return { raw: { reason: "Meta not connected" } };
  },

  async verifyPublication() {
    return { verified: false, reason: "Meta not connected" };
  },
};
