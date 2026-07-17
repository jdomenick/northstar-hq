# X (Twitter) provider setup - what you need to do

Adapter target: `src/lib/social/providers/x.ts` (implemented after S1e).
Auth type: OAuth 2.0 user context with PKCE. Refresh tokens required.
Access tier: Basic ($200/month) or higher. Free tier does NOT allow writes
on v2 endpoints; posting requires Basic+.

## Steps in the X developer portal

1. Create (or open) a Project at https://developer.x.com/en/portal/projects-and-apps.
2. Inside that Project, create an App. Note the App ID.
3. Subscribe the Project to Basic access or higher.
4. App -> User authentication settings:
   - App permissions: **Read and write**.
   - Type of App: **Web App, Automated App or Bot** (yields Client ID + Client Secret with PKCE).
   - Callback URL: `https://northstar-operator-core.lovable.app/api/public/oauth/x/callback`
     (also add the preview host if authorizing from preview).
   - Website URL: `https://northstar-operator-core.lovable.app`
5. Keys and tokens -> OAuth 2.0 Client ID and Secret -> Regenerate and copy both.

## Required OAuth 2.0 scopes

```
tweet.read
tweet.write
users.read
offline.access        # required for refresh tokens
media.write           # required to attach images
```

Without `offline.access` tokens die in ~2h with no refresh path.

## Media, limits, quirks

- v2 POST /2/media/upload on Basic+; JPEG/PNG/WEBP/GIF <=5MB.
- Alt text via POST /2/media/metadata/create.
- User-context posting: 200/15min, 2400/24h. Basic tier caps 3,000/month app-wide.
- X rejects near-duplicate tweets from the same account; our duplicate
  fingerprint gate must catch this first.

## Credentials Northstar will read

| Secret name        | Where to find it                          |
|--------------------|-------------------------------------------|
| `X_CLIENT_ID`      | X portal -> Keys and tokens -> OAuth 2.0  |
| `X_CLIENT_SECRET`  | Same panel; regenerate once, copy once    |
| `X_REDIRECT_URI`   | The exact callback URL registered above   |

Per-user access/refresh tokens go into `integration_connections` via the
OAuth flow - you never paste them.

## Not until you approve

Approval Required stays on. First live test uses one reviewed Healing
Path draft, not test garbage.