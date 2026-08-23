// Reddit OAuth callback. Validates state (single-use, unexpired), exchanges
// the code, reads the authorized identity, persists encrypted tokens, and
// redirects back into the app. Mirrors the X callback contract.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readRedditConfigStatus, REDDIT_USER_AGENT } from "@/lib/social/providers/reddit/config.server";
import { exchangeCodeForTokens } from "@/lib/social/providers/reddit/oauth.server";

const QuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

type StateRow = {
  id: string;
  organization_id: string;
  venture_id: string | null;
  redirect_uri: string;
  requested_by: string | null;
  expires_at: string;
  consumed_at: string | null;
};

// `returnPath` is always a same-origin relative path (enforced when the state
// row was created), so this can never become an open redirect.
function backTo(returnPath: string, base: string, params: Record<string, string>): Response {
  const url = new URL(returnPath.startsWith("/") ? returnPath : "/", base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return Response.redirect(url.toString(), 302);
}

export const Route = createFileRoute("/api/public/oauth/reddit/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const denied = url.searchParams.get("error");
        const parsed = QuerySchema.safeParse({
          code: url.searchParams.get("code"),
          state: url.searchParams.get("state"),
        });
        if (!parsed.success) {
          return Response.json(
            { error: denied ? "authorization_denied" : "invalid_callback" },
            { status: 400 },
          );
        }
        const cfg = readRedditConfigStatus();
        if (!cfg.configured) {
          return Response.json(
            { error: "reddit_not_configured", missing: cfg.missing },
            { status: 503 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: raw } = await supabaseAdmin
          .from("social_oauth_states")
          .select(
            "id, organization_id, venture_id, redirect_uri, requested_by, expires_at, consumed_at",
          )
          .eq("state", parsed.data.state)
          .eq("platform", "reddit")
          .maybeSingle();
        const state = raw as StateRow | null;
        if (!state) {
          return Response.json(
            { error: "oauth_state_failure", reason: "unknown_state" },
            { status: 400 },
          );
        }
        if (state.consumed_at) {
          return Response.json(
            { error: "oauth_state_failure", reason: "state_replay" },
            { status: 400 },
          );
        }
        if (new Date(state.expires_at).getTime() < Date.now()) {
          return Response.json(
            { error: "oauth_state_failure", reason: "state_expired" },
            { status: 400 },
          );
        }
        if (!state.venture_id) {
          return Response.json(
            { error: "oauth_state_failure", reason: "missing_venture" },
            { status: 400 },
          );
        }

        // Consume BEFORE exchanging the code (replay protection).
        await supabaseAdmin
          .from("social_oauth_states")
          .update({ consumed_at: new Date().toISOString() } as never)
          .eq("id", state.id);

        let tokens;
        try {
          tokens = await exchangeCodeForTokens({
            code: parsed.data.code,
            redirectUri: cfg.redirectUri!,
          });
        } catch (err) {
          return backTo(state.redirect_uri, request.url, {
            reddit_connect: "failed",
            reason: (err as Error).message,
          });
        }

        // Read the authorized identity so the UI can show a real handle.
        let accountId: string | null = null;
        let username: string | null = null;
        try {
          const meRes = await fetch("https://oauth.reddit.com/api/v1/me", {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
              "User-Agent": REDDIT_USER_AGENT,
              Accept: "application/json",
            },
          });
          if (meRes.ok) {
            const body = (await meRes.json()) as { id?: string; name?: string };
            accountId = body.id ?? null;
            username = body.name ?? null;
          }
        } catch {
          // identity read is best-effort; the connection is still valid
        }

        const { upsertRedditConnection } = await import(
          "@/lib/social/providers/reddit/tokens.server"
        );
        await upsertRedditConnection({
          organizationId: state.organization_id,
          ventureId: state.venture_id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          grantedScopes: tokens.grantedScopes,
          externalAccountId: accountId,
          externalUsername: username,
          externalDisplayName: username ? `u/${username}` : null,
          connectedBy: state.requested_by,
        });

        return backTo(state.redirect_uri, request.url, { reddit_connect: "connected" });
      },
    },
  },
});
