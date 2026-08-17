import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult } from "../result";

export default defineTool({
  name: "list_assessment_requests",
  title: "List assessment requests",
  description: "List inbound assessment requests from the public NorthStar Labs website, newest first.",
  inputSchema: {
    status: z.string().trim().min(1).optional().describe("Optional status filter, e.g. new, reviewed, converted."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of requests to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("nsl_assessment_requests")
      .select("id, created_at, status, full_name, company, email, phone, website, industry, business_size, biggest_challenge, referral_source, operator_notes, reviewed_at, converted_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, requests: data ?? [] });
  },
});
