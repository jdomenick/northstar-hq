import type { Database } from "@/integrations/supabase/types";

export type OperatorKind = Database["public"]["Enums"]["operator_kind"];
export type PipelineStage = Database["public"]["Enums"]["pipeline_stage"];

// Internal codenames stay `hunter` / `builder` in the database and code.
// The UI uses "Growth Operator" and "Delivery Operator" externally.
export const OPERATOR_LABELS: Record<OperatorKind, string> = {
  hunter: "Growth queue",
  builder: "Delivery queue",
};

export const OPERATOR_SUBTITLES: Record<OperatorKind, string> = {
  hunter: "Prospecting and sales",
  builder: "Onboarding and delivery",
};

export const OPERATOR_PURPOSE: Record<OperatorKind, string> = {
  hunter: "Tracks prospecting, outreach, and sales work from first contact through signed proposal.",
  builder: "Tracks onboarding, delivery, and launch work from signed proposal through case study and referral.",
};

// Full Revenue Machine lifecycle in canonical order.
// Legacy `lead / qualified / negotiation` are preserved for existing rows and
// mapped into the lifecycle at their nearest point.
export const LIFECYCLE_STAGES: PipelineStage[] = [
  "prospect",
  "researched",
  "contacted",
  "engaged",
  "discovery_scheduled",
  "discovery_held",
  "proposal_sent",
  "won",
  "project_kickoff",
  "in_delivery",
  "launched",
  "case_study",
  "referral",
  "lost",
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  prospect: "Prospect",
  researched: "Researched",
  contacted: "Contacted",
  engaged: "Engaged",
  discovery_scheduled: "Discovery scheduled",
  discovery_held: "Discovery held",
  proposal: "Proposal",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  won: "Won",
  project_kickoff: "Project kickoff",
  in_delivery: "In delivery",
  launched: "Launched",
  case_study: "Case study",
  referral: "Referral",
  lost: "Lost",
};

export const STAGE_OWNER: Record<PipelineStage, OperatorKind> = {
  lead: "hunter",
  qualified: "hunter",
  prospect: "hunter",
  researched: "hunter",
  contacted: "hunter",
  engaged: "hunter",
  discovery_scheduled: "hunter",
  discovery_held: "hunter",
  proposal: "hunter",
  proposal_sent: "hunter",
  negotiation: "hunter",
  won: "hunter",
  project_kickoff: "builder",
  in_delivery: "builder",
  launched: "builder",
  case_study: "builder",
  referral: "builder",
  lost: "hunter",
};

// Allowed forward transitions. `lost` is reachable from any pre-won hunter stage.
// A `referral` can seed a new prospect elsewhere; that is a separate insert, not a transition.
const HUNTER_LINE: PipelineStage[] = [
  "prospect", "researched", "contacted", "engaged",
  "discovery_scheduled", "discovery_held", "proposal_sent", "won",
];
const BUILDER_LINE: PipelineStage[] = [
  "won", "project_kickoff", "in_delivery", "launched", "case_study", "referral",
];

export function allowedNextStages(current: PipelineStage): PipelineStage[] {
  const next = new Set<PipelineStage>();
  const hIdx = HUNTER_LINE.indexOf(current);
  if (hIdx >= 0 && hIdx < HUNTER_LINE.length - 1) next.add(HUNTER_LINE[hIdx + 1]);
  const bIdx = BUILDER_LINE.indexOf(current);
  if (bIdx >= 0 && bIdx < BUILDER_LINE.length - 1) next.add(BUILDER_LINE[bIdx + 1]);
  // Legacy stages map into the modern line
  if (current === "lead" || current === "qualified") next.add("prospect");
  if (current === "proposal") next.add("proposal_sent");
  if (current === "negotiation") next.add("proposal_sent");
  // Any hunter stage before won can move to lost
  if (hIdx >= 0 && hIdx < HUNTER_LINE.length - 1) next.add("lost");
  return Array.from(next);
}

export function stageOwner(stage: PipelineStage): OperatorKind {
  return STAGE_OWNER[stage] ?? "hunter";
}