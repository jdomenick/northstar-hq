// Canonical public-site host. Single source of truth for every public
// marketing URL: canonical tags, OG urls, sitemap, notification links,
// and host-bound provider callbacks.
//
// Production is the custom domain. PUBLIC_SITE_URL (server) or
// VITE_PUBLIC_SITE_URL (browser/build) override it for preview and local
// use so canonical/OG never point at a host the build is not served from.

const PRODUCTION_SITE_URL = "https://northstarlabshq.com";

function normalize(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function resolveSiteUrl(): string {
  const fromServerEnv =
    typeof process !== "undefined" ? normalize(process.env?.["PUBLIC_SITE_URL"]) : null;
  if (fromServerEnv) return fromServerEnv;

  const fromViteEnv = normalize(import.meta.env?.VITE_PUBLIC_SITE_URL as string | undefined);
  if (fromViteEnv) return fromViteEnv;

  return PRODUCTION_SITE_URL;
}

/** Canonical public site origin, no trailing slash. */
export const SITE_URL = resolveSiteUrl();

/** Build an absolute public URL for a site-relative path. */
export function siteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Stripe webhook endpoint on the canonical public host. */
export const STRIPE_WEBHOOK_URL = siteUrl("/api/public/stripe/webhook");

/** Absolute social preview image on the canonical public host. */
export const SOCIAL_IMAGE_URL = siteUrl("/og-image.jpg");
