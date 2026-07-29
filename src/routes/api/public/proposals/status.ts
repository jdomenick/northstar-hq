import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({ token: z.string().min(8).max(128) });

/**
 * Read-only status endpoint for the client surface. No side effects, so it is
 * safe to poll from the payment-return page. Billing is resolved server-side
 * from the token-verified proposal only.
 */
export const Route = createFileRoute("/api/public/proposals/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) return new Response("unavailable", { status: 400 });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { loadByToken, buildPublicPayload } = await import("@/lib/proposals/public.server");
          const proposal = await loadByToken(supabaseAdmin, parsed.data.token);
          return Response.json(await buildPublicPayload(supabaseAdmin, proposal.id));
        } catch (e) {
          console.error("[proposals/status]", e);
          return new Response("unavailable", { status: 404 });
        }
      },
    },
  },
});