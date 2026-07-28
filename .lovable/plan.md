# Integrations Module - Production Foundation

Everything is built so each provider becomes operational the moment credentials arrive - no additional UI work.

## Architecture (single source of truth)

```text
src/lib/integrations/
  providers.ts          registry: 17 providers, categories, capabilities, external steps
  probes.server.ts      per-provider status probe (secrets, DB, HTTP)
  dashboard.functions.ts  iterates registry → IntegrationRow[]
  actions.functions.ts  connect / disconnect / test / retry / re-auth per provider
  webhooks.functions.ts CRUD + delivery log for custom outbound webhooks
  rest-endpoints.functions.ts  CRUD + test for Custom REST endpoints
```

Every provider row returns one of these status values (never fabricated):
`connected`, `awaiting_credentials`, `awaiting_oauth_configuration`,
`awaiting_provider_approval`, `ready_to_connect`, `action_needed`,
`authentication_failed`, `connection_error`, `not_configured`, `unknown`.

## Providers covered

| Provider | Adapter | External step surfaced when blocked |
|---|---|---|
| Beehiiv | live (v0.2) | Awaiting API key / Publication ID |
| LinkedIn | live (v0.1) | Ask Lovable to connect LinkedIn connector |
| Facebook Page | live OAuth framework | Meta App ID/Secret + App Review for pages_manage_posts |
| Instagram Business | live OAuth framework | FB Page linked to IG Business + App Review |
| X (Twitter) | credential probe | Needs X API v2 OAuth 2.0 client + elevated access |
| Reddit | credential probe | Needs Reddit script/web app credentials |
| Google Business Profile | credential probe | Requires Google Cloud OAuth client + Business Profile API allow-list |
| Google Ads | credential probe | Requires developer token + OAuth client (approval required) |
| Gmail | App-User Connector shell | Ask Lovable to configure google_mail App User Connector |
| Google Calendar | App-User Connector shell | Ask Lovable to configure google_calendar App User Connector |
| Google Drive | App-User Connector shell | Ask Lovable to configure google_drive App User Connector |
| Stripe | secret probe + live key/publishable key detection | Awaiting `STRIPE_SECRET_KEY` |
| Supabase (this project) | self-probe | Always shows project ref + auth/db reachability |
| SAM MCP Servers | existing panel + list rows | Manage from panel |
| Website Sync | existing `integration_connections` count | Manage sources link |
| Webhooks (outbound) | new table + CRUD + delivery log | Add endpoint |
| Custom REST API | new table + CRUD + test | Add endpoint |

## Database (one migration)

```sql
-- Custom outbound webhooks (from NorthStar → external)
CREATE TABLE public.integration_webhooks (
  id uuid PK, organization_id uuid, venture_id uuid NULL,
  name text NOT NULL, target_url text NOT NULL,
  secret_ciphertext text NULL, event_types text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  last_delivery_at timestamptz, last_status int, last_error text,
  created_at, updated_at
);

CREATE TABLE public.integration_webhook_deliveries (
  id uuid PK, webhook_id uuid, event_type text, status_code int,
  response_body text, error text, attempt int, delivered_at
);

-- Reusable Custom REST endpoints (SAM can call these)
CREATE TABLE public.integration_rest_endpoints (
  id uuid PK, organization_id uuid, venture_id uuid NULL,
  name text, base_url text, method text, auth_type text,
  auth_config_ciphertext text NULL, default_headers jsonb,
  last_success_at, last_error_at, last_error text,
  enabled boolean, created_at, updated_at
);
```

All tables get GRANTs + RLS scoped to org members via `has_org_role`.
Secrets stored encrypted using the same `APP_USER_CONNECTION_KEY_SECRET`
AES-GCM helper already used for app-user connection keys (extract that
helper into `src/lib/crypto/secrets.server.ts` for shared use).

## UI

Single page `/sam/integrations` (already exists) becomes the foundation:

1. Groups: Publishing · Communication · Commerce · Data · Automation · SAM · Roadmap
2. Each card: dot + label + status label + headline + detail + identity + armed + last activity + last error + capability chips + primary action.
3. Click card → right-side **Detail Drawer**:
   - Full description, docs link
   - Capability matrix (read / write / publish / sync / metrics / delete)
   - Required scopes / permissions with checklist of granted vs missing
   - Configuration section (env vars, connected accounts, endpoints)
   - Activity log (last 20 events from `activity_events` or provider-specific table)
   - Actions: Connect · Test · Retry · Re-authenticate · Disconnect · Copy request URL
   - "What still needs to happen" (external step, in plain language)

Two additional routes:
- `/sam/integrations/webhooks` - list, add, edit, disable, delivery log per hook
- `/sam/integrations/rest-endpoints` - list, add, test, edit, delete

## Server functions (all `requireSupabaseAuth` + org membership check)

- `listIntegrationsDashboard({ organizationId })` - iterates registry
- `getIntegrationDetail({ organizationId, key })` - full detail + capability + activity + config
- `testIntegrationConnection({ organizationId, key })` - already exists for Beehiiv/LinkedIn, extend to X, Reddit, Stripe, Supabase, Custom REST
- `retryIntegrationConnection({ organizationId, key })` - re-runs probe + clears last_error
- `reauthenticateIntegration({ organizationId, key })` - returns fresh OAuth URL or the "ask Lovable" instruction
- `listWebhooks`, `createWebhook`, `updateWebhook`, `deleteWebhook`, `listWebhookDeliveries`, `sendTestWebhook`
- `listRestEndpoints`, `createRestEndpoint`, `updateRestEndpoint`, `deleteRestEndpoint`, `testRestEndpoint`

## Safety rules enforced everywhere

- No fabricated `connected` states - status derives from real probes only.
- No secret values in UI - only redacted names and configured-yes/no.
- All writes go through `has_org_role(_, member)` policies.
- Encrypted-at-rest for webhook secrets and REST auth configs.
- Activity log entries created for every connect / test / retry / disconnect.

## Delivery order (one execution)

1. Migration + GRANTs + RLS + crypto helper extraction.
2. `providers.ts` registry with all 17 entries.
3. `probes.server.ts` per-provider probes.
4. Rewrite `dashboard.functions.ts` to iterate registry.
5. Add `getIntegrationDetail`, `retryIntegrationConnection`, `reauthenticateIntegration`, webhook + REST server fns.
6. UI: detail drawer on existing page, two new sub-pages for Webhooks and REST.
7. Typecheck, build, targeted unit tests on probes and CRUD fns.

## Truthful non-completions

- Facebook/Instagram publish requires Meta App Review for `pages_manage_posts` / `instagram_content_publish` - surfaced as "Awaiting Provider Approval" with the exact scopes required.
- X, Reddit, Google Business Profile, Google Ads - each requires the customer's own developer account and OAuth client; adapter shells accept credentials but are marked "Awaiting Credentials" until keys arrive.
- Gmail/Calendar/Drive use App-User Connectors (per-user OAuth) - shells wired for `connector_app_user--connect_client`; UI shows "Ask Lovable to configure App User Connector client".
