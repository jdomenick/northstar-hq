// Deterministic pattern detectors. All pure functions over an
// IntelligenceDataset. No I/O, no LLM, no randomness.
//
// Each detector emits DetectorFinding[] with a stable entityRef so upserts
// remain idempotent.

import {
  PATTERN_VERSION,
  type DetectorFinding,
  type EntityRef,
  type InsightPriority,
  type PatternKey,
} from "./types";

// ── Dataset shapes (structurally typed; row types stay loose so pure code
// runs in Node tests without importing generated Supabase types).

export interface DsProject {
  id: string;
  organization_id: string;
  venture_id: string | null;
  name: string;
  status: string;
  owner_user_id: string | null;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  deadline: string | null;
  deleted_at: string | null;
}

export interface DsTask {
  id: string;
  project_id: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DsCommitment {
  id: string;
  organization_id: string;
  venture_id: string | null;
  title: string;
  status: string;
  owner_user_id: string | null;
  due_date: string | null;
  postponement_count: number;
  completed_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface DsDecision {
  id: string;
  organization_id: string;
  venture_id: string | null;
  title: string;
  status: string;
  owner_user_id: string | null;
  final_decision: string | null;
  review_date: string | null;
  decision_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DsGoal {
  id: string;
  organization_id: string;
  venture_id: string | null;
  title: string;
  status: string;
  progress_percentage: number; // derived from current_value / target_value
  target_date: string | null;
  updated_at: string;
}

export interface DsVenture {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  updated_at: string;
}

export interface DsActivity {
  id: string;
  organization_id: string;
  venture_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action: string;
  created_at: string;
}

export interface DsMemoryConflict {
  id: string;
  organization_id: string;
  status: string;
  created_at: string;
}

export interface IntelligenceDataset {
  now: Date;
  organizationId: string;
  ventures: DsVenture[];
  projects: DsProject[];
  tasks: DsTask[];
  commitments: DsCommitment[];
  decisions: DsDecision[];
  goals: DsGoal[];
  activity: DsActivity[];
  memoryConflicts: DsMemoryConflict[];
}

// ── Helpers -----------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ref(type: EntityRef["type"], id: string, title?: string): EntityRef {
  return { type, id, title };
}

function priorityFrom(score: number): InsightPriority {
  if (score >= 0.85) return "critical";
  if (score >= 0.65) return "high";
  if (score >= 0.4) return "normal";
  return "low";
}

function finding(f: Omit<DetectorFinding, "patternVersion">): DetectorFinding {
  return { ...f, patternVersion: PATTERN_VERSION };
}

// ── Detectors ---------------------------------------------------------------

const STALLED_DAYS = 14;
const INACTIVE_VENTURE_DAYS = 19;
const POSTPONE_THRESHOLD = 3;
const LONG_RUNNING_DAYS = 90;
const DUPLICATE_JACCARD = 0.7;

export function detectStalledProjects(ds: IntelligenceDataset): DetectorFinding[] {
  const out: DetectorFinding[] = [];
  const openStatuses = new Set(["planned", "in_progress", "at_risk", "blocked"]);
  const activeByProject = new Map<string, Date>();
  for (const t of ds.tasks) {
    if (!t.project_id) continue;
    const d = parseDate(t.updated_at);
    if (!d) continue;
    const prev = activeByProject.get(t.project_id);
    if (!prev || d > prev) activeByProject.set(t.project_id, d);
  }
  for (const p of ds.projects) {
    if (p.deleted_at || !openStatuses.has(p.status)) continue;
    const lastActivity =
      activeByProject.get(p.id) ?? parseDate(p.updated_at) ?? parseDate(p.created_at);
    if (!lastActivity) continue;
    const days = daysBetween(ds.now, lastActivity);
    if (days < STALLED_DAYS) continue;
    const score = Math.min(1, days / 45);
    out.push(
      finding({
        patternKey: "stalled_project",
        ventureId: p.venture_id,
        entityRef: `project:${p.id}`,
        title: `Project stalled: ${p.name}`,
        summary: `No task activity on "${p.name}" in ${days} day${days === 1 ? "" : "s"}.`,
        priority: priorityFrom(score),
        confidence: 0.85,
        severity: days >= 30 ? "critical" : "warning",
        evidence: {
          refs: [ref("project", p.id, p.name)],
          metrics: { days_stalled: days, status: p.status },
        },
      }),
    );
  }
  return out;
}

export function detectInactiveVentures(ds: IntelligenceDataset): DetectorFinding[] {
  const out: DetectorFinding[] = [];
  const activityByVenture = new Map<string, Date>();
  for (const a of ds.activity) {
    if (!a.venture_id) continue;
    const d = parseDate(a.created_at);
    if (!d) continue;
    const prev = activityByVenture.get(a.venture_id);
    if (!prev || d > prev) activityByVenture.set(a.venture_id, d);
  }
  for (const v of ds.ventures) {
    if (v.status === "archived" || v.status === "closed") continue;
    const last = activityByVenture.get(v.id) ?? parseDate(v.updated_at);
    if (!last) continue;
    const days = daysBetween(ds.now, last);
    if (days < INACTIVE_VENTURE_DAYS) continue;
    const score = Math.min(1, days / 45);
    out.push(
      finding({
        patternKey: "inactive_venture",
        ventureId: v.id,
        entityRef: `venture:${v.id}`,
        title: `Venture inactive: ${v.name}`,
        summary: `${v.name} has had no progress for ${days} days.`,
        priority: priorityFrom(score),
        confidence: 0.8,
        severity: "warning",
        evidence: {
          refs: [ref("venture", v.id, v.name)],
          metrics: { days_inactive: days },
        },
      }),
    );
  }
  return out;
}

export function detectPostponedCommitments(ds: IntelligenceDataset): DetectorFinding[] {
  const out: DetectorFinding[] = [];
  for (const c of ds.commitments) {
    if (c.deleted_at || c.status === "completed" || c.status === "cancelled") continue;
    if (c.postponement_count < POSTPONE_THRESHOLD) continue;
    const score = Math.min(1, c.postponement_count / 5);
    out.push(
      finding({
        patternKey: "postponed_commitment",
        ventureId: c.venture_id,
        entityRef: `commitment:${c.id}`,
        title: `Repeatedly postponed: ${c.title}`,
        summary: `You've postponed "${c.title}" ${c.postponement_count} times.`,
        priority: priorityFrom(score),
        confidence: 0.95,
        severity: c.postponement_count >= 5 ? "critical" : "warning",
        evidence: {
          refs: [ref("commitment", c.id, c.title)],
          metrics: { postponements: c.postponement_count, status: c.status },
        },
      }),
    );
  }
  return out;
}

export function detectMissingOwners(ds: IntelligenceDataset): DetectorFinding[] {
  const out: DetectorFinding[] = [];
  const openProjectStatuses = new Set(["planned", "in_progress", "at_risk", "blocked"]);
  for (const p of ds.projects) {
    if (p.deleted_at || !openProjectStatuses.has(p.status) || p.owner_user_id) continue;
    out.push(
      finding({
        patternKey: "missing_owner",
        ventureId: p.venture_id,
        entityRef: `project:${p.id}`,
        title: `Project has no owner: ${p.name}`,
        summary: `"${p.name}" is open with no assigned owner.`,
        priority: "normal",
        confidence: 1,
        severity: "warning",
        evidence: { refs: [ref("project", p.id, p.name)], metrics: { status: p.status } },
      }),
    );
  }
  for (const c of ds.commitments) {
    if (c.deleted_at || c.status === "completed" || c.status === "cancelled" || c.owner_user_id) continue;
    out.push(
      finding({
        patternKey: "missing_owner",
        ventureId: c.venture_id,
        entityRef: `commitment:${c.id}`,
        title: `Commitment has no owner: ${c.title}`,
        summary: `"${c.title}" is open with no assigned owner.`,
        priority: "normal",
        confidence: 1,
        severity: "warning",
        evidence: { refs: [ref("commitment", c.id, c.title)], metrics: { status: c.status } },
      }),
    );
  }
  return out;
}

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 3);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function detectDuplicateProjects(ds: IntelligenceDataset): DetectorFinding[] {
  const out: DetectorFinding[] = [];
  const open = ds.projects.filter(
    (p) => !p.deleted_at && p.status !== "completed" && p.status !== "cancelled",
  );
  const tokens = open.map((p) => ({ p, t: tokenize(p.name) }));
  const emitted = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const score = jaccard(tokens[i].t, tokens[j].t);
      if (score < DUPLICATE_JACCARD) continue;
      const a = tokens[i].p;
      const b = tokens[j].p;
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      out.push(
        finding({
          patternKey: "duplicate_project",
          ventureId: a.venture_id ?? b.venture_id,
          entityRef: `duplicate:${key}`,
          title: `Possible duplicate projects`,
          summary: `"${a.name}" and "${b.name}" look like the same work.`,
          priority: "normal",
          confidence: score,
          severity: "information",
          evidence: {
            refs: [ref("project", a.id, a.name), ref("project", b.id, b.name)],
            metrics: { similarity: Number(score.toFixed(3)) },
          },
        }),
      );
    }
  }
  return out;
}

export function detectRepeatedDecisions(ds: IntelligenceDataset): DetectorFinding[] {
  const now = ds.now;
  const windowStart = new Date(now.getTime() - 30 * 86_400_000);
  const topics = new Map<string, DsDecision[]>();
  for (const d of ds.decisions) {
    if (d.deleted_at) continue;
    const created = parseDate(d.created_at);
    if (!created || created < windowStart) continue;
    const toks = tokenize(d.title);
    const key = toks.slice(0, 2).join("-");
    if (!key) continue;
    const arr = topics.get(key) ?? [];
    arr.push(d);
    topics.set(key, arr);
  }
  const out: DetectorFinding[] = [];
  for (const [key, arr] of topics) {
    if (arr.length < 3) continue;
    out.push(
      finding({
        patternKey: "repeated_decision_topic",
        ventureId: arr[0].venture_id,
        entityRef: `topic:${key}`,
        title: `Recurring decision theme: ${key.replace("-", " ")}`,
        summary: `${arr.length} recent decisions center on "${key.replace("-", " ")}".`,
        priority: "normal",
        confidence: 0.7,
        severity: "information",
        evidence: {
          refs: arr.map((d) => ref("decision", d.id, d.title)),
          metrics: { count: arr.length, window_days: 30 },
        },
      }),
    );
  }
  return out;
}

export function detectDecisionReversals(ds: IntelligenceDataset): DetectorFinding[] {
  const out: DetectorFinding[] = [];
  for (const d of ds.decisions) {
    if (d.deleted_at) continue;
    if (d.status !== "superseded") continue;
    out.push(
      finding({
        patternKey: "decision_reversal",
        ventureId: d.venture_id,
        entityRef: `decision:${d.id}`,
        title: `Decision reversed: ${d.title}`,
        summary: `"${d.title}" has been superseded. Confirm the new direction is documented.`,
        priority: "high",
        confidence: 1,
        severity: "warning",
        evidence: { refs: [ref("decision", d.id, d.title)], metrics: { status: d.status } },
      }),
    );
  }
  return out;
}

export function detectGoalDrift(ds: IntelligenceDataset): DetectorFinding[] {
  const out: DetectorFinding[] = [];
  const now = ds.now;
  for (const g of ds.goals) {
    if (g.status !== "active" && g.status !== "in_progress") continue;
    const updated = parseDate(g.updated_at);
    if (!updated) continue;
    const daysSince = daysBetween(now, updated);
    if (daysSince < 21) continue;
    if (g.progress_percentage >= 80) continue;
    out.push(
      finding({
        patternKey: "goal_drift",
        ventureId: g.venture_id,
        entityRef: `goal:${g.id}`,
        title: `Goal drifting: ${g.title}`,
        summary: `"${g.title}" hasn't moved in ${daysSince} days (at ${g.progress_percentage}%).`,
        priority: g.progress_percentage < 25 ? "high" : "normal",
        confidence: 0.75,
        severity: "warning",
        evidence: {
          refs: [ref("goal", g.id, g.title)],
          metrics: { days_since_update: daysSince, progress: g.progress_percentage },
        },
      }),
    );
  }
  return out;
}

export function detectLongRunningProjects(ds: IntelligenceDataset): DetectorFinding[] {
  const out: DetectorFinding[] = [];
  const now = ds.now;
  const open = new Set(["planned", "in_progress", "at_risk", "blocked"]);
  for (const p of ds.projects) {
    if (p.deleted_at || !open.has(p.status)) continue;
    const created = parseDate(p.created_at);
    if (!created) continue;
    const age = daysBetween(now, created);
    if (age < LONG_RUNNING_DAYS) continue;
    if (p.progress_percentage >= 80) continue;
    out.push(
      finding({
        patternKey: "long_running_project",
        ventureId: p.venture_id,
        entityRef: `project:${p.id}`,
        title: `Long-running project: ${p.name}`,
        summary: `"${p.name}" has been open ${age} days at ${p.progress_percentage}% complete.`,
        priority: age >= 180 ? "high" : "normal",
        confidence: 0.7,
        severity: "warning",
        evidence: {
          refs: [ref("project", p.id, p.name)],
          metrics: { age_days: age, progress: p.progress_percentage },
        },
      }),
    );
  }
  return out;
}

export function detectDecliningCompletionRate(ds: IntelligenceDataset): DetectorFinding[] {
  const now = ds.now;
  const currentStart = new Date(now.getTime() - 30 * 86_400_000);
  const priorStart = new Date(now.getTime() - 60 * 86_400_000);
  let current = 0;
  let prior = 0;
  for (const t of ds.tasks) {
    const d = parseDate(t.completed_at);
    if (!d) continue;
    if (d >= currentStart) current++;
    else if (d >= priorStart) prior++;
  }
  if (prior < 5) return [];
  const delta = (current - prior) / prior;
  if (delta > -0.25) return [];
  return [
    finding({
      patternKey: "declining_completion_rate",
      ventureId: null,
      entityRef: `org:${ds.organizationId}`,
      title: `Completion rate is declining`,
      summary: `Task completions dropped ${Math.round(-delta * 100)}% vs the prior 30 days (${current} vs ${prior}).`,
      priority: delta <= -0.5 ? "high" : "normal",
      confidence: 0.75,
      severity: "warning",
      evidence: {
        refs: [ref("organization", ds.organizationId)],
        metrics: { current, prior, delta: Number(delta.toFixed(3)) },
        window: { start: priorStart.toISOString(), end: now.toISOString() },
      },
    }),
  ];
}

export function detectProjectCreationSpike(ds: IntelligenceDataset): DetectorFinding[] {
  const now = ds.now;
  const monthStart = new Date(now.getTime() - 30 * 86_400_000);
  const created: DsProject[] = [];
  let completed = 0;
  for (const p of ds.projects) {
    const c = parseDate(p.created_at);
    if (c && c >= monthStart) created.push(p);
    if (p.status === "completed") {
      const u = parseDate(p.updated_at);
      if (u && u >= monthStart) completed++;
    }
  }
  if (created.length < 5 || completed >= Math.ceil(created.length / 3)) return [];
  return [
    finding({
      patternKey: "project_creation_spike",
      ventureId: null,
      entityRef: `org:${ds.organizationId}:month`,
      title: `Starting more than you're finishing`,
      summary: `You've created ${created.length} projects this month and completed ${completed}.`,
      priority: "normal",
      confidence: 0.8,
      severity: "warning",
      evidence: {
        refs: created.slice(0, 5).map((p) => ref("project", p.id, p.name)),
        metrics: { created: created.length, completed },
      },
    }),
  ];
}

export function detectKnowledgeConflicts(ds: IntelligenceDataset): DetectorFinding[] {
  const open = ds.memoryConflicts.filter((c) => c.status !== "resolved");
  if (open.length === 0) return [];
  return [
    finding({
      patternKey: "knowledge_conflict",
      ventureId: null,
      entityRef: `org:${ds.organizationId}:conflicts`,
      title: `${open.length} unresolved knowledge conflict${open.length === 1 ? "" : "s"}`,
      summary: `SAM has flagged ${open.length} contradiction${open.length === 1 ? "" : "s"} in what it knows about the business.`,
      priority: open.length >= 3 ? "high" : "normal",
      confidence: 1,
      severity: "warning",
      evidence: {
        refs: open.slice(0, 10).map((c) => ref("knowledge_record", c.id)),
        metrics: { count: open.length },
      },
    }),
  ];
}

export const ALL_DETECTORS: Array<(ds: IntelligenceDataset) => DetectorFinding[]> = [
  detectStalledProjects,
  detectInactiveVentures,
  detectPostponedCommitments,
  detectMissingOwners,
  detectDuplicateProjects,
  detectRepeatedDecisions,
  detectDecisionReversals,
  detectGoalDrift,
  detectLongRunningProjects,
  detectDecliningCompletionRate,
  detectProjectCreationSpike,
  detectKnowledgeConflicts,
];

export function runAllDetectors(ds: IntelligenceDataset): DetectorFinding[] {
  const all: DetectorFinding[] = [];
  for (const d of ALL_DETECTORS) all.push(...d(ds));
  return all;
}

export function orderFindings(findings: DetectorFinding[]): DetectorFinding[] {
  const rank: Record<InsightPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  return [...findings].sort((a, b) => {
    const p = rank[a.priority] - rank[b.priority];
    if (p !== 0) return p;
    return b.confidence - a.confidence;
  });
}

export const PATTERN_KEY_LABELS: Record<PatternKey, string> = {
  stalled_project: "Stalled project",
  inactive_venture: "Inactive venture",
  postponed_commitment: "Repeatedly postponed",
  missing_owner: "Missing owner",
  duplicate_project: "Duplicate work",
  repeated_decision_topic: "Recurring decision",
  decision_reversal: "Decision reversed",
  goal_drift: "Goal drift",
  long_running_project: "Long-running project",
  declining_completion_rate: "Declining completions",
  knowledge_conflict: "Knowledge conflict",
  project_creation_spike: "Overcommitting",
};