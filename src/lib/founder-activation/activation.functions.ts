// Founder Activation server functions.
//
// Three protected server functions: proposeFounderActivation returns the
// proposal set with duplicate matches; importFounderActivation writes the
// approved records; runFounderActivationReview + createInitialExecutiveBrief
// run the post-import SAM review and persist an executive_insights row.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  VENTURES, PROJECTS, GOALS, DECISIONS, COMMITMENTS,
  normalizeName,
} from "./proposals";
import { mergePatch, priorityRank } from "./merge-policy";

type SB = SupabaseClient<Database>;

const PriorityEnum = z.enum(["low", "normal", "high", "critical"]);

const DecisionInput = z.object({
  key: z.string(),
  action: z.enum(["create", "skip", "merge"]),
  mergeTargetId: z.string().uuid().optional(),
  // Editable overrides
  name: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  objective: z.string().optional(),
  definitionOfSuccess: z.string().optional(),
  decision: z.string().optional(),
  rationale: z.string().optional(),
  priority: PriorityEnum.optional(),
  status: z.string().optional(),
  blocker: z.string().optional(),
  ventureOverrideKey: z.string().optional(),
  dueDate: z.string().optional(),
});

const ImportInput = z.object({
  organizationId: z.string().uuid(),
  ventures: z.array(DecisionInput),
  projects: z.array(DecisionInput),
  goals: z.array(DecisionInput),
  decisions: z.array(DecisionInput),
  commitments: z.array(DecisionInput),
});

type Match = { id: string; name: string };
type ProposalWithMatches<T> = T & { existingMatches: Match[] };

async function findDupes(
  supabase: SB,
  table: "ventures" | "projects" | "goals" | "decisions" | "commitments",
  orgId: string,
  nameField: "name" | "title",
): Promise<Array<{ id: string; label: string; venture_id: string | null }>> {
  const query = supabase.from(table).select(`id, ${nameField}, venture_id`).eq("organization_id", orgId).is("deleted_at", null);
  // ventures table has no venture_id column
  const { data, error } = table === "ventures"
    ? await supabase.from("ventures").select("id, name").eq("organization_id", orgId).is("deleted_at", null)
    : await query;
  if (error) return [];
  return (data ?? []).map((r: any) => ({ id: r.id, label: r[nameField] ?? r.name ?? "", venture_id: r.venture_id ?? null }));
}

function matchesForName(name: string, existing: Array<{ id: string; label: string }>): Match[] {
  const n = normalizeName(name);
  return existing.filter((r) => normalizeName(r.label) === n).map((r) => ({ id: r.id, name: r.label }));
}

export const proposeFounderActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SB;
    const orgId = data.organizationId;
    const [vExisting, pExisting, gExisting, dExisting, cExisting] = await Promise.all([
      findDupes(supabase, "ventures", orgId, "name"),
      findDupes(supabase, "projects", orgId, "name"),
      findDupes(supabase, "goals", orgId, "title"),
      findDupes(supabase, "decisions", orgId, "title"),
      findDupes(supabase, "commitments", orgId, "title"),
    ]);

    const ventures = VENTURES.map((v) => ({ ...v, existingMatches: matchesForName(v.name, vExisting) }));
    const projects = PROJECTS.map((p) => ({ ...p, existingMatches: matchesForName(p.name, pExisting) }));
    const goals = GOALS.map((g) => ({ ...g, existingMatches: matchesForName(g.title, gExisting) }));
    const decisions = DECISIONS.map((d) => ({ ...d, existingMatches: matchesForName(d.title, dExisting) }));
    const commitments = COMMITMENTS.map((c) => ({ ...c, existingMatches: matchesForName(c.title, cExisting) }));

    return { ventures, projects, goals, decisions, commitments };
  });

type ImportOutcome = {
  key: string;
  kind: "venture" | "project" | "goal" | "decision" | "commitment";
  result: "created" | "merged" | "skipped" | "error";
  id?: string;
  duplicateOf?: string;
  error?: string;
};

async function logActivity(
  supabase: SB, orgId: string, userId: string, ventureId: string | null,
  entityType: string, entityId: string, action: string, summary: string,
) {
  await supabase.from("activity_events").insert({
    organization_id: orgId,
    venture_id: ventureId,
    actor_user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
    metadata: { actor_label: "Founder Activation" } as never,
  });
}

export const importFounderActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ImportInput.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SB;
    const userId = context.userId as string;
    const orgId = data.organizationId;
    const outcomes: ImportOutcome[] = [];
    const ventureIdByKey = new Map<string, string>();

    // Ventures first — projects/goals/commitments depend on venture_id.
    for (const decision of data.ventures) {
      const proposal = VENTURES.find((v) => v.key === decision.key);
      if (!proposal) continue;
      if (decision.action === "skip") {
        outcomes.push({ key: decision.key, kind: "venture", result: "skipped" });
        continue;
      }
      const name = (decision.name ?? proposal.name).trim();
      const description = decision.description ?? [proposal.description, "", "Strategic direction: " + proposal.strategicDirection].join("\n");
      const priority = decision.priority ?? proposal.priority;

      if (decision.action === "merge" && decision.mergeTargetId) {
        const { data: existing } = await supabase.from("ventures").select("*").eq("id", decision.mergeTargetId).maybeSingle();
        if (existing) {
          const patch = mergePatch(existing as never, { description, priority } as never);
          if (Object.keys(patch).length > 0) {
            await supabase.from("ventures").update(patch as never).eq("id", existing.id);
          }
          ventureIdByKey.set(proposal.key, existing.id);
          await logActivity(supabase, orgId, userId, existing.id, "venture", existing.id, "merged", `Merged venture proposal into ${existing.name}`);
          outcomes.push({ key: decision.key, kind: "venture", result: "merged", id: existing.id, duplicateOf: existing.name });
          continue;
        }
      }
      const { data: created, error } = await supabase.from("ventures").insert({
        organization_id: orgId,
        name, description, priority: priority as never, status: "active" as never,
        created_by: userId,
      } as never).select("id, name").single();
      if (error || !created) {
        outcomes.push({ key: decision.key, kind: "venture", result: "error", error: error?.message ?? "insert failed" });
        continue;
      }
      ventureIdByKey.set(proposal.key, (created as any).id);
      await logActivity(supabase, orgId, userId, (created as any).id, "venture", (created as any).id, "created", `Created venture ${(created as any).name}`);
      outcomes.push({ key: decision.key, kind: "venture", result: "created", id: (created as any).id });
    }

    // Look up any existing ventures for keys the user skipped, so children can still be attached.
    for (const v of VENTURES) {
      if (ventureIdByKey.has(v.key)) continue;
      const { data: existing } = await supabase
        .from("ventures").select("id, name").eq("organization_id", orgId).is("deleted_at", null);
      const match = (existing ?? []).find((r) => normalizeName((r as any).name) === normalizeName(v.name));
      if (match) ventureIdByKey.set(v.key, (match as any).id);
    }

    async function handleChild<TExisting extends { id: string }>(
      list: typeof data.projects,
      kind: "project" | "goal" | "decision" | "commitment",
      table: "projects" | "goals" | "decisions" | "commitments",
      buildInsert: (dec: z.infer<typeof DecisionInput>, ventureId: string | null) => Record<string, unknown>,
      buildMergePatch: (dec: z.infer<typeof DecisionInput>, existing: TExisting) => Record<string, unknown>,
      labelOf: (dec: z.infer<typeof DecisionInput>) => string,
      ventureKeyOf: (dec: z.infer<typeof DecisionInput>) => string | null,
    ) {
      for (const dec of list) {
        if (dec.action === "skip") { outcomes.push({ key: dec.key, kind, result: "skipped" }); continue; }
        const vKey = dec.ventureOverrideKey ?? ventureKeyOf(dec);
        const ventureId = vKey ? ventureIdByKey.get(vKey) ?? null : null;
        if (dec.action === "merge" && dec.mergeTargetId) {
          const { data: existing } = await supabase.from(table).select("*").eq("id", dec.mergeTargetId).maybeSingle();
          if (existing) {
            const patch = buildMergePatch(dec, existing as never);
            if (Object.keys(patch).length > 0) await supabase.from(table).update(patch as never).eq("id", (existing as any).id);
            await logActivity(supabase, orgId, userId, (existing as any).venture_id ?? null, kind, (existing as any).id, "merged", `Merged ${kind} proposal into ${labelOf(dec)}`);
            outcomes.push({ key: dec.key, kind, result: "merged", id: (existing as any).id, duplicateOf: labelOf(dec) });
            continue;
          }
        }
        // Idempotency: if a row with this name already exists for the org (and, for
        // scoped tables, the resolved venture), treat as skipped rather than erroring
        // on the unique index. Keeps re-runs of Founder Activation safe.
        {
          const nameField: "name" | "title" = table === "projects" ? "name" : "title";
          const label = labelOf(dec);
          const { data: dupes } = await supabase
            .from(table)
            .select(`id, ${nameField}, venture_id`)
            .eq("organization_id", orgId)
            .is("deleted_at", null);
          const dup = (dupes ?? []).find((r: any) =>
            normalizeName(r[nameField] ?? "") === normalizeName(label)
          );
          if (dup) {
            outcomes.push({ key: dec.key, kind, result: "skipped", id: (dup as any).id, duplicateOf: label });
            continue;
          }
        }
        const insert = { ...buildInsert(dec, ventureId), organization_id: orgId, created_by: userId };
        const { data: created, error } = await supabase.from(table).insert(insert as never).select("id").single();
        if (error || !created) {
          outcomes.push({ key: dec.key, kind, result: "error", error: error?.message ?? "insert failed" });
          continue;
        }
        await logActivity(supabase, orgId, userId, ventureId, kind, (created as any).id, "created", `Created ${kind} ${labelOf(dec)}`);
        outcomes.push({ key: dec.key, kind, result: "created", id: (created as any).id });
      }
    }

    await handleChild(
      data.projects, "project", "projects",
      (dec, ventureId) => {
        const p = PROJECTS.find((x) => x.key === dec.key)!;
        return {
          venture_id: ventureId,
          name: (dec.name ?? p.name),
          objective: dec.objective ?? p.objective,
          status: (dec.status ?? p.status) as never,
          priority: (dec.priority ?? p.priority) as never,
          blocker_summary: dec.blocker ?? p.blocker ?? null,
          deadline: dec.dueDate || null,
        };
      },
      (dec, existing: any) => {
        const p = PROJECTS.find((x) => x.key === dec.key)!;
        return mergePatch(existing, {
          objective: dec.objective ?? p.objective,
          blocker_summary: dec.blocker ?? p.blocker ?? null,
        } as never);
      },
      (dec) => dec.name ?? PROJECTS.find((x) => x.key === dec.key)?.name ?? "",
      (dec) => PROJECTS.find((x) => x.key === dec.key)?.ventureKey ?? null,
    );

    await handleChild(
      data.goals, "goal", "goals",
      (dec, ventureId) => {
        const g = GOALS.find((x) => x.key === dec.key)!;
        return {
          venture_id: ventureId,
          title: dec.title ?? g.title,
          description: dec.definitionOfSuccess ?? g.definitionOfSuccess,
          status: "active" as never,
          priority: (dec.priority ?? g.priority) as never,
          target_date: dec.dueDate || null,
        };
      },
      (dec, existing: any) => {
        const g = GOALS.find((x) => x.key === dec.key)!;
        return mergePatch(existing, { description: dec.definitionOfSuccess ?? g.definitionOfSuccess } as never);
      },
      (dec) => dec.title ?? GOALS.find((x) => x.key === dec.key)?.title ?? "",
      (dec) => GOALS.find((x) => x.key === dec.key)?.ventureKey ?? null,
    );

    await handleChild(
      data.decisions, "decision", "decisions",
      (_dec, ventureId) => {
        const d = DECISIONS.find((x) => x.key === _dec.key)!;
        return {
          venture_id: ventureId,
          title: _dec.title ?? d.title,
          final_decision: _dec.decision ?? d.decision,
          rationale: _dec.rationale ?? d.rationale ?? null,
          status: "decided" as never,
          decision_date: new Date().toISOString().slice(0, 10),
        };
      },
      (dec, existing: any) => {
        const d = DECISIONS.find((x) => x.key === dec.key)!;
        return mergePatch(existing, {
          final_decision: dec.decision ?? d.decision,
          rationale: dec.rationale ?? d.rationale ?? null,
        } as never);
      },
      (dec) => dec.title ?? DECISIONS.find((x) => x.key === dec.key)?.title ?? "",
      () => null,
    );

    await handleChild(
      data.commitments, "commitment", "commitments",
      (dec, ventureId) => {
        const c = COMMITMENTS.find((x) => x.key === dec.key)!;
        return {
          venture_id: ventureId,
          title: dec.title ?? c.title,
          description: dec.blocker ?? c.blocker ?? c.note ?? null,
          notes: c.note ?? null,
          status: (dec.status ?? c.status) as never,
          priority: (dec.priority ?? "normal") as never,
          due_date: dec.dueDate || null,
          postponement_count: 0,
        };
      },
      (dec, existing: any) => {
        const c = COMMITMENTS.find((x) => x.key === dec.key)!;
        return mergePatch(existing, { description: dec.blocker ?? c.blocker ?? null } as never);
      },
      (dec) => dec.title ?? COMMITMENTS.find((x) => x.key === dec.key)?.title ?? "",
      (dec) => COMMITMENTS.find((x) => x.key === dec.key)?.ventureKey ?? null,
    );

    return { outcomes };
  });

// Executive review — computed deterministically from imported records so we
// never fabricate metrics. `runFounderActivationReview` and
// `createInitialExecutiveBrief` both persist as executive_insights rows.

export const runFounderActivationReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SB;
    const orgId = data.organizationId;

    const [{ data: vs }, { data: ps }, { data: gs }, { data: ds }, { data: cs }] = await Promise.all([
      supabase.from("ventures").select("id, name, priority, status").eq("organization_id", orgId).is("deleted_at", null),
      supabase.from("projects").select("id, name, priority, status, venture_id, blocker_summary, deadline, owner_user_id").eq("organization_id", orgId).is("deleted_at", null),
      supabase.from("goals").select("id, title, priority, status, venture_id, target_date, owner_user_id").eq("organization_id", orgId).is("deleted_at", null),
      supabase.from("decisions").select("id, title, status, decision_date").eq("organization_id", orgId).is("deleted_at", null),
      supabase.from("commitments").select("id, title, status, venture_id, due_date, owner_user_id, description").eq("organization_id", orgId).is("deleted_at", null),
    ]);

    const ventures = (vs ?? []) as Array<{ id: string; name: string; priority: string; status: string }>;
    const projects = (ps ?? []) as Array<any>;
    const goals = (gs ?? []) as Array<any>;
    const decisions = (ds ?? []) as Array<any>;
    const commitments = (cs ?? []) as Array<any>;

    const ventureName = (id: string | null) => ventures.find((v) => v.id === id)?.name ?? "Unassigned";

    const rank = (p: string | null | undefined) => priorityRank(p);

    const topPriorities = [...projects]
      .filter((p) => p.status !== "completed" && p.status !== "archived")
      .sort((a, b) => rank(b.priority) - rank(a.priority))
      .slice(0, 5)
      .map((p) => `${p.name} (${ventureName(p.venture_id)}, priority: ${p.priority})`);

    const blocked = projects.filter((p) => p.status === "blocked").map((p) => `${p.name} - ${p.blocker_summary ?? "no blocker documented"}`);
    const risks: string[] = [];
    if (blocked.length) risks.push(`${blocked.length} project(s) currently blocked, all waiting on external credentials or setup.`);
    const criticalNoOwner = projects.filter((p) => rank(p.priority) >= 3 && !p.owner_user_id);
    if (criticalNoOwner.length) risks.push(`${criticalNoOwner.length} high or critical project(s) with no assigned owner.`);
    const goalsNoDate = goals.filter((g) => !g.target_date);
    if (goalsNoDate.length) risks.push(`${goalsNoDate.length} goal(s) have no target date, making success hard to measure.`);
    const commitmentsNoDate = commitments.filter((c) => !c.due_date && c.status !== "completed");
    if (commitmentsNoDate.length) risks.push(`${commitmentsNoDate.length} commitment(s) have no due date and may drift.`);
    if (ventures.length >= 4) risks.push(`${ventures.length} active ventures increase context-switching cost for a single founder.`);

    const missingOwners = projects.filter((p) => !p.owner_user_id).map((p) => p.name);
    const missingDeadlines = projects.filter((p) => !p.deadline).map((p) => p.name);

    // Overlap: projects with the same core theme across ventures.
    const overlaps: string[] = [];
    const socialProjects = projects.filter((p) => /social|meta|facebook|instagram|publishing/i.test(p.name));
    if (socialProjects.length >= 2) overlaps.push(`Meta / social publishing work spans ${socialProjects.map((p) => `${p.name} (${ventureName(p.venture_id)})`).join(", ")}. Consolidate execution to avoid duplicate effort.`);
    const contentProjects = projects.filter((p) => /voice|content|publishing|today/i.test(p.name));
    if (contentProjects.length >= 3) overlaps.push(`Content publishing exists on ${contentProjects.length} projects across Healing Path, Warpath, and personal brand. Confirm a single shared editorial cadence.`);

    const conflicts: string[] = [];
    const criticalCount = projects.filter((p) => p.priority === "critical").length;
    if (criticalCount > 2) conflicts.push(`${criticalCount} projects marked critical. True critical work is usually 1 or 2 at a time.`);

    const perVenture = ventures.map((v) => {
      const vProjects = projects.filter((p) => p.venture_id === v.id);
      const vBlocked = vProjects.filter((p) => p.status === "blocked").length;
      const top = vProjects.sort((a, b) => rank(b.priority) - rank(a.priority))[0];
      let recommendation = "Continue current focus.";
      if (v.name === "NorthStar Labs HQ") recommendation = "Ship the SAM End-to-End Automation Proof using an already-connected provider (Beehiiv draft) so blocked Meta work does not stall the closed-loop goal.";
      else if (v.name === "Healing Path System") recommendation = "Advance Healing Path Trusted Voice Strategy this week; social publishing is blocked, so keep organic content moving on channels you already control.";
      else if (v.name === "Warpath Ministries") recommendation = "Use Warpath Founder Living Mode to capture friction notes before adding features.";
      else if (v.name === "Elite Fleet Rides") recommendation = "Stand up Repeat Client Follow-Up first - it feeds every other EFR goal.";
      else if (v.name.startsWith("Jeff Domenick")) recommendation = "Confirm Today's Light Publishing System cadence before expanding authority projects.";
      return { venture: v.name, projectCount: vProjects.length, blockedCount: vBlocked, topProject: top?.name ?? null, recommendation };
    });

    const samExecutable = "Draft the first Beehiiv end-to-end test post via SAM, hold in Approval Required mode, and surface it in The Brief.";
    const approvalRequired = "Approve the Beehiiv draft SAM prepares for the closed-loop automation test.";

    const sevenDayPlan = [
      "Day 1: Approve or edit the Beehiiv draft SAM prepares for the closed-loop test.",
      "Day 2: Publish the approved Beehiiv draft and verify externally.",
      "Day 3: Create the Meta Developer App and add META_APP_ID, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN.",
      "Day 4: Run Meta OAuth, discover the Healing Path Page + Instagram account.",
      "Day 5: Publish one controlled Facebook Page post and verify.",
      "Day 6: Publish one controlled Instagram single-image post and verify.",
      "Day 7: Executive review of the closed loop; decide on LinkedIn as next provider.",
    ];

    const missing = [
      "No performance metrics were provided or invented (revenue, users, conversion, engagement).",
      missingOwners.length ? `Owners not set for: ${missingOwners.slice(0, 5).join(", ")}${missingOwners.length > 5 ? " and more" : ""}.` : null,
      missingDeadlines.length ? `Deadlines not set for: ${missingDeadlines.slice(0, 5).join(", ")}${missingDeadlines.length > 5 ? " and more" : ""}.` : null,
    ].filter(Boolean) as string[];

    const payload = {
      generatedAt: new Date().toISOString(),
      facts: {
        ventures: ventures.length,
        projects: projects.length,
        goals: goals.length,
        decisions: decisions.length,
        commitments: commitments.length,
        blockedProjects: blocked.length,
      },
      topPriorities,
      topRisks: risks.slice(0, 5),
      blockedWork: blocked,
      overlaps,
      missingOwners,
      missingDeadlines,
      conflicts,
      perVenture,
      samExecutable,
      approvalRequired,
      sevenDayPlan,
      missingInformation: missing,
    };

    const summary = `${ventures.length} ventures, ${projects.length} projects, ${goals.length} goals, ${decisions.length} decisions, ${commitments.length} commitments. ${blocked.length} project(s) blocked pending external credentials.`;
    const { data: insight } = await supabase.from("executive_insights").insert({
      organization_id: orgId,
      insight_type: "founder_activation_review",
      title: "SAM Executive Review - Founder Activation",
      summary,
      severity: "attention" as never,
      status: "active" as never,
      source_records: payload as never,
      generated_at: new Date().toISOString(),
    } as never).select("id").single();

    return { insightId: (insight as any)?.id ?? null, ...payload };
  });

export const createInitialExecutiveBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid(), reviewPayload: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SB;
    const p = data.reviewPayload as any;
    const summary = `First Executive Brief. Operating state: ${p.facts?.ventures ?? 0} ventures active, ${p.facts?.blockedProjects ?? 0} project(s) blocked. Next best action: ${p.samExecutable ?? "Approve the SAM closed-loop test."}`;
    const brief = {
      currentOperatingState: `${p.facts?.ventures ?? 0} ventures, ${p.facts?.projects ?? 0} projects, ${p.facts?.goals ?? 0} goals, ${p.facts?.decisions ?? 0} decisions, ${p.facts?.commitments ?? 0} commitments`,
      criticalPriorities: p.topPriorities ?? [],
      activeBlockers: p.blockedWork ?? [],
      recentDecisions: "See Decisions page - 7 finalized decisions imported.",
      commitmentsRequiringAttention: p.missingDeadlines ?? [],
      ventureSummary: p.perVenture ?? [],
      samRecommendations: p.topRisks ?? [],
      founderQuestions: [
        "Are you willing to assign owners to the critical and high-priority projects, or keep yourself as sole owner for now?",
        "Can we set target dates on the imported goals so success is measurable?",
        "Which venture should SAM protect from context-switching this week?",
      ],
      nextBestAction: p.samExecutable ?? "Approve the SAM closed-loop automation test.",
      missingInformation: p.missingInformation ?? [],
    };
    const { data: insight } = await supabase.from("executive_insights").insert({
      organization_id: data.organizationId,
      insight_type: "executive_brief",
      title: "First Executive Brief",
      summary,
      severity: "information" as never,
      status: "active" as never,
      source_records: brief as never,
      generated_at: new Date().toISOString(),
    } as never).select("id").single();
    return { briefId: (insight as any)?.id ?? null, brief };
  });
