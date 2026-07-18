// Meta connector health server function. Reports truthful status:
//   - configured / missing env vars
//   - number of persisted destinations for the org
//   - which destinations are publish-ready vs blocked (with reasons)
// Never performs a live Graph call - reads DB + config only.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { readMetaConfigStatus, META_GRAPH_VERSION } from "./config.server";

const Input = z.object({ organizationId: z.string().uuid() });

export const getMetaConnectorHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }) => {
    const cfg = readMetaConfigStatus();
    const { data: dests, error } = await context.supabase
      .from("meta_destinations")
      .select("id, kind, external_id, display_name, username, publish_available, insights_available, last_capability_check, last_capability_reason")
      .eq("organization_id", data.organizationId);
    if (error) {
      return {
        configured: cfg.configured,
        missing: cfg.missing,
        graphVersion: META_GRAPH_VERSION,
        destinations: [] as unknown[],
        error: "destination_read_failed",
      };
    }
    return {
      configured: cfg.configured,
      missing: cfg.missing,
      graphVersion: META_GRAPH_VERSION,
      destinations: dests ?? [],
    };
  });
