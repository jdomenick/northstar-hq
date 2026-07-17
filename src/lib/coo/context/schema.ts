// Zod schemas and shared types for the COO operating-context tables.
// See docs/architecture/coo-core.md for the field-by-field meaning.

import { z } from "zod";
import { COO_LIMITS } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

// ---- Reusable field shapes ------------------------------------------------
const shortText = z.string().min(1).max(280);
const mediumText = z.string().min(1).max(2000);
const longText = z.string().min(1).max(8000);
const bulletList = (max: number) => z.array(shortText).max(max);
const jsonObject = z.record(z.string(), z.unknown());

// ---- Organization operating context --------------------------------------
export const OrgOperatingContextInput = z.object({
  organizationId: z.string().uuid(),
  company_summary: longText.nullable().optional(),
  mission: mediumText.nullable().optional(),
  current_stage: shortText.nullable().optional(),
  business_model: mediumText.nullable().optional(),
  primary_customers: mediumText.nullable().optional(),
  strategic_priorities: bulletList(COO_LIMITS.maxPriorities).optional(),
  current_constraints: bulletList(COO_LIMITS.maxPriorities).optional(),
  operating_principles: bulletList(COO_LIMITS.maxPriorities).optional(),
  founder_preferences: jsonObject.optional(),
  decision_preferences: jsonObject.optional(),
  risk_tolerance: shortText.nullable().optional(),
  time_horizon: shortText.nullable().optional(),
  current_focus: mediumText.nullable().optional(),
  major_goals: bulletList(COO_LIMITS.maxObjectives).optional(),
  major_risks: bulletList(COO_LIMITS.maxRisks).optional(),
  important_metrics: bulletList(COO_LIMITS.maxMetrics).optional(),
  active_ventures: z
    .array(z.object({ id: z.string().uuid(), name: shortText }))
    .max(50)
    .optional(),
  source_lineage: z
    .array(
      z.object({
        kind: z.enum(["decision", "commitment", "goal", "knowledge", "conversation", "manual"]),
        id: z.string().max(80),
        note: z.string().max(280).optional(),
      }),
    )
    .max(50)
    .optional(),
});
export type OrgOperatingContextInput = z.infer<typeof OrgOperatingContextInput>;

// ---- Venture operating context -------------------------------------------
export const VentureOperatingContextInput = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid(),
  venture_summary: longText.nullable().optional(),
  mission: mediumText.nullable().optional(),
  target_customer: mediumText.nullable().optional(),
  business_model: mediumText.nullable().optional(),
  current_stage: shortText.nullable().optional(),
  current_objectives: bulletList(COO_LIMITS.maxObjectives).optional(),
  roadmap_summary: longText.nullable().optional(),
  active_projects: bulletList(COO_LIMITS.maxPriorities).optional(),
  major_dependencies: bulletList(COO_LIMITS.maxPriorities).optional(),
  current_bottlenecks: bulletList(COO_LIMITS.maxPriorities).optional(),
  current_risks: bulletList(COO_LIMITS.maxRisks).optional(),
  success_metrics: bulletList(COO_LIMITS.maxMetrics).optional(),
  strategic_assumptions: bulletList(COO_LIMITS.maxPriorities).optional(),
  market_position: mediumText.nullable().optional(),
  offers: bulletList(COO_LIMITS.maxPriorities).optional(),
  products: bulletList(COO_LIMITS.maxPriorities).optional(),
  services: bulletList(COO_LIMITS.maxPriorities).optional(),
  current_priorities: bulletList(COO_LIMITS.maxPriorities).optional(),
  paused_priorities: bulletList(COO_LIMITS.maxPriorities).optional(),
  operating_notes: longText.nullable().optional(),
  source_lineage: z
    .array(
      z.object({
        kind: z.enum(["decision", "commitment", "goal", "knowledge", "conversation", "manual"]),
        id: z.string().max(80),
        note: z.string().max(280).optional(),
      }),
    )
    .max(50)
    .optional(),
});
export type VentureOperatingContextInput = z.infer<typeof VentureOperatingContextInput>;

export const ReviewContextInput = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid().optional(),
});
export type ReviewContextInput = z.infer<typeof ReviewContextInput>;

// ---- DB row types ---------------------------------------------------------
export type OrgOperatingContextRow =
  Database["public"]["Tables"]["organization_operating_context"]["Row"];
export type OrgOperatingContextHistoryRow =
  Database["public"]["Tables"]["organization_operating_context_history"]["Row"];
export type VentureOperatingContextRow =
  Database["public"]["Tables"]["venture_operating_context"]["Row"];
export type VentureOperatingContextHistoryRow =
  Database["public"]["Tables"]["venture_operating_context_history"]["Row"];