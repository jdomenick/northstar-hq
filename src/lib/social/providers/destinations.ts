// Destination selection + permission validation contracts.
//
// Facebook Pages, Instagram professional accounts, LinkedIn organizations,
// Reddit subreddits, and Beehiiv publications all require the connector to
// enumerate destinations after auth and let the user pick one. Adapters
// implement `listDestinations` and `validatePermissions` against the
// resolved credential; callers persist the selection into `social_accounts`
// (externalAccountId + destinationRef) and re-validate before every publish.

import type { ResolvedCredential } from "./credentials";

export interface ProviderDestination {
  id: string;                            // provider-native id (Page id, subreddit name, publication id)
  displayName: string;
  kind: string;                          // "page" | "ig_business" | "subreddit" | "org" | "publication" | ...
  handle?: string | null;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown>;
  // Some destinations need extra approval (subreddit modmail, IG linked-page).
  requiresManualApproval?: boolean;
  approvalNote?: string | null;
}

export interface PermissionCheck {
  ok: boolean;
  missingScopes: string[];
  missingCapabilities: string[];        // e.g. "pages_manage_posts", "instagram_basic"
  destinationReachable: boolean | null; // null when no destination selected
  reason?: string | null;
}

export interface OAuthStartResult {
  authorizationUrl: string;
  state: string;                        // opaque, caller stores + verifies on callback
  codeVerifier?: string;                // PKCE
  expiresAt: string;                    // ISO
}

export interface OAuthCallbackInput {
  code: string;
  state: string;
  codeVerifier?: string;
  redirectUri: string;
}

export interface OAuthCallbackResult {
  credential: Omit<ResolvedCredential, "connectionId" | "socialAccountId">;
  destinations: ProviderDestination[];  // pre-fetched when the provider returns them
}