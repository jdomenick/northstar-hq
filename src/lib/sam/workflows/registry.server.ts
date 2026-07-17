// Workflow registry. All nine workflow keys are registered even though only
// the engine is implemented in Milestone 2  -  each points to the
// `not_implemented` analyzer placeholder and will fail honestly if invoked.

import { z } from "zod";
import {
  WORKFLOW_ENGINE_VERSION,
  WORKFLOW_OUTPUT_SCHEMA_VERSION,
  WORKFLOW_REGISTRY_VERSION,
} from "@/lib/constants";
import type {
  WorkflowDefinition,
  WorkflowRegistryEntry,
  WorkflowType,
} from "./types";
import { WorkflowProviderSynthesis } from "./types";

const DEFAULT_OUTPUT_SCHEMA = z
  .object({
    schemaVersion: z.literal(WORKFLOW_OUTPUT_SCHEMA_VERSION),
    synthesis: WorkflowProviderSynthesis.optional(),
  })
  .strict();

function make(def: Omit<WorkflowDefinition, "version" | "deterministicAnalyzer" | "outputSchema"> & {
  version?: string;
  outputSchema?: WorkflowDefinition["outputSchema"];
  deterministicAnalyzer?: WorkflowDefinition["deterministicAnalyzer"];
}): WorkflowDefinition {
  return {
    version: def.version ?? WORKFLOW_ENGINE_VERSION,
    deterministicAnalyzer: def.deterministicAnalyzer ?? "not_implemented",
    outputSchema: def.outputSchema ?? DEFAULT_OUTPUT_SCHEMA,
    ...def,
  };
}

const DEFS: Record<WorkflowType, WorkflowDefinition> = {
  daily_briefing: make({
    key: "daily_briefing",
    displayName: "Daily Briefing",
    description: "Today's priorities, overdue commitments, decisions waiting.",
    active: true,
    supportedScopes: ["organization"],
    ventureRequired: false,
    supportsDateRange: false,
    minRole: "member",
    maxContextRecords: 25,
    optionalProviderSynthesis: true,
    requireCitations: true,
    deterministicAnalyzer: "daily_briefing",
    version: "sam.workflow.daily_briefing.v1.0.0",
  }),
  weekly_review: make({
    key: "weekly_review",
    displayName: "Weekly Review",
    description: "What moved, what stalled, decisions closed/opened, next-week focus.",
    active: true,
    supportedScopes: ["organization", "venture"],
    ventureRequired: false,
    supportsDateRange: true,
    minRole: "member",
    maxContextRecords: 40,
    optionalProviderSynthesis: true,
    requireCitations: true,
    deterministicAnalyzer: "weekly_review",
    version: "sam.workflow.weekly_review.v1.0.0",
  }),
  decision_review: make({
    key: "decision_review",
    displayName: "Decision Review",
    description: "Restate objectives, summarize evidence, surface gaps for a decision.",
    active: true,
    supportedScopes: ["organization"],
    ventureRequired: false,
    supportsDateRange: false,
    minRole: "member",
    maxContextRecords: 20,
    optionalProviderSynthesis: true,
    requireCitations: true,
    deterministicAnalyzer: "decision_review",
    version: "sam.workflow.decision_review.v1.0.0",
  }),
  commitment_review: make({
    key: "commitment_review",
    displayName: "Commitment Review",
    description: "Overdue and repeatedly-postponed commitments with recommended actions.",
    active: true,
    supportedScopes: ["organization"],
    ventureRequired: false,
    supportsDateRange: false,
    minRole: "member",
    maxContextRecords: 25,
    optionalProviderSynthesis: false,
    requireCitations: true,
  }),
  priority_planning: make({
    key: "priority_planning",
    displayName: "Priority Planning",
    description: "Ranked priorities across projects, commitments, and decisions.",
    active: true,
    supportedScopes: ["organization", "venture"],
    ventureRequired: false,
    supportsDateRange: false,
    minRole: "member",
    maxContextRecords: 30,
    optionalProviderSynthesis: true,
    requireCitations: true,
  }),
  risk_review: make({
    key: "risk_review",
    displayName: "Risk Review",
    description: "Ranked risks with likelihood/impact and mitigation candidates.",
    active: true,
    supportedScopes: ["organization", "venture"],
    ventureRequired: false,
    supportsDateRange: true,
    minRole: "member",
    maxContextRecords: 30,
    optionalProviderSynthesis: true,
    requireCitations: true,
  }),
  goal_alignment: make({
    key: "goal_alignment",
    displayName: "Goal Alignment",
    description: "How projects, commitments, and decisions align (or not) with a goal.",
    active: true,
    supportedScopes: ["organization"],
    ventureRequired: false,
    supportsDateRange: false,
    minRole: "member",
    maxContextRecords: 20,
    optionalProviderSynthesis: true,
    requireCitations: true,
  }),
  venture_health: make({
    key: "venture_health",
    displayName: "Venture Health",
    description: "Health rating with velocity, decision throughput, risk load, freshness.",
    active: true,
    supportedScopes: ["venture"],
    ventureRequired: true,
    supportsDateRange: true,
    minRole: "member",
    maxContextRecords: 40,
    optionalProviderSynthesis: true,
    requireCitations: true,
  }),
  organization_health: make({
    key: "organization_health",
    displayName: "Organization Health",
    description: "Rollup across ventures, member load, decision hygiene, knowledge gaps.",
    active: true,
    supportedScopes: ["organization"],
    ventureRequired: false,
    supportsDateRange: true,
    minRole: "executive",
    maxContextRecords: 50,
    optionalProviderSynthesis: true,
    requireCitations: true,
  }),
};

export function getWorkflowDefinition(type: WorkflowType): WorkflowRegistryEntry | null {
  const def = DEFS[type];
  if (!def) return null;
  return { ...def, registryVersion: WORKFLOW_REGISTRY_VERSION };
}

export function listWorkflowDefinitions(): WorkflowRegistryEntry[] {
  return (Object.values(DEFS) as WorkflowDefinition[]).map((d) => ({
    ...d,
    registryVersion: WORKFLOW_REGISTRY_VERSION,
  }));
}

export const REGISTRY_VERSION = WORKFLOW_REGISTRY_VERSION;