// Provider adapter registry. Live adapters MUST NOT approve content,
// transition authoritative state, or override kill switches / autonomy.
// They are invoked only from server code, under an active connector, and
// only after `assertPublishingAllowed` has passed.

export type PublishStatus =
  | "published"
  | "scheduled"
  | "failed"
  | "blocked_missing_credentials";

export interface PublishInput {
  organizationId: string;
  ventureId: string;
  contentItemId: string;
  socialAccountId: string | null;
  title: string | null;
  body: string;
  hashtags: string[];
  linkUrl: string | null;
  scheduledFor: string | null;
  newsletterSubject: string | null;
  newsletterPreview: string | null;
}

export interface PublishResult {
  status: PublishStatus;
  externalPostId: string | null;
  externalPostUrl: string | null;
  providerMessage: string | null;
  raw?: unknown;
}

export interface MetricsResult {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  saves?: number;
  raw?: unknown;
}

export type SocialProviderImplementationStatus =
  | "not_implemented"
  | "blocked_no_credentials"
  | "implemented";

export interface SocialProviderAdapter {
  readonly key: string;
  readonly implementationStatus: SocialProviderImplementationStatus;
  readonly connectorVersion: string;
  publish?(input: PublishInput): Promise<PublishResult>;
  fetchMetrics?(externalPostId: string): Promise<MetricsResult>;
  verifyPublication?(externalPostId: string): Promise<{ verified: boolean; reason?: string }>;
}

import { beehiivAdapter } from "./beehiiv";

export const SOCIAL_PROVIDERS: Record<string, SocialProviderAdapter> = {
  [beehiivAdapter.key]: beehiivAdapter,
};

export function getSocialProvider(key: string): SocialProviderAdapter | null {
  return SOCIAL_PROVIDERS[key] ?? null;
}