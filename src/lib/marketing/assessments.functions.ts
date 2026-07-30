// Operator-side access to public Assessment requests. RLS on
// nsl_assessment_requests restricts these rows to operator accounts, so the
// authenticated per-user client is the only client used here.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ASSESSMENT_STATUSES = [
  "new",
  "contacted",
  "scheduled",
  "qualified",
  "disqualified",
  "archived",
] as const;

export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

const SELECT =
  "id, created_at, updated_at, full_name, company, email, phone, website, industry, business_size, biggest_challenge, referral_source, status, operator_notes";

export const listAssessmentRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("nsl_assessment_requests")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ASSESSMENT_STATUSES).optional(),
  operatorNotes: z.string().trim().max(4000).optional(),
});

export const updateAssessmentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const patch: { status?: string; operator_notes?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (data.status) patch.status = data.status;
    if (data.operatorNotes !== undefined) patch.operator_notes = data.operatorNotes;

    const { data: row, error } = await context.supabase
      .from("nsl_assessment_requests")
      .update(patch)
      .eq("id", data.id)
      .select(SELECT)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Assessment request not found or not accessible.");
    return row;
  });