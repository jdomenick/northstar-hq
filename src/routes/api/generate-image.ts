import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({ prompt: z.string().trim().min(1).max(2000) });

const DAILY_IMAGE_LIMIT = 50;

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Authenticate the caller from the bearer token.
        const authHeader = request.headers.get("authorization") ?? "";
        const bearer = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        if (!bearer) return new Response("Unauthorized", { status: 401 });

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${bearer}` } },
          },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (userErr || !userId) return new Response("Unauthorized", { status: 401 });

        // 2. Require active organization membership.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: membership } = await supabaseAdmin
          .from("organization_members")
          .select("organization_id, status")
          .eq("user_id", userId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (!membership) return new Response("Forbidden", { status: 403 });

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Missing prompt", { status: 400 });

        // 3. Reuse the existing daily counter table for rate limiting.
        const today = new Date().toISOString().slice(0, 10);
        const { data: counter } = await supabaseAdmin
          .from("sam_rate_counters")
          .select("count")
          .eq("organization_id", membership.organization_id)
          .eq("user_id", userId)
          .eq("day", today)
          .maybeSingle();
        if ((counter?.count ?? 0) >= DAILY_IMAGE_LIMIT) {
          return new Response("Daily image generation limit reached", { status: 429 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Image generation is not configured", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-image-2",
            prompt: parsed.data.prompt,
            size: "1024x1024",
            quality: "low",
            n: 1,
          }),
        });
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          console.error("[generate-image] upstream failure", upstream.status, text);
          return new Response("Image generation failed", { status: upstream.status });
        }
        const j = (await upstream.json()) as { data?: Array<{ b64_json?: string }> };
        const b64 = j?.data?.[0]?.b64_json;
        if (!b64) return new Response("No image returned", { status: 502 });

        await supabaseAdmin.from("sam_rate_counters").upsert(
          {
            organization_id: membership.organization_id,
            user_id: userId,
            day: today,
            count: (counter?.count ?? 0) + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,user_id,day" },
        );

        return Response.json({ image: `data:image/png;base64,${b64}` });
      },
    },
  },
});
