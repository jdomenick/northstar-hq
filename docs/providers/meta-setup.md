# Meta (Facebook Page + Instagram) provider setup

One Meta app covers both connectors. Approvals take time - start now,
in parallel with S1b-S1e.

Adapter targets:
- `src/lib/social/providers/facebook.ts`
- `src/lib/social/providers/instagram.ts`

Both hit Meta Graph API v20.0+ and share OAuth via Facebook Login.

## Prerequisites

1. Meta **Business Portfolio** (Business Manager) owning: the Facebook
   Page, the Instagram professional account (Business or Creator), and
   the app you're about to create.
2. Business verification complete (documents + domain). Meta will not
   approve write scopes without it. Allow 1-3 business days.
3. Instagram professional account linked to the Facebook Page in Meta
   Business Suite -> Settings -> Accounts -> Instagram accounts.
   Unlinked IG accounts cannot be published to.

## Create the Meta app

1. https://developers.facebook.com/apps -> Create App.
2. App type: **Business**.
3. Attach to the Business Portfolio above.
4. Add products: **Facebook Login for Business**, **Marketing API**,
   **Instagram Graph API**.
5. Valid OAuth redirect URIs:
   ```
   https://northstar-operator-core.lovable.app/api/public/oauth/meta/callback
   https://project--0d729d9b-ddb9-49fb-9d95-0093c085d057-dev.lovable.app/api/public/oauth/meta/callback
   ```
6. App Domains: `northstar-operator-core.lovable.app` (+ preview host).
7. Note the App ID; App settings -> Basic -> generate App Secret.

## Required permissions (all need app review)

Facebook Page:
- `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
  `pages_manage_metadata`, `business_management`

Instagram (same review):
- `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`

Each scope needs a screencast showing exactly where it's used and how
the user consents. Vague submissions get rejected.

## Development vs live mode

- **Development**: Admins/Developers/Test Users only. Build the whole
  connector against your own Page + a test IG account this way.
- **Live**: needs business verification + reviewed scopes. Required
  before external users connect their Pages.

## Token lifecycle

1. OAuth -> short-lived user token (~1h).
2. Exchange for long-lived user token (60d) via
   `GET /oauth/access_token?grant_type=fb_exchange_token`.
3. `GET /me/accounts` -> each Page has a Page token (does not expire
   while the user token is periodically refreshed). Store per-account.
4. `GET /{page-id}?fields=instagram_business_account` -> IG business id.

## Publishing

**Facebook Page (text/link):** POST /{page-id}/feed with `message`, optional `link`, Page token.
**Facebook Page (photo):** POST /{page-id}/photos with `url` or `source`, Page token.
**Instagram (single photo):**
1. POST /{ig-user-id}/media with `image_url` + `caption` -> container id.
2. Poll `GET /{container-id}?fields=status_code` until FINISHED.
3. POST /{ig-user-id}/media_publish with `creation_id`.

IG has no text-only posts. All media URLs must be publicly reachable
https; the S1d media pipeline exposes approved assets on a signed URL
long enough for Meta to fetch.

## Credentials Northstar will read

| Secret name         | Where to find it                                |
|---------------------|-------------------------------------------------|
| `META_APP_ID`       | App settings -> Basic -> App ID                 |
| `META_APP_SECRET`   | App settings -> Basic -> Show                   |
| `META_REDIRECT_URI` | Exact URI registered in Facebook Login          |

Per-user Page tokens live in `integration_connections`, populated by the
OAuth flow.

## Known limitations

- /feed supports 1 image or 1 link per call; carousels via /photos then
  /feed with `attached_media[]` - phase 2.
- IG reels/videos out of scope for phase 1.
- Insights delayed 24-48h for some fields.
- Rate limits per-app + per-user; heavy publishing needs BUC handling
  via `X-Business-Use-Case-Usage`.