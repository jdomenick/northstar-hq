// Facebook Pages adapter (framework only). Capabilities derive live from Meta
// config; publish() truthfully returns blocked_missing_credentials until a
// real OAuth-obtained credential is wired in. No HTTP calls in this phase.

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
