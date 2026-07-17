// assembleExecutiveContext - Phase 3D.3a
//
// Thin wrapper over the existing SAM buildContext() that layers in the
// durable COO operating context (organization + venture) and surfaces
// deterministic contradictions between the operating context and the
// current world (open commitments, active goals, ranked memory).
//
// This function is what SAM's pipeline and future briefing workflows should
// call when they need "everything SAM knows, bounded and ranked". It is
// intentionally NOT a replacement for buildContext() - buildContext still
// owns the bounded world-of-records assembly, and this layer only adds the
// operating-context overlay + contradiction pass.
//
// Everything server-only. All queries run through the caller's Supabase
// client so RLS enforces organization + role scope.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildContext, type AssembledContext } from "@/lib/sam/context-builder.server";
import type { SamIntent } from "@/lib/sam/intent";
import { COO_EXECUTIVE_ASSEMBLER_VERSION, COO_LIMITS } from "@/lib/constants";
import type {
  OrgOperatingContextRow,
  VentureOperatingContextRow,
} from "./schema";

export interface ExecutiveContextInput {
  intent: SamIntent;
  userId: string;
  ventureId?: string | null;
  memoryToggles?: { founder: boolean; org: boolean; venture: boolean };
}

export interface ContextContradiction {
  kind:
    | "memory_vs_operating"
    | "priority_vs_project"
    | "goal_vs_activity"
    | "risk_unattended"
    | "stale_operating_context";
  message: string;
  refs: Array<{ type: string; id: string }>;
}

export interface OperatingContextSlice {
  organization: OrgOperatingContextRow | null;
  venture: VentureOperatingContextRow | null;
  organization_stale: boolean;
  venture_stale: boolean;
  organization_missing: boolean;
  venture_missing: boolean;
}

export interface ExecutiveContext {
  version: string;
  assembled_at: string;
  world: AssembledContext;
  operating: OperatingContextSlice;
  contradictions: ContextContradiction[];
  budget: { max_tokens: number; estimated_tokens: number };
  warnings: string[];
}

// Simple 4-chars-per-token heuristic. We are not tokenizing precisely - we
// only need a soft ceiling so we can flag "context is getting fat".
function estimateTokens(...blobs: unknown[]): number {
  let chars = 0;
  for (const b of blobs) {
    if (b == null) continue;
    chars += typeof b === "string" ? b.length : JSON.stringify(b).length;
  }
  return Math.ceil(chars / 4);
}

const STALE_REVIEW_DAYS = 60;

function isStale(reviewedAt: string | null | undefined): boolean {
  if (!reviewedAt) return true;
  const ageMs = Date.now() - new Date(reviewedAt).getTime();
  return ageMs > STALE_REVIEW_DAYS * 24 * 60 * 60 * 1000;
}

function normalize(text: string | null | undefined): string {
  return (text ?? "").toLowerCase();
}

function jsonBulletList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function detectContradictions(
  world: AssembledContext,
  operating: OperatingContextSlice,
): ContextContradiction[] {
  const out: ContextContradiction[] = [];

  // 1. Stale operating context is itself a "watch out".
  if (operating.organization && operating.organization_stale) {
    out.push({
      kind: "stale_operating_context",
      message:
        "Organization operating context has not been reviewed in more than 60 days.",
      refs: [{ type: "organization_operating_context", id: operating.organization.id }],
    });
  }
  if (operating.venture && operating.venture_stale) {
    out.push({
      kind: "stale_operating_context",
      message: "Venture operating context has not been reviewed in more than 60 days.",
      refs: [{ type: "venture_operating_context", id: operating.venture.id }],
    });
  }

  // 2. Trusted memory that contradicts operating focus / stage.
  const orgFocus = normalize(operating.organization?.current_focus ?? null);
  const orgStage = normalize(operating.organization?.current_stage ?? null);
  for (const m of world.memory.trusted) {
    const stmt = normalize(m.statement);
    if (
      orgFocus &&
      stmt.includes("not ") &&
      orgFocus.length > 3 &&
      stmt.includes(orgFocus)
    ) {
      out.push({
        kind: "memory_vs_operating",
        message: `Confirmed memory may contradict recorded org focus: "${m.title}".`,
        refs: [{ type: "sam_memory_items", id: m.id }],
      });
    }
    if (
      orgStage &&
      orgStage.length > 3 &&
      stmt.includes("stage") &&
      !stmt.includes(orgStage)
    ) {
      out.push({
        kind: "memory_vs_operating",
        message: `Memory references company stage but does not match recorded stage "${operating.organization?.current_stage}".`,
        refs: [{ type: "sam_memory_items", id: m.id }],
      });
    }
    if (out.length >= COO_LIMITS.maxContradictions) break;
  }

  // 3. Priorities named in operating context with no matching active project.
  const venturePriorities = jsonBulletList(operating.venture?.current_priorities);
  const projectNames = new Set(
    world.projects
      .filter((p) => p.status !== "archived" && p.status !== "completed")
      .map((p) => normalize(p.name)),
  );
  for (const pri of venturePriorities) {
    const key = normalize(pri);
    const matched = [...projectNames].some((n) => n.includes(key) || key.includes(n));
    if (!matched) {
      out.push({
        kind: "priority_vs_project",
        message: `Venture priority "${pri}" has no matching active project.`,
        refs: operating.venture
          ? [{ type: "venture_operating_context", id: operating.venture.id }]
          : [],
      });
      if (out.length >= COO_LIMITS.maxContradictions) return out;
    }
  }

  // 4. Goals with no recent supporting activity.
  const activityKeywords = new Set(
    world.activity.map((a) => normalize(a.action + " " + a.entity_type)),
  );
  for (const g of world.goals) {
    if (g.status === "completed" || g.status === "archived") continue;
    const key = normalize(g.title);
    if (key.length < 4) continue;
    const anySignal = [...activityKeywords].some((k) => k.includes(key));
    const anyProject = [...projectNames].some(
      (n) => n.includes(key) || key.includes(n),
    );
    if (!anySignal && !anyProject) {
      out.push({
        kind: "goal_vs_activity",
        message: `Active goal "${g.title}" has no recent activity or matching project.`,
        refs: [{ type: "goals", id: g.id }],
      });
      if (out.length >= COO_LIMITS.maxContradictions) return out;
    }
  }

  // 5. Risks named in operating context with no matching signal.
  const ventureRisks = jsonBulletList(operating.venture?.current_risks);
  const orgRisks = jsonBulletList(operating.organization?.major_risks);
  const allRisks = [...ventureRisks, ...orgRisks];
  const activityBlob = world.activity.map((a) => normalize(a.action)).join(" ");
  for (const r of allRisks) {
    const key = normalize(r);
    if (key.length < 4) continue;
    if (!activityBlob.includes(key)) {
      out.push({
        kind: "risk_unattended",
        message: `Recorded risk "${r}" has no recent activity or follow-up signal.`,
        refs: [],
      });
      if (out.length >= COO_LIMITS.maxContradictions) return out;
    }
  }

  return out;
}

export async function assembleExecutiveContext(
  supabase: SupabaseClient<Database>,
  orgId: string,
  input: ExecutiveContextInput,
): Promise<ExecutiveContext> {
  // 1. World-of-records via the existing SAM builder (RLS-scoped, bounded).
  const world = await buildContext(supabase, orgId, {
    intent: input.intent,
    userId: input.userId,
    ventureId: input.ventureId ?? null,
    memoryToggles: input.memoryToggles,
  });

  // 2. Operating context overlay.
  const [{ data: org }, ventureRes] = await Promise.all([
    supabase
      .from("organization_operating_context")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle(),
    input.ventureId
      ? supabase
          .from("venture_operating_context")
          .select("*")
          .eq("organization_id", orgId)
          .eq("venture_id", input.ventureId)
          .maybeSingle()
      : Promise.resolve({ data: null as VentureOperatingContextRow | null }),
  ]);

  const operating: OperatingContextSlice = {
    organization: org ?? null,
    venture: (ventureRes as { data: VentureOperatingContextRow | null }).data ?? null,
    organization_stale: !!org && isStale(org.last_reviewed_at),
    venture_stale:
      !!(ventureRes as { data: VentureOperatingContextRow | null }).data &&
      isStale(
        (ventureRes as { data: VentureOperatingContextRow | null }).data!.last_reviewed_at,
      ),
    organization_missing: !org,
    venture_missing:
      !!input.ventureId &&
      !(ventureRes as { data: VentureOperatingContextRow | null }).data,
  };

  // 3. Deterministic contradictions.
  const contradictions = detectContradictions(world, operating);

  // 4. Warnings surface for the caller.
  const warnings: string[] = [];
  if (operating.organization_missing) {
    warnings.push(
      "No organization operating context is set. SAM will reason with less durable grounding.",
    );
  }
  if (operating.venture_missing) {
    warnings.push(
      "No venture operating context is set for the selected venture.",
    );
  }
  if (operating.organization_stale || operating.venture_stale) {
    warnings.push("Operating context is more than 60 days out of review.");
  }

  const estimated = estimateTokens(world, operating, contradictions);
  if (estimated > COO_LIMITS.maxAssemblerTokens) {
    warnings.push(
      `Assembled context is large (${estimated} est. tokens). Consider narrowing intent or venture.`,
    );
  }

  return {
    version: COO_EXECUTIVE_ASSEMBLER_VERSION,
    assembled_at: new Date().toISOString(),
    world,
    operating,
    contradictions,
    budget: {
      max_tokens: COO_LIMITS.maxAssemblerTokens,
      estimated_tokens: estimated,
    },
    warnings,
  };
}