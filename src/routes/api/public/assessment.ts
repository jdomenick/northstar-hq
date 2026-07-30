import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { assessmentRequestSchema } from "@/lib/marketing/assessment";

/** Submissions allowed per hashed IP per rolling hour. */
const HOURLY_LIMIT = 5;

function hashIp(ip: string | null, salt: string) {
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 64);
}

/**
 * Public Assessment request intake. Unauthenticated by design: this is the
 * marketing site's only write path. Input is validated, a honeypot rejects
 * naive bots, and submissions are throttled per hashed IP. No data is ever
 * returned to the caller beyond an acknowledgement.
 */
export const Route = createFileRoute("/api/public/assessment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = assessmentRequestSchema.safeParse(
          await request.json().catch(() => null),
        );
        if (!parsed.success) {
          return Response.json(
            { ok: false, code: "invalid_input", message: "Please check the highlighted fields." },
            { status: 400 },
          );
        }
        const data = parsed.data;
        if (data.company_website_confirm) {
          // Honeypot filled. Acknowledge without storing anything.
          return Response.json({ ok: true });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "nsl-assessment";
          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            null;
          const ipHash = hashIp(ip, salt);

          if (ipHash) {
            const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { count } = await supabaseAdmin
              .from("nsl_assessment_requests")
              .select("id", { count: "exact", head: true })
              .eq("source_ip_hash", ipHash)
              .gte("created_at", since);
            if ((count ?? 0) >= HOURLY_LIMIT) {
              return Response.json(
                {
                  ok: false,
                  code: "rate_limited",
                  message: "Too many requests from this network. Please try again later.",
                },
                { status: 429 },
              );
            }
          }

          const { error } = await supabaseAdmin.from("nsl_assessment_requests").insert({
            full_name: data.fullName,
            company: data.company,
            email: data.email.toLowerCase(),
            phone: data.phone ?? null,
            website: data.website ?? null,
            industry: data.industry ?? null,
            business_size: data.businessSize ?? null,
            biggest_challenge: data.biggestChallenge,
            referral_source: data.referralSource ?? null,
            consent: true,
            source_ip_hash: ipHash,
            user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
          });
          if (error) throw error;

          return Response.json({ ok: true });
        } catch (e) {
          console.error("[api/public/assessment] submission failed", e);
          return Response.json(
            {
              ok: false,
              code: "internal_error",
              message: "We could not record your request. Please email us directly.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});