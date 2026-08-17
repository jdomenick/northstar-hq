import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult } from "../result";

export default defineTool({
  name: "list_projects",
  title: "List delivery projects",
  description: "List client delivery projects visible to the signed-in user, newest first.",
  inputSchema: {
    status: z.string().trim().min(1).optional().describe("Optional project status filter, e.g. planned, active, completed."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of projects to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("projects")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, projects: data ?? [] });
  },
});
