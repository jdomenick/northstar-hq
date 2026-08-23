// X OAuth authorize. Returns 503 x_not_configured until app secrets exist.
// When configured, generates state + PKCE verifier, persists to
// social_oauth_states, and returns the authorization URL.
//
// The caller must present an authenticated Supabase bearer AND be an active
// member of the organization being connected. Identity alone is not
// authorization.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readXConfigStatus } from "@/lib/social/providers/x/config.server";
import {
  buildAuthorizeUrl,
  generateOAuthState,
  getRequiredScopes,
} from "@/lib/social/providers/x/oauth.server";

const QuerySchema = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid(),
  returnTo: z.string().url(),
});

export const Route = createFileRoute("/api/public/oauth/x/authorize")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = QuerySchema.safeParse({
          organizationId: url.searchParams.get("organizationId"),
          ventureId: url.searchParams.get("ventureId"),
          returnTo: url.searchParams.get("returnTo"),
        });
        if (!parsed.success) {
          return Response.json({ error: "invalid_input" }, { status: 400 });
        }

        const authz = request.headers.get("authorization");
        if (!authz?.startsWith("Bearer ")) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: authz } }, auth: { persistSession: false } },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const cfg = readXConfigStatus();
        if (!cfg.configured) {
          return Response.json({ error: "x_not_configured", missing: cfg.missing }, { status: 503 });
        }

        // returnTo must be same-origin with this request; otherwise the
        // post-connect redirect becomes an open redirect.
        const origin = new URL(request.url).origin;
        if (new URL(parsed.data.returnTo).origin !== origin) {
          return Response.json({ error: "redirect_not_allowed" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: membership } = await supabaseAdmin
          .from("organization_members")
          .select("id, role")
          .eq("organization_id", parsed.data.organizationId)
          .eq("user_id", userData.user.id)
          .eq("status", "active")
          .maybeSingle();
        const role = (membership as { role?: string } | null)?.role;
        if (!membership || !role || !["executive", "admin", "owner"].includes(role)) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }
        const { data: venture } = await supabaseAdmin
          .from("ventures")
          .select("id, organization_id")
          .eq("id", parsed.data.ventureId)
          .maybeSingle();
        if (!venture || (venture as { organization_id: string }).organization_id !== parsed.data.organizationId) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const { state, codeVerifier } = generateOAuthState();
        const scopes = getRequiredScopes();
        const { error: insertErr } = await supabaseAdmin.from("social_oauth_states").insert({
          organization_id: parsed.data.organizationId,
          venture_id: parsed.data.ventureId,
          platform: "x",
          state,
          code_verifier: codeVerifier,
          redirect_uri: parsed.data.returnTo,
          requested_scopes: scopes,
          requested_by: userData.user.id,
          purpose: "connect",
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        } as never);
        if (insertErr) {
          return Response.json({ error: "state_persist_failed" }, { status: 500 });
        }

        const authorizeUrl = await buildAuthorizeUrl({
          state,
          codeVerifier,
          redirectUri: cfg.redirectUri!,
          scopes,
        });
        return Response.json({ authorizeUrl, state, expiresInSeconds: 600 });
      },
    },
  },
});
