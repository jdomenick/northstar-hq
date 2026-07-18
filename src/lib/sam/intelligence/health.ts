// Pure Executive Health scoring. Deterministic, versioned, no I/O.

import {
  HEALTH_METHOD_VERSION,
  HEALTH_WEIGHTS_V1,
  type HealthCategoryScore,
  type HealthReport,
} from "./types";
import type { IntelligenceDataset } from "./detectors";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cat(score: number, inputs: Record<string, number>, method: string): HealthCategoryScore {
  return { score: clamp01(score), inputs, method };
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function variance(nums: number[]): number {
  if (nums.length === 0) return 0;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length;
}

export function computeHealth(ds: IntelligenceDataset): HealthReport {
  const now = ds.now;
  const windowStart = new Date(now.getTime() - 30 * 86_400_000);

  // Execution: task completion rate over 30d
  let completed30 = 0;
  let opened30 = 0;
  for (const t of ds.tasks) {
    const created = toDate(t.created_at);
    const done = toDate(t.completed_at);
    if (created && created >= windowStart) opened30++;
    if (done && done >= windowStart) completed30++;
  }
  const executionRate = opened30 === 0 ? (completed30 > 0 ? 1 : 0.5) : clamp01(completed30 / Math.max(opened30, completed30));
  const execution = cat(executionRate, { completed_30d: completed30, opened_30d: opened30 }, "task_completion_ratio_v1");

  // Decision velocity: median days open (inverse)
  const openDurations: number[] = [];
  for (const d of ds.decisions) {
    if (d.deleted_at) continue;
    if (d.status === "final" || d.status === "superseded" || d.status === "cancelled") continue;
    const c = toDate(d.created_at);
    if (!c) continue;
    openDurations.push(daysBetween(now, c));
  }
  const medDays = median(openDurations);
  const velocity = openDurations.length === 0 ? 0.75 : clamp01(1 - Math.min(1, medDays / 30));
  const decision_velocity = cat(velocity, { open_decisions: openDurations.length, median_days_open: Number(medDays.toFixed(1)) }, "inverse_median_days_open_v1");

  // Project health: share not blocked/at_risk
  const openProjects = ds.projects.filter(
    (p) => !p.deleted_at && p.status !== "completed" && p.status !== "cancelled",
  );
  const unhealthy = openProjects.filter((p) => p.status === "at_risk" || p.status === "blocked").length;
  const projectHealth = openProjects.length === 0 ? 1 : clamp01(1 - unhealthy / openProjects.length);
  const project_health = cat(projectHealth, { open: openProjects.length, unhealthy }, "share_healthy_v1");

  // Knowledge freshness: share of memory conflicts resolved (proxy)
  const totalC = ds.memoryConflicts.length;
  const resolvedC = ds.memoryConflicts.filter((c) => c.status === "resolved").length;
  const freshness = totalC === 0 ? 0.85 : clamp01(resolvedC / totalC);
  const knowledge_freshness = cat(freshness, { conflicts: totalC, resolved: resolvedC }, "conflict_resolution_ratio_v1");

  // Commitment completion: share on-time in last 90d
  const cWindow = new Date(now.getTime() - 90 * 86_400_000);
  let completedInWindow = 0;
  let onTime = 0;
  for (const c of ds.commitments) {
    const done = toDate(c.completed_at);
    if (!done || done < cWindow) continue;
    completedInWindow++;
    const due = toDate(c.due_date);
    if (!due || done <= due) onTime++;
  }
  const completion = completedInWindow === 0 ? 0.5 : clamp01(onTime / completedInWindow);
  const commitment_completion = cat(completion, { completed_90d: completedInWindow, on_time: onTime }, "on_time_ratio_v1");

  // Goal progress: share of active goals with progress > 0 or recent update
  const activeGoals = ds.goals.filter((g) => g.status === "active" || g.status === "in_progress");
  const goalsMoving = activeGoals.filter((g) => g.progress_percentage > 0).length;
  const goalProgress = activeGoals.length === 0 ? 0.5 : clamp01(goalsMoving / activeGoals.length);
  const goal_progress = cat(goalProgress, { active: activeGoals.length, moving: goalsMoving }, "share_moving_v1");

  // Consistency: inverse of daily activity variance (30d)
  const dayBuckets = new Map<string, number>();
  for (const a of ds.activity) {
    const d = toDate(a.created_at);
    if (!d || d < windowStart) continue;
    const key = d.toISOString().slice(0, 10);
    dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
  }
  const counts = Array.from(dayBuckets.values());
  const mean = counts.length === 0 ? 0 : counts.reduce((a, b) => a + b, 0) / counts.length;
  const varVal = variance(counts);
  const cv = mean === 0 ? 1 : Math.sqrt(varVal) / mean; // coefficient of variation
  const consistency = clamp01(1 - Math.min(1, cv / 2));
  const consistencyCat = cat(consistency, { active_days: counts.length, mean: Number(mean.toFixed(2)), cv: Number(cv.toFixed(2)) }, "inverse_cv_v1");

  const categories = {
    execution,
    decision_velocity,
    project_health,
    knowledge_freshness,
    commitment_completion,
    goal_progress,
    consistency: consistencyCat,
  };

  const overall = clamp01(
    HEALTH_WEIGHTS_V1.execution * execution.score +
      HEALTH_WEIGHTS_V1.decision_velocity * decision_velocity.score +
      HEALTH_WEIGHTS_V1.project_health * project_health.score +
      HEALTH_WEIGHTS_V1.knowledge_freshness * knowledge_freshness.score +
      HEALTH_WEIGHTS_V1.commitment_completion * commitment_completion.score +
      HEALTH_WEIGHTS_V1.goal_progress * goal_progress.score +
      HEALTH_WEIGHTS_V1.consistency * consistencyCat.score,
  );

  return {
    overall,
    categories,
    methodVersion: HEALTH_METHOD_VERSION,
    computedAt: now.toISOString(),
    inputs: {
      projects_open: openProjects.length,
      commitments_completed_90d: completedInWindow,
      goals_active: activeGoals.length,
      activity_days_30d: counts.length,
    },
  };
}

export function healthBand(score: number): "very_high" | "high" | "moderate" | "low" {
  if (score >= 0.85) return "very_high";
  if (score >= 0.65) return "high";
  if (score >= 0.4) return "moderate";
  return "low";
}