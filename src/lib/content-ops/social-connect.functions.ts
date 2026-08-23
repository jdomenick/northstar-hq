// Operator-driven connect / disconnect for Content Operations social
// destinations. Server-only. Never returns tokens or secrets.
//
// X and Reddit use this path. LinkedIn is provisioned through the
// workspace-level connector, so it has no per-operator OAuth flow.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";

const ConnectInput = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid(),
  // Same-origin relative path the operator returns to after authorizing.
  returnPath: z.string().max(300).regex(/^\/(?!\/)/, "returnPath must be a same-origin path"),
});

const DisconnectInput = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid(),
});

export interface BeginConnectResult {
  ok: boolean;
  authorizeUrl: string | null;
  reason: string | null;
  missing: string[];
}

export const beginXConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConnectInput.parse(input))
  .handler(async ({ data, context }): Promise<BeginConnectResult> => {
    await requireMembership(
      context.supabase,
      context.userId,
      data.organizationId,
      data.ventureId,
      "executive",
    );

    const { readXConfigStatus } = await import("@/lib/social/providers/x/config.server");
    const cfg = readXConfigStatus();
    if (!cfg.configured) {
      return {
        ok: false,
        authorizeUrl: null,
        reason: "x_not_configured",
        missing: cfg.missing,
      };
    }

    const { buildAuthorizeUrl, generateOAuthState, getRequiredScopes } = await import(
      "@/lib/social/providers/x/oauth.server"
    );
    const { state, codeVerifier } = generateOAuthState();
    const scopes = getRequiredScopes();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("social_oauth_states").insert({
      organization_id: data.organizationId,
      venture_id: data.ventureId,
      platform: "x",
      state,
      code_verifier: codeVerifier,
      redirect_uri: data.returnPath,
      requested_scopes: scopes,
      requested_by: context.userId,
      purpose: "connect",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    } as never);
    if (error) {
      return { ok: false, authorizeUrl: null, reason: "state_persist_failed", missing: [] };
    }

    const authorizeUrl = await buildAuthorizeUrl({
      state,
      codeVerifier,
      redirectUri: cfg.redirectUri!,
      scopes,
    });
    return { ok: true, authorizeUrl, reason: null, missing: [] };
  });

export const disconnectX = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DisconnectInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireMembership(
      context.supabase,
      context.userId,
      data.organizationId,
      data.ventureId,
      "executive",
    );
    const { revokeXConnection } = await import("@/lib/social/providers/x/tokens.server");
    await revokeXConnection(data.organizationId, data.ventureId);
    return { ok: true };
  });

export const beginRedditConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConnectInput.parse(input))
  .handler(async ({ data, context }): Promise<BeginConnectResult> => {
    await requireMembership(
      context.supabase,
      context.userId,
      data.organizationId,
      data.ventureId,
      "executive",
    );

    const { readRedditConfigStatus } = await import("@/lib/social/providers/reddit/config.server");
    const cfg = readRedditConfigStatus();
    if (!cfg.configured) {
      return {
        ok: false,
        authorizeUrl: null,
        reason: "reddit_not_configured",
        missing: cfg.missing,
      };
    }

    const { buildAuthorizeUrl, generateOAuthState, getRequiredScopes } = await import(
      "@/lib/social/providers/reddit/oauth.server"
    );
    const { state } = generateOAuthState();
    const scopes = getRequiredScopes();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("social_oauth_states").insert({
      organization_id: data.organizationId,
      venture_id: data.ventureId,
      platform: "reddit",
      state,
      // Reddit's OAuth does not support PKCE; the column is NOT NULL so we
      // store an explicit sentinel instead of a fake verifier.
      code_verifier: "not_applicable_reddit_no_pkce",
      redirect_uri: data.returnPath,
      requested_scopes: scopes,
      requested_by: context.userId,
      purpose: "connect",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    } as never);
    if (error) {
      return { ok: false, authorizeUrl: null, reason: "state_persist_failed", missing: [] };
    }

    const authorizeUrl = buildAuthorizeUrl({
      state,
      redirectUri: cfg.redirectUri!,
      scopes,
    });
    return { ok: true, authorizeUrl, reason: null, missing: [] };
  });

export const disconnectReddit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DisconnectInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireMembership(
      context.supabase,
      context.userId,
      data.organizationId,
      data.ventureId,
      "executive",
    );
    const { revokeRedditConnection } = await import(
      "@/lib/social/providers/reddit/tokens.server"
    );
    await revokeRedditConnection(data.organizationId, data.ventureId);
    return { ok: true };
  });
