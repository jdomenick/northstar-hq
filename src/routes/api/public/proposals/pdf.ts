import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/proposals/pdf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const token = url.searchParams.get("token") ?? "";
          if (!token || token.length < 8 || token.length > 128) return new Response("invalid_token", { status: 400 });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { loadByToken, buildPublicPayload, clientIp } = await import("@/lib/proposals/public.server");
          const { renderProposalPdf } = await import("@/lib/proposals/pdf.server");
          const proposal = await loadByToken(supabaseAdmin, token);
          const payload = await buildPublicPayload(supabaseAdmin, proposal.id);
          const bytes = await renderProposalPdf(payload);

          await supabaseAdmin.from("nsl_proposal_activity").insert({
            organization_id: proposal.organization_id,
            proposal_id: proposal.id,
            action: "downloaded",
            actor_type: "client",
            metadata: { ip: clientIp(request), user_agent: request.headers.get("user-agent") } as never,
          });

          return new Response(bytes, {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "content-disposition": `inline; filename="${payload.proposal_number}.pdf"`,
              "cache-control": "no-store",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "error";
          const status = ["not_found", "expired", "not_available", "invalid_token"].includes(msg) ? 404 : 500;
          return new Response(msg, { status });
        }
      },
    },
  },
});