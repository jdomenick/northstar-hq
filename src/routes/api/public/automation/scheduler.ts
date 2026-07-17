// Internal scheduler tick. Same secret protection as /tick. Finds due
// enabled automation definitions and enqueues jobs deterministically.

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function constantEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/public/automation/scheduler")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.AUTOMATION_SCHEDULER_SECRET;
        if (!secret) return new Response("scheduler_not_configured", { status: 503 });
        const header = request.headers.get("x-automation-secret") ?? "";
        if (!header || !constantEq(header, secret)) return new Response("unauthorized", { status: 401 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runSchedulerTick } = await import("@/lib/automation/scheduler.server");
          const res = await runSchedulerTick(supabaseAdmin);
          return Response.json({ ok: true, ...res });
        } catch {
          return new Response("internal_error", { status: 500 });
        }
      },
    },
  },
});
