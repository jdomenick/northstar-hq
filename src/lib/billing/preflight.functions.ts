// Read-only Stripe preflight. Executive-only. Never returns secret values.
// Reports key/secret MODE (test vs live), connected account posture, and
// registered webhook endpoints so the operator can verify LIVE readiness
// without ever shipping a secret client-side.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EndpointSummary = {
  id: string;
  url: string;
  status: string;
  livemode: boolean;
  api_version: string | null;
  enabled_events: string[];
};

export const stripePreflightFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Executive-only.
    const org = await context.supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", context.userId)
      .in("role", ["owner", "executive"])
      .limit(1)
      .maybeSingle();
    if (!org.data) throw new Error("Forbidden: executive role required");

    const rawKey = process.env.STRIPE_SECRET_KEY ?? "";
    const rawWhSec = process.env.STRIPE_WEBHOOK_SECRET ?? "";

    const keyPresent = Boolean(rawKey);
    const keyMode: "live" | "test" | "unknown" = rawKey.startsWith("sk_live_")
      ? "live"
      : rawKey.startsWith("sk_test_")
        ? "test"
        : "unknown";
    const whSecPresent = Boolean(rawWhSec);
    const whSecShape = /^whsec_/.test(rawWhSec);

    if (!keyPresent || keyMode === "unknown") {
      return {
        ok: false,
        reason: "STRIPE_SECRET_KEY missing or malformed",
        secrets: { keyPresent, keyMode, whSecPresent, whSecShape },
      } as const;
    }

    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();

    const account = await stripe.accounts.retrieve("");
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const targetUrl = "https://northstar-labs.lovable.app/api/public/stripe/webhook";
    const matching: EndpointSummary[] = endpoints.data
      .filter((e) => e.url === targetUrl)
      .map((e) => ({
        id: e.id,
        url: e.url,
        status: e.status,
        livemode: e.livemode,
        api_version: e.api_version ?? null,
        enabled_events: e.enabled_events,
      }));

    return {
      ok: true,
      secrets: { keyPresent, keyMode, whSecPresent, whSecShape },
      account: {
        id: account.id,
        country: account.country,
        default_currency: account.default_currency,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        business_profile_name: account.business_profile?.name ?? null,
      },
      webhook: {
        target_url: targetUrl,
        matching_count: matching.length,
        endpoints: matching,
        all_endpoints_count: endpoints.data.length,
      },
    } as const;
  });