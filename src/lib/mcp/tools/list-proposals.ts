import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult } from "../result";

export default defineTool({
  name: "list_proposals",
  title: "List proposals",
  description: "List NorthStar Labs client proposals visible to the signed-in operator, newest first.",
  inputSchema: {
    status: z.string().trim().min(1).optional().describe("Optional proposal status filter, e.g. draft, sent, accepted."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of proposals to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("nsl_proposals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, proposals: data ?? [] });
  },
});
