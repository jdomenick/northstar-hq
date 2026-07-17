// Internal worker + recovery tick endpoint. Protected by
// AUTOMATION_SCHEDULER_SECRET; NEVER callable by browser sessions or the
// anon key. Invoked by pg_cron / external scheduler.

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

function constantEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/public/automation/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.AUTOMATION_SCHEDULER_SECRET;
        if (!secret) return new Response("scheduler_not_configured", { status: 503 });
        const header = request.headers.get("x-automation-secret") ?? "";
        if (!header || !constantEq(header, secret)) return new Response("unauthorized", { status: 401 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runWorkerTick } = await import("@/lib/automation/worker.server");
          const { recoverStaleJobs } = await import("@/lib/automation/recovery.server");
          const recovered = await recoverStaleJobs(supabaseAdmin);
          const worker = await runWorkerTick(supabaseAdmin, { batchLimit: 5 });
          return Response.json({
            ok: true,
            recovered: recovered.recovered,
            processed: worker.processed,
            succeeded: worker.succeeded,
            failed: worker.failed,
            retrying: worker.retrying,
          });
        } catch {
          return new Response("internal_error", { status: 500 });
        }
      },
    },
  },
});
