// Handler registry + timeout-bounded execution. Handlers are pure server
// modules; they receive only what they need and return a sanitized summary
// or throw an AutomationError.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AutomationError, type AutomationErrorCode } from "./errors";

type SB = SupabaseClient<Database>;

export interface HandlerContext {
  supabase: SB; // service_role client
  job: Database["public"]["Tables"]["automation_jobs"]["Row"];
  workerId: string;
}

export interface HandlerResult {
  outputSummary: Record<string, unknown>;
  signals?: Array<{ signalType: string; assetId?: string | null; title: string; description?: string; metadata?: Record<string, unknown>; significance?: "minor" | "moderate" | "major" }>;
  changedContentItemId?: string | null;
  significance?: "none" | "minor" | "moderate" | "major";
}

export type HandlerFn = (ctx: HandlerContext) => Promise<HandlerResult>;

const HANDLERS = new Map<string, HandlerFn>();

export function registerHandler(jobType: string, fn: HandlerFn): void {
  HANDLERS.set(jobType, fn);
}

export function getHandler(jobType: string): HandlerFn {
  const h = HANDLERS.get(jobType);
  if (!h) throw new AutomationError("job_not_implemented", `no handler for ${jobType}`);
  return h;
}

export async function runWithTimeout<T>(promise: Promise<T>, timeoutSeconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AutomationError("timeout" as AutomationErrorCode)), timeoutSeconds * 1000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Auto-register bundled handlers on import.
import "./jobs/website-sync.server";
// social_publish dispatcher: reads platform and hands off to beehiiv or meta.
import "@/lib/social/jobs/social-publish-dispatcher.server";
