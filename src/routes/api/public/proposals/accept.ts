import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  token: z.string().min(8).max(128),
  signer_name: z.string().trim().min(2).max(200),
  signer_email: z.string().trim().email().max(320),
  acknowledgement: z.string().trim().min(3).max(500),
});

export const Route = createFileRoute("/api/public/proposals/accept")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) return new Response("invalid_input", { status: 400 });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { hashToken } = await import("@/lib/proposals/token.server");
          const { clientIp, buildPublicPayload } = await import("@/lib/proposals/public.server");
          const ip = clientIp(request) ?? "";
          const ua = request.headers.get("user-agent") ?? "";

          const { data, error } = await supabaseAdmin.rpc("nsl_proposal_accept", {
            _token_hash: hashToken(parsed.data.token),
            _signer_name: parsed.data.signer_name,
            _signer_email: parsed.data.signer_email,
            _acknowledgement: parsed.data.acknowledgement,
            _ip: ip,
            _user_agent: ua,
          });
          if (error) {
            const msg = error.message ?? "accept_failed";
            const status = /not_found|expired|not_available|invalid/i.test(msg) ? 404 : 400;
            return new Response(msg, { status });
          }
          const row = Array.isArray(data) ? data[0] : data;
          if (!row?.proposal_id) return new Response("accept_failed", { status: 500 });
          const payload = await buildPublicPayload(supabaseAdmin, row.proposal_id);
          return Response.json({ ...payload, idempotent: row.idempotent });
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "error", { status: 500 });
        }
      },
    },
  },
});