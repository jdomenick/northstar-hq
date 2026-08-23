// Aggregated connection status across every current and planned publishing
// destination in Content Operations. Server-only. Never leaks credentials.
//
// This is the single source of truth behind the Connections panel on
// /sam/content. Each destination reports one of:
//   - configured: keys present and reachable
//   - blocked: adapter exists but credentials/permissions missing
//   - not_implemented: adapter framework not yet built
// Consumers render the returned shape verbatim; no client-side inference.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";

export type ConnectionStatusTone =
  | "configured"
  | "blocked"
  | "not_implemented";

// What the operator can actually do from the card right now.
//   none            - nothing actionable (managed elsewhere / not built)
//   setup_required  - app credentials missing; an operator cannot fix in-app
//   connect         - adapter ready, no account connected
//   reconnect       - account connected but token/permissions need re-auth
//   connected       - live; disconnect is the only action
export type ConnectionAction =
  | "none"
  | "setup_required"
  | "connect"
  | "reconnect"
  | "connected";

export interface ContentOpsConnectionStatus {
  key: string;                       // stable identifier (beehiiv, facebook, ...)
  label: string;                     // display name
  category: "newsletter" | "social";
  tone: ConnectionStatusTone;
  action: ConnectionAction;
  headline: string;                  // one-line human status
  detail: string;                    // supporting sentence
  identity: string | null;           // e.g. publication name, page name
  armed: boolean | null;             // publishing armed? null when N/A
  grantedCapabilities: string[];
  missingCapabilities: string[];
  adapterVersion: string | null;
}


const Input = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid(),
  expectedPublicationName: z.string().max(200).optional(),
});

export const listContentOpsConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<ContentOpsConnectionStatus[]> => {
    await requireMembership(
      context.supabase,
      context.userId,
      data.organizationId,
      data.ventureId,
      "executive",
    );

    const results: ContentOpsConnectionStatus[] = [];

    // ---- Beehiiv --------------------------------------------------------
    try {
      const { validateBeehiivCredentials } = await import(
        "@/lib/social/providers/beehiiv"
      );
      const b = await validateBeehiivCredentials();
      const identityMatches = data.expectedPublicationName && b.publicationName
        ? b.publicationName
            .toLowerCase()
            .includes(data.expectedPublicationName.toLowerCase())
        : null;
      results.push({
        key: "beehiiv",
        label: "Beehiiv",
        category: "newsletter",
        tone: !b.configured
          ? "blocked"
          : !b.reachable
            ? "blocked"
            : "configured",
        headline: !b.configured
          ? "Credentials not configured"
          : !b.reachable
            ? "Credentials configured but not responding"
            : "Credentials configured and reachable",
        action: b.configured && b.reachable ? "connected" : "setup_required",
        detail: identityMatches === false
          ? `Publication does not match expected "${data.expectedPublicationName}".`
          : b.message,
        identity: b.publicationName,
        armed: b.configured ? b.armed : null,
        grantedCapabilities: b.grantedCapabilities,
        missingCapabilities: b.missingCapabilities,
        adapterVersion: "0.2.0-6a",
      });
    } catch (err) {
      results.push({
        key: "beehiiv",
        label: "Beehiiv",
        category: "newsletter",
        tone: "blocked",
        action: "setup_required",
        headline: "Could not check Beehiiv",
        detail: (err as Error).message,
        identity: null,
        armed: null,
        grantedCapabilities: [],
        missingCapabilities: [],
        adapterVersion: null,
      });
    }

    // ---- Meta (Facebook Page + Instagram Business) ---------------------
    const { readMetaConfigStatus } = await import(
      "@/lib/social/providers/meta/config.server"
    );
    const meta = readMetaConfigStatus();
    const metaBlocked = !meta.configured;
    const metaDetail = metaBlocked
      ? `Meta app credentials missing: ${meta.missing.join(", ")}.`
      : "Meta app configured. No account connected yet - complete OAuth in Integrations.";
    for (const key of ["facebook", "instagram"] as const) {
      results.push({
        key,
        label: key === "facebook" ? "Facebook Page" : "Instagram Business",
        category: "social",
        tone: "blocked",
        action: metaBlocked ? "setup_required" : "none",
        headline: metaBlocked
          ? "Meta credentials not configured"
          : "Awaiting account connection",
        detail: metaDetail,
        identity: null,
        armed: false,
        grantedCapabilities: [],
        missingCapabilities: metaBlocked ? meta.missing : ["oauth_connection"],
        adapterVersion: key === "facebook"
          ? "facebook.v0.1.0-framework"
          : "instagram.v0.1.0-framework",
      });
    }

    // ---- LinkedIn (workspace connector, no per-operator OAuth) ---------
    try {
      const { validateLinkedInCredentials } = await import(
        "@/lib/social/providers/linkedin"
      );
      const li = await validateLinkedInCredentials();
      results.push({
        key: "linkedin",
        label: "LinkedIn",
        category: "social",
        tone: li.configured && li.reachable ? "configured" : "blocked",
        action: li.configured && li.reachable ? "connected" : "setup_required",
        headline: !li.configured
          ? "Connector not configured"
          : !li.reachable
            ? "Connector configured but not responding"
            : "Connected",
        detail: li.message,
        identity: li.displayName ?? li.memberId,
        armed: li.configured ? li.armed : null,
        grantedCapabilities: li.grantedCapabilities,
        missingCapabilities: li.missingCapabilities,
        adapterVersion: "linkedin.v0.1.0",
      });
    } catch (err) {
      results.push({
        key: "linkedin",
        label: "LinkedIn",
        category: "social",
        tone: "blocked",
        action: "setup_required",
        headline: "Could not check LinkedIn",
        detail: (err as Error).message,
        identity: null,
        armed: null,
        grantedCapabilities: [],
        missingCapabilities: [],
        adapterVersion: "linkedin.v0.1.0",
      });
    }

    // ---- X (per-venture OAuth 2.0 user context with PKCE) --------------
    try {
      const { validateXConnection } = await import("@/lib/social/providers/x");
      const x = await validateXConnection(data.organizationId, data.ventureId);
      results.push({
        key: "x",
        label: "X",
        category: "social",
        tone: x.connected && x.reachable ? "configured" : "blocked",
        action: !x.configured
          ? "setup_required"
          : !x.connected
            ? "connect"
            : !x.reachable
              ? "reconnect"
              : "connected",
        headline: !x.configured
          ? "Setup required"
          : !x.connected
            ? "No account connected"
            : !x.reachable
              ? "Reconnect required"
              : `Connected${x.username ? ` as @${x.username}` : ""}`,
        detail: x.message,
        identity: x.username ? `@${x.username}` : x.displayName,
        armed: x.configured ? x.armed : null,
        grantedCapabilities: x.grantedCapabilities,
        missingCapabilities: x.missingCapabilities,
        adapterVersion: "x.v0.1.0",
      });
    } catch (err) {
      results.push({
        key: "x",
        label: "X",
        category: "social",
        tone: "blocked",
        action: "setup_required",
        headline: "Could not check X",
        detail: (err as Error).message,
        identity: null,
        armed: null,
        grantedCapabilities: [],
        missingCapabilities: [],
        adapterVersion: "x.v0.1.0",
      });
    }

    // ---- Reddit (not built) --------------------------------------------
    results.push({
      key: "reddit",
      label: "Reddit",
      category: "social",
      tone: "not_implemented",
      action: "none",
      headline: "Adapter not yet built",
      detail:
        "Reddit publishing is on the roadmap. No credentials collected, no publish path armed.",
      identity: null,
      armed: null,
      grantedCapabilities: [],
      missingCapabilities: [],
      adapterVersion: null,
    });


    return results;
  });
