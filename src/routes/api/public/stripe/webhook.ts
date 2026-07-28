// Stripe webhook endpoint. Public prefix bypasses auth; security lives in
// signature verification and the atomic-claim ledger.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });
        const raw = await request.text();

        let stripe;
        let webhookSecret: string;
        try {
          const mod = await import("@/lib/billing/stripe.server");
          stripe = mod.getStripe();
          webhookSecret = mod.getWebhookSecret();
        } catch {
          return new Response("Billing not configured", { status: 503 });
        }

        let event;
        try {
          event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { processStripeEvent } = await import("@/lib/billing/webhook.server");
        const result = await processStripeEvent(supabaseAdmin, event);

        if (result.kind === "failed") {
          // Non-2xx signals Stripe to retry.
          return new Response(
            JSON.stringify({ error: "processing_failed" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});