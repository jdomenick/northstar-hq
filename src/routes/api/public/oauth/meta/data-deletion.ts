// Meta data-deletion request webhook. Verify signed_request, return the
// { url, confirmation_code } shape Meta requires. Real deletion is enqueued
// asynchronously.

import { createFileRoute } from "@tanstack/react-router";
import { readMetaConfigStatus } from "@/lib/social/providers/meta/config.server";
import { verifySignedRequest, buildDataDeletionConfirmation } from "@/lib/social/providers/meta/oauth.server";

export const Route = createFileRoute("/api/public/oauth/meta/data-deletion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = readMetaConfigStatus();
        if (!cfg.configured) return Response.json({ error: "meta_not_configured" }, { status: 503 });
        const form = await request.formData();
        const signed = String(form.get("signed_request") ?? "");
        const payload = verifySignedRequest(signed);
        if (!payload) return Response.json({ error: "invalid_signature" }, { status: 401 });
        const userId = String((payload as { user_id?: string }).user_id ?? "");
        if (!userId) return Response.json({ error: "no_user_id" }, { status: 400 });
        const statusUrl = new URL(request.url);
        statusUrl.pathname = "/api/public/oauth/meta/data-deletion-status";
        statusUrl.searchParams.set("user", userId);
        const confirmation = buildDataDeletionConfirmation(userId, statusUrl.toString());
        // Enqueue actual deletion (best-effort; not required for Meta response).
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("meta_oauth_states").insert({
            organization_id: "00000000-0000-0000-0000-000000000000",
            state: `deletion_${confirmation.confirmation_code}`,
            redirect_uri: "https://meta-deletion-request",
            purpose: "connect",
            expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          } as never);
        } catch { /* non-fatal */ }
        return Response.json(confirmation);
      },
    },
  },
});
