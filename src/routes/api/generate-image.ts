import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prompt } = (await request.json()) as { prompt?: string };
        if (!prompt || !prompt.trim()) {
          return new Response("Missing prompt", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/images/generations",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-image-2",
              prompt,
              size: "1024x1024",
              quality: "low",
              n: 1,
            }),
          },
        );
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Image generation failed", {
            status: upstream.status,
          });
        }
        const j = (await upstream.json()) as {
          data?: Array<{ b64_json?: string }>;
        };
        const b64 = j?.data?.[0]?.b64_json;
        if (!b64) return new Response("No image returned", { status: 502 });
        return Response.json({ image: `data:image/png;base64,${b64}` });
      },
    },
  },
});