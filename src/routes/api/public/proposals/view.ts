import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({ token: z.string().min(8).max(128) });

export const Route = createFileRoute("/api/public/proposals/view")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) return new Response("invalid_input", { status: 400 });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { loadByToken, buildPublicPayload, clientIp } = await import("@/lib/proposals/public.server");
          const proposal = await loadByToken(supabaseAdmin, parsed.data.token);

          const now = new Date().toISOString();
          const updates: Record<string, unknown> = {};
          if (!proposal.viewed_at) updates.viewed_at = now;
          if (proposal.status === "sent") updates.status = "viewed";
          if (Object.keys(updates).length > 0) {
            await supabaseAdmin.from("nsl_proposals").update(updates).eq("id", proposal.id);
            await supabaseAdmin.from("nsl_proposal_activity").insert({
              organization_id: proposal.organization_id,
              proposal_id: proposal.id,
              action: "viewed",
              actor_type: "client",
              metadata: { ip: clientIp(request), user_agent: request.headers.get("user-agent") } as never,
            });
            await supabaseAdmin.from("activity_events").insert({
              organization_id: proposal.organization_id,
              action: "proposal.viewed",
              entity_type: "nsl_proposal",
              entity_id: proposal.id,
            });
          }
          const payload = await buildPublicPayload(supabaseAdmin, proposal.id);
          return Response.json(payload);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "error";
          const status = ["not_found", "expired", "not_available", "invalid_token"].includes(msg) ? 404 : 500;
          return new Response(msg, { status });
        }
      },
    },
  },
});