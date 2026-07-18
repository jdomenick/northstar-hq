// Public media delivery endpoint (Instagram fetches images from this URL
// when creating a media container). Validates single-use, unexpired token,
// then streams the underlying asset. The private storage bucket is NEVER
// made public; each delivery is scoped by token to one asset for one purpose.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/media/meta-delivery/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 16) return new Response("invalid", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("meta_media_delivery_tokens")
          .select("id, asset_id, organization_id, expires_at, consumed_at, purpose")
          .eq("token", token)
          .maybeSingle();
        if (!row) return new Response("not found", { status: 404 });
        const t = row as { id: string; asset_id: string; expires_at: string; consumed_at: string | null; purpose: string };
        if (t.consumed_at) return new Response("gone", { status: 410 });
        if (new Date(t.expires_at).getTime() < Date.now()) return new Response("expired", { status: 410 });
        const { data: asset } = await supabaseAdmin
          .from("content_media_assets")
          .select("storage_path, mime_type")
          .eq("id", t.asset_id)
          .maybeSingle();
        if (!asset) return new Response("asset missing", { status: 404 });
        const a = asset as { storage_path: string; mime_type: string };
        // Create a short-lived signed URL from Supabase Storage and redirect.
        // The bucket stays private; Meta's fetch follows the redirect once.
        const { data: signed } = await supabaseAdmin.storage
          .from("organization-documents")
          .createSignedUrl(a.storage_path, 300);
        if (!signed?.signedUrl) return new Response("no url", { status: 500 });
        await supabaseAdmin
          .from("meta_media_delivery_tokens")
          .update({ consumed_at: new Date().toISOString() } as never)
          .eq("id", t.id);
        return Response.redirect(signed.signedUrl, 302);
      },
    },
  },
});
