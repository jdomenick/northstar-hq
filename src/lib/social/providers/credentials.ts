// Secure credential contract. Adapters never read env vars or the
// integration_connections table directly - they receive a
// `ResolvedCredential` that the server-side resolver produced after
// verifying org/venture scope and connection status. This keeps every
// adapter unaware of the storage mechanism and prevents credential leaks
// through logs, errors, or handler return values.

import type { SocialPlatform } from "@/lib/constants";

export type CredentialKind = "oauth2_user" | "oauth2_app" | "api_key" | "app_password";

export interface ResolvedCredential {
  connectionId: string;                 // integration_connections.id
  organizationId: string;
  ventureId: string | null;
  socialAccountId: string | null;       // social_accounts.id (null for org-level, e.g. beehiiv)
  platform: SocialPlatform | "beehiiv";
  kind: CredentialKind;
  // Opaque secret material. Adapters read from this shape only.
  // Fields are strictly optional so a rotate/refresh can update one part.
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  appSecret?: string;                   // for signed-request providers
  expiresAt?: string | null;            // ISO string
  grantedScopes: string[];
  // Provider-specific destination context (Page id, publication id, subreddit).
  // Adapters MUST NOT invent defaults; missing = destination not selected.
  externalAccountId?: string | null;
  destinationRef?: string | null;
  destinationMetadata?: Record<string, unknown>;
}

export interface CredentialResolver {
  resolveForAccount(input: {
    organizationId: string;
    ventureId: string;
    socialAccountId: string;
  }): Promise<ResolvedCredential>;
  resolveForOrg(input: {
    organizationId: string;
    ventureId: string;
    platformKey: SocialPlatform | "beehiiv";
  }): Promise<ResolvedCredential>;
  // Called by adapter after a successful refresh. Persists the new tokens
  // atomically against integration_connections; adapters never write.
  persistRefresh(input: {
    connectionId: string;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: string | null;
  }): Promise<void>;
}