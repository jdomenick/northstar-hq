// Provider registry - single source of truth for every integration NorthStar
// Labs exposes. Client-safe (no secrets, no I/O). Server-side probes read
// from this list to build the dashboard rows.

export type IntegrationCategory =
  | "publishing"
  | "communication"
  | "commerce"
  | "data"
  | "automation"
  | "sam"
  | "workspace";

export type IntegrationCapability =
  | "read"
  | "write"
  | "publish"
  | "schedule"
  | "metrics"
  | "sync"
  | "delete"
  | "webhook_in"
  | "webhook_out"
  | "oauth_user"
  | "media_upload";

export type AuthModel =
  | "api_key"                        // provider issues a static key we store as an env secret
  | "oauth_app"                      // OAuth via a Lovable App connector (project-level)
  | "oauth_user"                     // OAuth via App User Connector (per-user)
  | "oauth_meta_managed"             // this project's own Meta OAuth flow
  | "self"                           // this project (Supabase)
  | "user_config"                    // user-provided config rows (webhooks, REST endpoints, MCP)
  | "unmanaged";                     // roadmap only

export interface ProviderDefinition {
  key: string;                       // stable id
  label: string;                     // display name
  category: IntegrationCategory;
  auth: AuthModel;
  capabilities: IntegrationCapability[];
  // Environment variables the runtime needs. Presence is checked by the probe.
  requiredEnv?: string[];            // absence => "awaiting_credentials"
  optionalEnv?: string[];
  // Scopes / permissions the vendor requires.
  requiredScopes?: string[];
  // What external step remains when the runtime can't complete the connection.
  externalStep?: string;
  // Docs URL surfaced in the detail drawer.
  docsUrl?: string;
  // Route in this app to manage the integration (if not the default drawer).
  managePath?: string;
  // Short description shown in the detail drawer.
  description: string;
  // Provider-supplied capability approval status.
  approvalRequired?: boolean;
  approvalStatus?: "not_started" | "in_review" | "approved" | "denied";
}

export const INTEGRATION_PROVIDERS: ProviderDefinition[] = [
  // ---- Publishing ------------------------------------------------------
  {
    key: "beehiiv",
    label: "Beehiiv",
    category: "publishing",
    auth: "api_key",
    capabilities: ["publish", "schedule", "metrics"],
    requiredEnv: ["BEEHIIV_API_KEY", "BEEHIIV_PUBLICATION_ID"],
    optionalEnv: ["BEEHIIV_PUBLISH_ARMED"],
    externalStep: "Beehiiv API Key and Publication ID must be added as environment secrets.",
    docsUrl: "https://developers.beehiiv.com/",
    description: "Newsletter delivery via Beehiiv API v2. Drafts, scheduled sends, and post metrics.",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    category: "publishing",
    auth: "oauth_app",
    capabilities: ["publish", "delete"],
    requiredEnv: ["LINKEDIN_API_KEY"],
    requiredScopes: ["openid", "profile", "email", "w_member_social"],
    externalStep: "LinkedIn connector must be linked to this project by an admin.",
    docsUrl: "https://learn.microsoft.com/linkedin/",
    description: "Personal or company profile publishing via LinkedIn UGC Posts API.",
  },
  {
    key: "facebook",
    label: "Facebook Page",
    category: "publishing",
    auth: "oauth_meta_managed",
    capabilities: ["publish", "schedule", "metrics", "delete", "media_upload"],
    requiredEnv: ["META_APP_ID", "META_APP_SECRET"],
    requiredScopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_metadata"],
    approvalRequired: true,
    externalStep: "Requires Meta App Review approval for pages_manage_posts before live publishing.",
    docsUrl: "https://developers.facebook.com/docs/pages-api/",
    description: "Publish, schedule, and read insights on a Facebook Page via the Graph API.",
  },
  {
    key: "instagram",
    label: "Instagram Business",
    category: "publishing",
    auth: "oauth_meta_managed",
    capabilities: ["publish", "metrics", "media_upload"],
    requiredEnv: ["META_APP_ID", "META_APP_SECRET"],
    requiredScopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
    approvalRequired: true,
    externalStep: "Requires a Facebook Page linked to an Instagram Business account, plus App Review for instagram_content_publish.",
    docsUrl: "https://developers.facebook.com/docs/instagram-api/",
    description: "Feed and Reels publishing to an Instagram Business account via the Meta Graph API.",
  },
  {
    key: "x",
    label: "X (Twitter)",
    category: "publishing",
    auth: "oauth_app",
    capabilities: ["publish", "delete", "metrics"],
    requiredEnv: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    requiredScopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    approvalRequired: true,
    externalStep: "Requires an X (Twitter) developer OAuth 2.0 app with elevated access; add X_CLIENT_ID and X_CLIENT_SECRET.",
    docsUrl: "https://developer.x.com/en/docs/x-api",
    description: "Post tweets via X API v2 (adapter shell wired for activation on credentials).",
  },
  {
    key: "reddit",
    label: "Reddit",
    category: "publishing",
    auth: "oauth_app",
    capabilities: ["publish", "read"],
    requiredEnv: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
    requiredScopes: ["submit", "identity", "read"],
    externalStep: "Requires a Reddit script or web-app credential pair (client id + secret).",
    docsUrl: "https://www.reddit.com/dev/api",
    description: "Submit to subreddits via the Reddit OAuth API (adapter shell).",
  },
  {
    key: "google_business_profile",
    label: "Google Business Profile",
    category: "publishing",
    auth: "oauth_user",
    capabilities: ["publish", "read", "metrics"],
    requiredEnv: ["GOOGLE_BUSINESS_PROFILE_APP_USER_CONNECTOR_CLIENT_API_KEY"],
    approvalRequired: true,
    externalStep: "Requires Google Cloud OAuth client + allowlisting for the Business Profile API, then an App User Connector client.",
    docsUrl: "https://developers.google.com/my-business",
    description: "Publish posts and manage locations on Google Business Profile per signed-in user.",
  },
  {
    key: "google_ads",
    label: "Google Ads",
    category: "publishing",
    auth: "oauth_user",
    capabilities: ["read", "write", "metrics"],
    requiredEnv: ["GOOGLE_ADS_APP_USER_CONNECTOR_CLIENT_API_KEY", "GOOGLE_ADS_DEVELOPER_TOKEN"],
    approvalRequired: true,
    externalStep: "Requires a Google Ads developer token (approval required by Google) and an OAuth client.",
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    description: "Report and manage Google Ads campaigns via the Google Ads API.",
  },

  // ---- Communication ---------------------------------------------------
  {
    key: "google_mail",
    label: "Gmail",
    category: "communication",
    auth: "oauth_user",
    capabilities: ["read", "write", "oauth_user"],
    requiredEnv: ["GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY"],
    requiredScopes: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    externalStep: "Ask Lovable to configure the google_mail App User Connector client for this project.",
    docsUrl: "https://developers.google.com/gmail/api",
    description: "Per-user Gmail access (read, threads, drafts) via App User Connector.",
  },
  {
    key: "google_calendar",
    label: "Google Calendar",
    category: "communication",
    auth: "oauth_user",
    capabilities: ["read", "write", "oauth_user"],
    requiredEnv: ["GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY"],
    requiredScopes: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    externalStep: "Ask Lovable to configure the google_calendar App User Connector client for this project.",
    docsUrl: "https://developers.google.com/calendar",
    description: "Per-user Google Calendar events and availability via App User Connector.",
  },

  // ---- Data / storage --------------------------------------------------
  {
    key: "google_drive",
    label: "Google Drive",
    category: "data",
    auth: "oauth_user",
    capabilities: ["read", "write", "oauth_user"],
    requiredEnv: ["GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY"],
    requiredScopes: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
    externalStep: "Ask Lovable to configure the google_drive App User Connector client for this project.",
    docsUrl: "https://developers.google.com/drive",
    description: "Per-user Google Drive file access via App User Connector.",
  },
  {
    key: "supabase_self",
    label: "NorthStar Database (Supabase)",
    category: "data",
    auth: "self",
    capabilities: ["read", "write", "sync"],
    requiredEnv: ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"],
    description: "This project's own Postgres database, Auth, and Storage - always connected.",
    docsUrl: "https://supabase.com/docs",
  },
  {
    key: "website_sync",
    label: "Website & Knowledge Sources",
    category: "data",
    auth: "user_config",
    capabilities: ["read", "sync"],
    managePath: "/settings/integrations",
    description: "Websites, sitemaps, APIs, and files SAM ingests as knowledge records.",
  },

  // ---- Commerce --------------------------------------------------------
  {
    key: "stripe",
    label: "Stripe",
    category: "commerce",
    auth: "api_key",
    capabilities: ["read", "write", "metrics", "webhook_in"],
    requiredEnv: ["STRIPE_SECRET_KEY"],
    optionalEnv: ["STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"],
    externalStep: "Add STRIPE_SECRET_KEY (starts with sk_live_ or sk_test_). Optional: STRIPE_WEBHOOK_SECRET.",
    docsUrl: "https://docs.stripe.com/api",
    description: "Payments, subscriptions, invoices, and webhook receipt.",
  },

  // ---- Automation / Custom --------------------------------------------
  {
    key: "webhooks",
    label: "Outbound Webhooks",
    category: "automation",
    auth: "user_config",
    capabilities: ["webhook_out"],
    managePath: "/sam/integrations/webhooks",
    description: "Send signed HTTP webhooks from NorthStar to external systems on SAM events.",
  },
  {
    key: "rest_endpoints",
    label: "Custom REST API",
    category: "automation",
    auth: "user_config",
    capabilities: ["read", "write"],
    managePath: "/sam/integrations/rest-endpoints",
    description: "Reusable REST endpoints SAM can call with stored auth (bearer, header, basic, or query param).",
  },
  {
    key: "sam_mcp",
    label: "SAM MCP Servers",
    category: "sam",
    auth: "user_config",
    capabilities: ["read", "write"],
    managePath: "/sam/integrations#sam-mcp",
    description: "MCP servers SAM connects to for external tools. Configure URL and API key per connection.",
  },
];

export function getProvider(key: string): ProviderDefinition | null {
  return INTEGRATION_PROVIDERS.find((p) => p.key === key) ?? null;
}

export const CATEGORY_ORDER: IntegrationCategory[] = [
  "publishing",
  "communication",
  "commerce",
  "data",
  "automation",
  "sam",
  "workspace",
];

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  publishing: "Publishing",
  communication: "Communication",
  commerce: "Commerce",
  data: "Data & Knowledge",
  automation: "Automation",
  sam: "SAM",
  workspace: "Workspace",
};