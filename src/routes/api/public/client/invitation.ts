import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), token: z.string().min(20).max(200) }),
  z.object({
    action: z.literal("accept"),
    token: z.string().min(20).max(200),
    password: z.string().min(8).max(200),
  }),
]);

/**
 * Unauthenticated invitation surface. The raw token is the only credential and
 * is never logged. Responses are sanitized error codes, never database errors.
 */
export const Route = createFileRoute("/api/public/client/invitation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ ok: false, code: "invalid_input" }, { status: 400 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const inv = await import("@/lib/client-identity/invitations.server");
          if (parsed.data.action === "preview") {
            const preview = await inv.previewInvitation(supabaseAdmin, parsed.data.token);
            return Response.json({ ok: true, invitation: preview });
          }
          const result = await inv.acceptInvitation(
            supabaseAdmin,
            parsed.data.token,
            parsed.data.password,
          );
          return Response.json({ ok: true, email: result.email });
        } catch (e) {
          const { toClientIdentityCode } = await import("@/lib/client-identity/errors");
          const code = toClientIdentityCode(e);
          if (code === "internal_error") console.error("[client/invitation]", e);
          return Response.json({ ok: false, code }, { status: 400 });
        }
      },
    },
  },
});