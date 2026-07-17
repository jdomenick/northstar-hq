# Social provider adapter contract (S1a)

One contract, six planned adapters. Each adapter is a thin translator
between a normalized Northstar surface and one vendor SDK. Adapters
never mutate our tables, never approve content, never bypass gates.

## Files

```
src/lib/social/providers/
  index.ts          # SocialProviderAdapter, PublishInput/Result, registry
  capabilities.ts   # ProviderCapabilities per adapter instance
  credentials.ts    # ResolvedCredential + CredentialResolver
  destinations.ts   # ProviderDestination + PermissionCheck + OAuth types
  errors.ts         # ProviderError + normalized ProviderErrorCode
  beehiiv.ts        # existing adapter (updated to new capability shape)
  x.ts              # planned - after S1e
  facebook.ts       # planned - after X
  instagram.ts      # planned - reuses meta OAuth
  linkedin.ts       # planned
  reddit.ts         # planned
```

## Adapter surface

Required: `key`, `implementationStatus`, `connectorVersion`, `getCapabilities()`.

Optional, each gated by a capability flag:
- Auth: `beginOAuth`, `completeOAuth`, `refreshCredentials`, `validatePermissions`
- Destinations: `listDestinations`
- Media: `uploadMedia`
- Publish/read: `publish`, `fetchMetrics`, `verifyPublication`, `deletePublication`

Callers must inspect `getCapabilities()` before calling optional methods.
A missing capability is a caller mistake and maps to `unsupported_operation`.

## Credential resolution

Adapters never touch `integration_connections` or `process.env` directly.
`CredentialResolver` looks up the row, verifies scope, and hands the
adapter a `ResolvedCredential`. Refresh flows go back through
`persistRefresh` so token rotation is atomic and audited in one place.

## Destination selection

Facebook Pages, IG accounts, LinkedIn orgs, subreddits, Beehiiv
publications: the adapter enumerates via `listDestinations`, the user
picks one, we persist the id into `social_accounts.external_account_id`
(+ `destinationRef` in metadata). Every publish re-runs
`validatePermissions` first so a revoked token or removed Page role
fails fast, not during publish.

## Error normalization

Every vendor error becomes a `ProviderError` with one of
`PROVIDER_ERROR_CODES`. Raw provider bodies stay in `context.providerRaw`
for audit only; `sanitizeProviderError` is the only shape ever surfaced
to clients. `retryable` + `retryAfterSeconds` drive the automation
worker's backoff without hard-coding vendor quirks.

## What this contract deliberately does NOT include

- No autonomy checks. `assertPublishingAllowed` runs BEFORE the adapter.
- No content policy checks. Brand profile / promotion ratio / duplicate
  checks run in `publish-gates.server.ts` before adapter invocation.
- No writes to Northstar tables. The job handler owns state transitions.

## Registry

`SOCIAL_PROVIDERS` is a static map keyed by `adapter.key`. Adding an
adapter is: file under `providers/`, export it, register it, add tests.
Nothing else in the codebase branches on provider key.