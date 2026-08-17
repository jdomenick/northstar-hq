import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult } from "../result";

interface InvoiceRow {
  status: string;
  amount_cents: number;
  amount_paid_cents: number;
  currency: string;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
  hosted_invoice_url: string | null;
}

export default defineTool({
  name: "billing_summary",
  title: "Billing summary",
  description: "Summarize recent invoices: totals billed, totals collected, and outstanding balance.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(50).describe("How many recent invoices to include in the summary."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("billing_invoices")
      .select("status, amount_cents, amount_paid_cents, currency, due_at, paid_at, created_at, hosted_invoice_url")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) return errorResult(error.message);
    const rows = (data ?? []) as InvoiceRow[];
    const billedCents = rows.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
    const collectedCents = rows.reduce((sum, row) => sum + (row.amount_paid_cents ?? 0), 0);
    return jsonResult({
      invoice_count: rows.length,
      billed_cents: billedCents,
      collected_cents: collectedCents,
      outstanding_cents: billedCents - collectedCents,
      invoices: rows,
    });
  },
});
