// Meta deauthorization webhook. Called by Meta when a user removes the app.
// We verify the signed_request, then mark destinations disconnected + purge
// page tokens. Returns 503 meta_not_configured before secrets exist.

import { createFileRoute } from "@tanstack/react-router";
import { readMetaConfigStatus } from "@/lib/social/providers/meta/config.server";
import { verifySignedRequest } from "@/lib/social/providers/meta/oauth.server";

export const Route = createFileRoute("/api/public/oauth/meta/deauthorize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = readMetaConfigStatus();
        if (!cfg.configured) {
          return Response.json({ error: "meta_not_configured" }, { status: 503 });
        }
        const form = await request.formData();
        const signed = String(form.get("signed_request") ?? "");
        const payload = verifySignedRequest(signed);
        if (!payload) return Response.json({ error: "invalid_signature" }, { status: 401 });
        const providerUserId = String((payload as { user_id?: string }).user_id ?? "");
        if (!providerUserId) return Response.json({ error: "no_user_id" }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: accounts } = await supabaseAdmin
          .from("social_accounts")
          .select("id, organization_id")
          .eq("external_account_id", providerUserId)
          .in("platform", ["facebook", "instagram"]);
        for (const acc of (accounts as Array<{ id: string; organization_id: string }> | null) ?? []) {
          await supabaseAdmin
            .from("social_accounts")
            .update({ connection_status: "revoked" } as never)
            .eq("id", acc.id);
          const { data: dests } = await supabaseAdmin
            .from("meta_destinations")
            .select("id")
            .eq("social_account_id", acc.id);
          for (const d of (dests as Array<{ id: string }> | null) ?? []) {
            await supabaseAdmin.from("meta_page_tokens").update({ revoked_at: new Date().toISOString() } as never).eq("destination_id", d.id);
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
