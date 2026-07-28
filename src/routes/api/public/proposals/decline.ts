import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  token: z.string().min(8).max(128),
  reason: z.string().trim().max(1000).optional(),
});

export const Route = createFileRoute("/api/public/proposals/decline")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) return new Response("invalid_input", { status: 400 });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { loadByToken, clientIp } = await import("@/lib/proposals/public.server");
          const proposal = await loadByToken(supabaseAdmin, parsed.data.token);
          if (proposal.status === "accepted") return new Response("already_accepted", { status: 409 });
          if (proposal.status === "declined") return Response.json({ ok: true, idempotent: true });

          await supabaseAdmin.from("nsl_proposals").update({
            status: "declined",
            declined_at: new Date().toISOString(),
            public_token_hash: null,
          }).eq("id", proposal.id);
          await supabaseAdmin.from("nsl_proposal_activity").insert({
            organization_id: proposal.organization_id,
            proposal_id: proposal.id,
            action: "declined",
            actor_type: "client",
            notes: parsed.data.reason ?? null,
            metadata: { ip: clientIp(request), user_agent: request.headers.get("user-agent") } as never,
          });
          await supabaseAdmin.from("activity_events").insert({
            organization_id: proposal.organization_id,
            action: "proposal.declined",
            entity_type: "nsl_proposal",
            entity_id: proposal.id,
            summary: parsed.data.reason ?? null,
          });
          return Response.json({ ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "error";
          const status = ["not_found", "expired", "not_available"].includes(msg) ? 404 : 500;
          return new Response(msg, { status });
        }
      },
    },
  },
});