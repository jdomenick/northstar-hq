import type {
  SocialProviderAdapter,
  PublishInput,
  PublishResult,
  SocialProviderImplementationStatus,
} from "./index";

/**
 * Beehiiv adapter. Truthfully blocked when BEEHIIV_API_KEY /
 * BEEHIIV_PUBLICATION_ID are absent. Do not fabricate publications.
 *
 * Required credentials to move from `blocked_no_credentials` -> `implemented`:
 *   - BEEHIIV_API_KEY: server secret (Personal API key)
 *   - BEEHIIV_PUBLICATION_ID: target publication id (pub_...)
 *   - Verify the account has "posts:write" scope for the target publication.
 */
function hasCredentials(): boolean {
  return Boolean(process.env.BEEHIIV_API_KEY && process.env.BEEHIIV_PUBLICATION_ID);
}

export const beehiivAdapter: SocialProviderAdapter = {
  key: "beehiiv",
  connectorVersion: "0.1.0",
  get implementationStatus(): SocialProviderImplementationStatus {
    // No implemented publish path yet; even with credentials the adapter
    // stays blocked until the Beehiiv POST/verify flow is wired.
    return hasCredentials() ? "blocked_no_credentials" : "blocked_no_credentials";
  },
  async publish(_input: PublishInput): Promise<PublishResult> {
    return {
      status: "blocked_missing_credentials",
      externalPostId: null,
      externalPostUrl: null,
      providerMessage:
        "Beehiiv adapter blocked: set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID, and confirm the account has posts:write scope. No content was sent.",
    };
  },
};