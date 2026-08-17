// Meta OAuth authorize (Phase C). Returns 503 meta_not_configured until
// secrets exist. When configured, generates state + persists to
// meta_oauth_states, then redirects to Facebook's dialog/oauth.
//
// Callers pass ?organizationId=&ventureId=&redirectUri= as query params.
// The request itself must originate from an authenticated session; we
// verify via the Supabase bearer attached by the client.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readMetaConfigStatus } from "@/lib/social/providers/meta/config.server";
import { buildAuthorizeUrl, generateOAuthState, getRequiredScopes } from "@/lib/social/providers/meta/oauth.server";
import { SITE_URL } from "@/lib/marketing/site-url";

const QuerySchema = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid().optional(),
  redirectUri: z.string().url(),
});

export const Route = createFileRoute("/api/public/oauth/meta/authorize")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = QuerySchema.safeParse({
          organizationId: url.searchParams.get("organizationId"),
          ventureId: url.searchParams.get("ventureId") ?? undefined,
          redirectUri: url.searchParams.get("redirectUri"),
        });
        if (!parsed.success) {
          return Response.json({ error: "invalid_input", detail: parsed.error.flatten() }, { status: 400 });
        }
        const cfg = readMetaConfigStatus();
        if (!cfg.configured) {
          return Response.json(
            { error: "meta_not_configured", missing: cfg.missing },
            { status: 503 },
          );
        }
        // Verify caller with the current bearer token before persisting state.
        const authz = request.headers.get("authorization");
        if (!authz?.startsWith("Bearer ")) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          global: { headers: { Authorization: authz } },
          auth: { persistSession: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        // The redirect target must be same-origin with this request or the
        // canonical site. Otherwise the callback becomes an open redirect and
        // the OAuth code round-trips through an attacker host.
        const allowedOrigins = new Set([new URL(request.url).origin, SITE_URL]);
        if (!allowedOrigins.has(new URL(parsed.data.redirectUri).origin)) {
          return Response.json({ error: "redirect_not_allowed" }, { status: 400 });
        }

        const { state, codeVerifier } = generateOAuthState();
        const scopes = getRequiredScopes();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // The caller must be an active member of the organization they are
        // connecting. Identity alone is not authorization.
        const { data: membership } = await supabaseAdmin
          .from("organization_members")
          .select("id")
          .eq("organization_id", parsed.data.organizationId)
          .eq("user_id", userData.user.id)
          .eq("status", "active")
          .maybeSingle();
        if (!membership) {
          return Response.json({ error: "forbidden" }, { status: 403 });
        }

        const { error: insertErr } = await supabaseAdmin.from("meta_oauth_states").insert({
          organization_id: parsed.data.organizationId,
          venture_id: parsed.data.ventureId ?? null,
          state,
          code_verifier: codeVerifier,
          redirect_uri: parsed.data.redirectUri,
          requested_scopes: scopes,
          requested_by: userData.user.id,
          purpose: "connect",
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        } as never);
        if (insertErr) {
          return Response.json({ error: "state_persist_failed" }, { status: 500 });
        }
        const authorizeUrl = buildAuthorizeUrl({
          organizationId: parsed.data.organizationId,
          redirectUri: parsed.data.redirectUri,
          scopes,
          state,
        });
        return Response.json({ authorizeUrl, state, expiresInSeconds: 600 });
      },
    },
  },
});
