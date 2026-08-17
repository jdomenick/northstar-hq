import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult } from "../result";

export default defineTool({
  name: "update_assessment_request",
  title: "Update assessment request",
  description: "Update the review status and operator notes on an inbound assessment request.",
  inputSchema: {
    id: z.string().uuid().describe("The assessment request id."),
    status: z.enum(["new", "reviewing", "qualified", "disqualified"]).optional().describe("New review status."),
    operator_notes: z.string().trim().max(4000).optional().describe("Internal operator notes to store on the request."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, status, operator_notes }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    if (!status && operator_notes === undefined) return errorResult("Provide status or operator_notes to update.");
    const supabase = supabaseForUser(ctx);
    const patch: Record<string, string> = { reviewed_at: new Date().toISOString() };
    if (status) patch['status'] = status;
    if (operator_notes !== undefined) patch['operator_notes'] = operator_notes;
    const userId = ctx.getUserId();
    if (userId) patch['reviewed_by'] = userId;
    const { data, error } = await supabase
      .from("nsl_assessment_requests")
      .update(patch)
      .eq("id", id)
      .select("id, status, operator_notes, reviewed_at")
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("Assessment request not found or not accessible.");
    return jsonResult({ updated: data });
  },
});
