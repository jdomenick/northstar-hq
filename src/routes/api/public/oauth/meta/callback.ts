// Meta OAuth callback. Validates state (single-use, unexpired), exchanges
// the code for a short-lived token, upgrades to long-lived, discovers
// destinations, persists tokens, and redirects the user back to the app.
//
// Before secrets exist this route returns 503 meta_not_configured.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readMetaConfigStatus } from "@/lib/social/providers/meta/config.server";
import { exchangeCodeForShortToken, exchangeForLongLivedToken } from "@/lib/social/providers/meta/oauth.server";
import { encryptPageToken } from "@/lib/social/providers/meta/tokens.server";

const QuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export const Route = createFileRoute("/api/public/oauth/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = QuerySchema.safeParse({
          code: url.searchParams.get("code"),
          state: url.searchParams.get("state"),
        });
        if (!parsed.success) {
          return Response.json({ error: "invalid_callback" }, { status: 400 });
        }
        const cfg = readMetaConfigStatus();
        if (!cfg.configured) {
          return Response.json({ error: "meta_not_configured", missing: cfg.missing }, { status: 503 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Validate state (single-use, unexpired).
        const { data: stateRow, error: stateErr } = await supabaseAdmin
          .from("meta_oauth_states")
          .select("id, organization_id, venture_id, redirect_uri, requested_by, expires_at, consumed_at")
          .eq("state", parsed.data.state)
          .maybeSingle();
        if (stateErr || !stateRow) {
          return Response.json({ error: "oauth_state_failure", reason: "unknown_state" }, { status: 400 });
        }
        const state = stateRow as { id: string; organization_id: string; venture_id: string | null; redirect_uri: string; requested_by: string | null; expires_at: string; consumed_at: string | null };
        if (state.consumed_at) {
          return Response.json({ error: "oauth_state_failure", reason: "state_replay" }, { status: 400 });
        }
        if (new Date(state.expires_at).getTime() < Date.now()) {
          return Response.json({ error: "oauth_state_failure", reason: "state_expired" }, { status: 400 });
        }

        // 2) Mark state consumed BEFORE exchanging code (replay protection).
        await supabaseAdmin
          .from("meta_oauth_states")
          .update({ consumed_at: new Date().toISOString() } as never)
          .eq("id", state.id);

        // 3) Exchange code -> short -> long-lived user token.
        let userToken: string;
        try {
          const short = await exchangeCodeForShortToken(parsed.data.code, state.redirect_uri);
          const long = await exchangeForLongLivedToken(short.accessToken);
          userToken = long.accessToken;
        } catch (err) {
          return Response.json({ error: "code_exchange_failed", detail: (err as Error).message }, { status: 502 });
        }

        // 4) Discover Facebook Pages + their linked Instagram accounts.
        //    Uses direct Graph fetch (no adapter needed for discovery).
        const pagesRes = await fetch(
          `https://graph.facebook.com/${cfg.graphVersion}/me/accounts?fields=id,name,username,access_token,tasks,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`,
        );
        if (!pagesRes.ok) {
          return Response.json({ error: "destination_discovery_failed", status: pagesRes.status }, { status: 502 });
        }
        const pagesBody = (await pagesRes.json()) as { data?: Array<{ id: string; name: string; username?: string; access_token: string; tasks?: string[]; instagram_business_account?: { id: string; username?: string } }> };

        // 5) Fetch granted permissions for the user token.
        const permsRes = await fetch(
          `https://graph.facebook.com/${cfg.graphVersion}/me/permissions?access_token=${encodeURIComponent(userToken)}`,
        );
        const permsBody = permsRes.ok ? ((await permsRes.json()) as { data?: Array<{ permission: string; status: string }> }) : { data: [] };
        const granted = (permsBody.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission);

        // 6) Persist destinations + encrypted page tokens.
        for (const page of pagesBody.data ?? []) {
          const canPublish = (page.tasks ?? []).includes("CREATE_CONTENT");
          const canInsights = (page.tasks ?? []).includes("ANALYZE");
          const { data: destRow } = await supabaseAdmin
            .from("meta_destinations")
            .upsert({
              organization_id: state.organization_id,
              venture_id: state.venture_id!,
              kind: "facebook_page",
              external_id: page.id,
              display_name: page.name,
              username: page.username ?? null,
              connected_ig_id: page.instagram_business_account?.id ?? null,
              granted_permissions: granted,
              page_tasks: page.tasks ?? [],
              publish_available: canPublish,
              insights_available: canInsights,
              last_capability_check: new Date().toISOString(),
              last_capability_reason: canPublish ? "ok" : "missing_CREATE_CONTENT_task",
            } as never, { onConflict: "organization_id,kind,external_id" })
            .select("id")
            .maybeSingle();
          const destId = (destRow as { id: string } | null)?.id;
          if (destId) {
            await supabaseAdmin.from("meta_page_tokens").upsert({
              organization_id: state.organization_id,
              destination_id: destId,
              encrypted_token: encryptPageToken(page.access_token),
              encryption_scheme: "aes-256-gcm-v1",
              scopes: granted,
              obtained_at: new Date().toISOString(),
            } as never, { onConflict: "destination_id" });
          }
          if (page.instagram_business_account) {
            await supabaseAdmin.from("meta_destinations").upsert({
              organization_id: state.organization_id,
              venture_id: state.venture_id!,
              kind: "instagram_business",
              external_id: page.instagram_business_account.id,
              display_name: page.instagram_business_account.username ?? page.name,
              username: page.instagram_business_account.username ?? null,
              connected_fb_page_id: page.id,
              granted_permissions: granted,
              publish_available: granted.includes("instagram_content_publish"),
              insights_available: granted.includes("instagram_manage_insights"),
              last_capability_check: new Date().toISOString(),
              last_capability_reason: granted.includes("instagram_content_publish") ? "ok" : "missing_instagram_content_publish",
            } as never, { onConflict: "organization_id,kind,external_id" });
          }
        }

        // 7) Redirect back to the app. Use the redirect_uri origin.
        const returnTo = new URL(state.redirect_uri);
        returnTo.searchParams.set("meta_connected", "1");
        return Response.redirect(returnTo.toString(), 302);
      },
    },
  },
});
