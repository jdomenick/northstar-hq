// Provider adapter registry (S1a - expanded contract).
//
// Adapters MUST NOT approve content, transition authoritative state, or
// override kill switches / autonomy. They are invoked only from server code,
// under an active connection, after `assertPublishingAllowed` has passed.
// Every method that touches the vendor returns a `ProviderResult<T>` so
// callers never need try/catch across a vendor boundary; unexpected failures
// are normalized via the `ProviderError` model.

import type { ProviderCapabilities } from "./capabilities";
import type {
  ResolvedCredential,
} from "./credentials";
import type {
  OAuthCallbackInput,
  OAuthCallbackResult,
  OAuthStartResult,
  PermissionCheck,
  ProviderDestination,
} from "./destinations";
import type { ProviderError } from "./errors";

export type ProviderResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProviderError };

export type PublishStatus =
  | "published"
  | "scheduled"
  | "failed"
  | "blocked_missing_credentials";

export interface PublishMediaRef {
  assetId: string | null;
  storageRef: string;                     // supabase storage path or absolute https
  mimeType: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  externalMediaId?: string | null;        // set after uploadMedia
}

export interface PublishInput {
  organizationId: string;
  ventureId: string;
  contentItemId: string;
  socialAccountId: string | null;
  title: string | null;
  body: string;
  hashtags: string[];
  mentions?: string[];
  linkUrl: string | null;
  media?: PublishMediaRef[];
  firstComment?: string | null;
  scheduledFor: string | null;
  // Newsletter-only (beehiiv-shaped):
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

export interface UploadMediaInput {
  credential: ResolvedCredential;
  storageRef: string;
  mimeType: string;
  altText?: string | null;
}

export interface UploadMediaResult {
  externalMediaId: string;
  processingComplete: boolean;
  raw?: unknown;
}

export type SocialProviderImplementationStatus =
  | "not_implemented"
  | "blocked_no_credentials"
  | "implemented";

/**
 * Full adapter surface. All methods except `getCapabilities` and
 * `implementationStatus` are optional; callers must consult capabilities
 * before invoking them. See docs/architecture/social-adapter-contract.md.
 */
export interface SocialProviderAdapter {
  readonly key: string;
  readonly implementationStatus: SocialProviderImplementationStatus;
  readonly connectorVersion: string;

  getCapabilities(): ProviderCapabilities;

  // ---- Auth / connection lifecycle -------------------------------------
  beginOAuth?(input: { organizationId: string; ventureId: string; redirectUri: string; requestedScopes?: string[] }): Promise<ProviderResult<OAuthStartResult>>;
  completeOAuth?(input: OAuthCallbackInput): Promise<ProviderResult<OAuthCallbackResult>>;
  refreshCredentials?(credential: ResolvedCredential): Promise<ProviderResult<{ accessToken: string; refreshToken?: string | null; expiresAt: string | null }>>;
  validatePermissions?(credential: ResolvedCredential): Promise<ProviderResult<PermissionCheck>>;

  // ---- Destination discovery -------------------------------------------
  listDestinations?(credential: ResolvedCredential): Promise<ProviderResult<ProviderDestination[]>>;

  // ---- Media -----------------------------------------------------------
  uploadMedia?(input: UploadMediaInput): Promise<ProviderResult<UploadMediaResult>>;

  // ---- Publishing / read ----------------------------------------------
  publish?(input: PublishInput, credential?: ResolvedCredential): Promise<PublishResult>;
  fetchMetrics?(externalPostId: string, credential?: ResolvedCredential): Promise<MetricsResult>;
  verifyPublication?(externalPostId: string, credential?: ResolvedCredential): Promise<{ verified: boolean; reason?: string }>;
  deletePublication?(externalPostId: string, credential: ResolvedCredential): Promise<ProviderResult<{ deleted: boolean }>>;
}

import { beehiivAdapter } from "./beehiiv";
import { facebookAdapter } from "./facebook";
import { instagramAdapter } from "./instagram";
import { linkedinAdapter } from "./linkedin";

export const SOCIAL_PROVIDERS: Record<string, SocialProviderAdapter> = {
  [beehiivAdapter.key]: beehiivAdapter,
  [facebookAdapter.key]: facebookAdapter,
  [instagramAdapter.key]: instagramAdapter,
  [linkedinAdapter.key]: linkedinAdapter,
};

export function getSocialProvider(key: string): SocialProviderAdapter | null {
  return SOCIAL_PROVIDERS[key] ?? null;
}

export type { ProviderCapabilities } from "./capabilities";
export type { ResolvedCredential, CredentialKind, CredentialResolver } from "./credentials";
export type {
  ProviderDestination, PermissionCheck, OAuthStartResult, OAuthCallbackInput, OAuthCallbackResult,
} from "./destinations";
export { ProviderError, isProviderError, sanitizeProviderError, PROVIDER_ERROR_CODES } from "./errors";
export type { ProviderErrorCode, ProviderErrorContext } from "./errors";