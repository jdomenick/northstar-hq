// Bounded, organization-scoped context assembler for workflows.
// Uses the existing RLS-scoped Supabase client — no service role reads.
// Wraps provider-bound material as untrusted context. Never returns raw
// document contents; never returns another user's private memory.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  SAM_WORKFLOW_LIMITS,
  WORKFLOW_CONTEXT_VERSION,
  WORKFLOW_DEFAULT_SETTINGS,
} from "@/lib/constants";
import type { WorkflowContext, WorkflowType, WorkflowScope } from "./types";
import { traverse } from "@/lib/sam/graph/traversal.server";

type Client = SupabaseClient<Database>;

export interface AssembleOptions {
  orgId: string;
  userId: string;
  workflowType: WorkflowType;
  scope: WorkflowScope;
  ventureId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  entityId?: string | null;
  // Which categories the analyzer actually needs. Absent = include all.
  sources?: Partial<Record<
    "ventures" | "projects" | "tasks" | "goals" | "decisions" | "commitments"
      | "knowledge" | "documents" | "activity" | "memory" | "graph" | "historical",
    boolean
  >>;
}

const PER = SAM_WORKFLOW_LIMITS.maxContextPerType;

function needs(o: AssembleOptions, key: keyof NonNullable<AssembleOptions["sources"]>) {
  return o.sources ? o.sources[key] === true : true;
}

export async function assembleWorkflowContext(
  supabase: Client,
  options: AssembleOptions,
): Promise<WorkflowContext> {
  const truncations: string[] = [];
  const omittedCategories: string[] = [];
  const countsBeforeTruncation: Record<string, number> = {};
  const counts: Record<string, number> = {};

  const orgFilter = { organization_id: options.orgId };

  const settingsPromise = supabase
    .from("sam_settings")
    .select("*")
    .eq("organization_id", options.orgId)
    .maybeSingle();

  const venturesPromise = needs(options, "ventures")
    ? supabase
        .from("ventures")
        .select("id, name, status, updated_at", { count: "exact" })
        .match(orgFilter)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(PER)
    : Promise.resolve({ data: [], count: 0, error: null } as never);

  const projectsPromise = needs(options, "projects")
    ? (() => {
        let q = supabase
          .from("projects")
          .select("id, name, status, venture_id, goal_id, owner_user_id, priority, progress_percentage, deadline, updated_at, next_action, blocker_summary", { count: "exact" })
          .match(orgFilter)
          .is("deleted_at", null);
        if (options.ventureId) q = q.eq("venture_id", options.ventureId);
        return q.order("updated_at", { ascending: false }).limit(PER);
      })()
    : Promise.resolve({ data: [], count: 0, error: null } as never);

  const tasksPromise = needs(options, "tasks")
    ? supabase
        .from("tasks")
        .select("id, title, status, due_date, assigned_to, priority, project_id, updated_at, completed_at", { count: "exact" })
        .match(orgFilter)
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(PER)
    : Promise.resolve({ data: [], count: 0, error: null } as never);

  const goalsPromise = needs(options, "goals")
    ? supabase
        .from("goals")
        .select("id, title, status, target_date, start_date, current_value, target_value, owner_user_id, updated_at, venture_id", { count: "exact" })
        .match(orgFilter)
        .is("deleted_at", null)
        .order("target_date", { ascending: true, nullsFirst: false })
        .limit(PER)
    : Promise.resolve({ data: [], count: 0, error: null } as never);

  const decisionsPromise = needs(options, "decisions")
    ? supabase
        .from("decisions")
        .select("id, title, status, review_date, decision_date, owner_user_id, project_id, venture_id, updated_at", { count: "exact" })
        .match(orgFilter)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(PER)
    : Promise.resolve({ data: [], count: 0, error: null } as never);

  const commitmentsPromise = needs(options, "commitments")
    ? supabase
        .from("commitments")
        .select("id, title, status, due_date, owner_user_id, priority, postponement_count, completed_at, original_due_date, updated_at", { count: "exact" })
        .match(orgFilter)
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(PER)
    : Promise.resolve({ data: [], count: 0, error: null } as never);

  const knowledgePromise = needs(options, "knowledge")
    ? supabase
        .from("knowledge_records")
        .select("id, title, verification_status, updated_at", { count: "exact" })
        .match(orgFilter)
        .order("updated_at", { ascending: false })
        .limit(PER)
    : Promise.resolve({ data: [], count: 0, error: null } as never);

  const documentsPromise = needs(options, "documents")
    ? supabase
        .from("documents")
        .select("id, title, file_type, updated_at", { count: "exact" })
        .match(orgFilter)
        .order("updated_at", { ascending: false })
        .limit(PER)
    : Promise.resolve({ data: [], count: 0, error: null } as never);

  const activityPromise = needs(options, "activity")
    ? (() => {
        let q = supabase
          .from("activity_events")
          .select("id, action, entity_type, created_at", { count: "exact" })
          .match(orgFilter);
        if (options.periodStart) q = q.gte("created_at", options.periodStart);
        if (options.periodEnd) q = q.lte("created_at", options.periodEnd);
        return q.order("created_at", { ascending: false }).limit(PER);
      })()
    : Promise.resolve({ data: [], count: 0, error: null } as never);

  // Memory — RLS enforces that another user's private memory is invisible.
  const memoryPromise = needs(options, "memory")
    ? supabase
        .from("sam_memory_items")
        .select("id, layer, category, title, statement, status, confidence_score", { count: "exact" })
        .match(orgFilter)
        .neq("status", "archived")
        .order("confidence_score", { ascending: false })
        .limit(SAM_WORKFLOW_LIMITS.maxMemoryRetrieval)
    : Promise.resolve({ data: [], count: 0, error: null } as never);

  const historicalPromise = needs(options, "historical")
    ? supabase
        .from("sam_workflow_runs")
        .select("id, workflow_type, completed_at, status, confidence_score")
        .match(orgFilter)
        .eq("workflow_type", options.workflowType)
        .order("started_at", { ascending: false })
        .limit(SAM_WORKFLOW_LIMITS.maxHistoricalRuns)
    : Promise.resolve({ data: [], error: null } as never);

  const learningPromise = supabase
    .from("sam_learning_events")
    .select("event_type, created_at")
    .match(orgFilter)
    .order("created_at", { ascending: false })
    .limit(SAM_WORKFLOW_LIMITS.maxContextPerType);

  // Selected decision + related entities (Decision Review only).
  const selectedDecisionPromise = options.entityId && options.workflowType === "decision_review"
    ? supabase
        .from("decisions")
        .select(
          "id, title, question, context, status, decision_date, review_date, options_considered, operator_recommendation, evidence, risks, opportunity_cost, final_decision, rationale, outcome, owner_user_id, project_id, venture_id, updated_at",
        )
        .eq("id", options.entityId)
        .eq("organization_id", options.orgId)
        .is("deleted_at", null)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null } as never);

  const [
    settingsRes,
    venturesRes,
    projectsRes,
    tasksRes,
    goalsRes,
    decisionsRes,
    commitmentsRes,
    knowledgeRes,
    documentsRes,
    activityRes,
    memoryRes,
    historicalRes,
    learningRes,
    selectedDecisionRes,
  ] = await Promise.all([
    settingsPromise,
    venturesPromise,
    projectsPromise,
    tasksPromise,
    goalsPromise,
    decisionsPromise,
    commitmentsPromise,
    knowledgePromise,
    documentsPromise,
    activityPromise,
    memoryPromise,
    historicalPromise,
    learningPromise,
    selectedDecisionPromise,
  ]);

  const record = <T,>(name: string, res: { data: T[] | null; count?: number | null }) => {
    const list = res.data ?? [];
    const total = res.count ?? list.length;
    countsBeforeTruncation[name] = total;
    counts[name] = list.length;
    if (total > list.length) truncations.push(name);
    return list;
  };

  const ventures = record("ventures", venturesRes as never) as WorkflowContext["ventures"];
  const projects = record("projects", projectsRes as never) as WorkflowContext["projects"];
  const tasks = record("tasks", tasksRes as never) as WorkflowContext["tasks"];
  const goals = record("goals", goalsRes as never) as WorkflowContext["goals"];
  const decisions = record("decisions", decisionsRes as never) as WorkflowContext["decisions"];
  const commitments = record("commitments", commitmentsRes as never) as WorkflowContext["commitments"];
  const knowledge = record("knowledge", knowledgeRes as never) as WorkflowContext["knowledge"];
  const documents = record("documents", documentsRes as never) as WorkflowContext["documents"];
  const activity = record("activity", activityRes as never) as WorkflowContext["activity"];

  const memoryRows = (memoryRes.data ?? []) as Array<{
    id: string; layer: string; category: string; title: string; statement: string; status: string; confidence_score: number | null;
  }>;
  // sam_settings columns for workflows are not yet migrated — read from a
  // JSON extras column if present, else use safe defaults.
  const settingsExtras =
    ((settingsRes.data as unknown as Record<string, unknown> | null)?.workflow_preferences as
      | Record<string, unknown>
      | undefined) ?? {};
  const includeUncertain =
    (settingsExtras.include_uncertain_memory as boolean | undefined) ??
    WORKFLOW_DEFAULT_SETTINGS.include_uncertain_memory;
  const trusted = memoryRows
    .filter((m) => m.status === "confirmed")
    .map((m) => ({ id: m.id, layer: m.layer, title: m.title, statement: m.statement, confidence: m.confidence_score ?? 0 }));
  const uncertain = includeUncertain
    ? memoryRows
        .filter((m) => m.status !== "confirmed")
        .map((m) => ({ id: m.id, layer: m.layer, title: m.title, statement: m.statement }))
    : [];
  if (!includeUncertain && memoryRows.some((m) => m.status !== "confirmed")) {
    omittedCategories.push("uncertain_memory");
  }
  counts.memory = trusted.length + uncertain.length;
  countsBeforeTruncation.memory = memoryRows.length;

  const reliabilityValues = memoryRows
    .map((m) => m.confidence_score)
    .filter((n): n is number => typeof n === "number");
  const reliabilitySummary = {
    count: reliabilityValues.length,
    avg: reliabilityValues.length
      ? reliabilityValues.reduce((a, b) => a + b, 0) / reliabilityValues.length
      : null,
  };

  // Bounded graph traversal — only around the scoped venture (if any).
  let graph = { nodes: 0, edges: 0, depthReached: 0, truncated: false };
  if (needs(options, "graph") && options.ventureId) {
    try {
      const r = await traverse(supabase, options.orgId, { type: "venture", id: options.ventureId }, {
        maxDepth: SAM_WORKFLOW_LIMITS.maxGraphTraversalDepth,
      });
      graph = {
        nodes: r.nodes.length,
        edges: r.edges.length,
        depthReached: r.depthReached,
        truncated: r.truncated,
      };
    } catch {
      omittedCategories.push("graph");
    }
  } else if (!needs(options, "graph")) {
    omittedCategories.push("graph");
  }

  const historicalRuns = ((historicalRes.data ?? []) as Array<{
    id: string; workflow_type: string; completed_at: string | null; status: string; confidence_score: number | null;
  }>);
  counts.historical = historicalRuns.length;

  const learningEvents = ((learningRes.data ?? []) as Array<{
    event_type: string; created_at: string;
  }>);

  const selectedDecision = (selectedDecisionRes as { data?: unknown }).data
    ? ((selectedDecisionRes as { data: unknown }).data as WorkflowContext["selectedDecision"])
    : null;

  // Related entities for a selected decision. Kept small and org-scoped.
  let related: WorkflowContext["related"] = {
    goals: [], projects: [], tasks: [], commitments: [], decisions: [],
  };
  if (selectedDecision) {
    const [relTasks, relCommits, relSimilar] = await Promise.all([
      selectedDecision.project_id
        ? supabase.from("tasks").select("id, title, status").eq("project_id", selectedDecision.project_id).eq("organization_id", options.orgId).is("deleted_at", null).limit(10)
        : Promise.resolve({ data: [], error: null } as never),
      selectedDecision.project_id
        ? supabase.from("commitments").select("id, title, status").eq("project_id", selectedDecision.project_id).eq("organization_id", options.orgId).is("deleted_at", null).limit(10)
        : Promise.resolve({ data: [], error: null } as never),
      supabase.from("decisions")
        .select("id, title, status, decision_date, outcome")
        .eq("organization_id", options.orgId)
        .is("deleted_at", null)
        .neq("id", selectedDecision.id)
        .in("status", ["decided", "closed"])
        .order("decision_date", { ascending: false })
        .limit(5),
    ]);
    related = {
      goals: [],
      projects: selectedDecision.project_id
        ? projects
            .filter((p) => p.id === selectedDecision.project_id)
            .map((p) => ({ id: p.id, name: p.name, status: p.status }))
        : [],
      tasks: (relTasks.data ?? []) as never,
      commitments: (relCommits.data ?? []) as never,
      decisions: (relSimilar.data ?? []) as never,
    };
    counts.related_tasks = related.tasks.length;
    counts.related_commitments = related.commitments.length;
    counts.related_similar_decisions = related.decisions.length;
  }

  return {
    version: WORKFLOW_CONTEXT_VERSION,
    orgId: options.orgId,
    userId: options.userId,
    scope: options.scope,
    ventureId: options.ventureId,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    counts,
    countsBeforeTruncation,
    truncations,
    omittedCategories,
    ventures: ventures as WorkflowContext["ventures"],
    projects: projects as WorkflowContext["projects"],
    tasks: tasks as WorkflowContext["tasks"],
    goals: goals as WorkflowContext["goals"],
    decisions: decisions as WorkflowContext["decisions"],
    commitments: commitments as WorkflowContext["commitments"],
    knowledge,
    documents,
    activity,
    memory: {
      trusted,
      uncertain,
      considered_ids: memoryRows.map((m) => m.id),
      selected_ids: [...trusted.map((m) => m.id), ...uncertain.map((m) => m.id)],
      excluded_ids: memoryRows
        .filter((m) => !trusted.find((t) => t.id === m.id) && !uncertain.find((u) => u.id === m.id))
        .map((m) => m.id),
      reliability_summary: reliabilitySummary,
    },
    graph,
    historicalRuns,
    learningEvents,
    selectedDecision,
    related,
    settings: {
      include_uncertain_memory: includeUncertain,
      include_archived_historical_evidence:
        (settingsExtras.include_archived_historical_evidence as boolean | undefined) ??
        WORKFLOW_DEFAULT_SETTINGS.include_archived_historical_evidence,
      default_priority_limit:
        (settingsExtras.default_priority_limit as number | undefined) ??
        WORKFLOW_DEFAULT_SETTINGS.default_priority_limit,
    },
  };
}