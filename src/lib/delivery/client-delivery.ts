// Browser-safe delivery model for the NorthStar Labs client workspace.
// Pure data shapes and resolvers. No data access happens here, so both the
// client route and the operator route share exactly one interpretation of
// delivery state.

export const DELIVERY_STAGES = [
  "preparation",
  "setup",
  "configuration",
  "review",
  "launch",
  "optimization",
  "complete",
] as const;
export type DeliveryStage = (typeof DELIVERY_STAGES)[number];

export const DELIVERY_STAGE_LABEL: Record<DeliveryStage, string> = {
  preparation: "Preparation",
  setup: "Setup",
  configuration: "Configuration",
  review: "Review",
  launch: "Launch",
  optimization: "Optimization",
  complete: "Complete",
};

export const MILESTONE_STATUSES = [
  "upcoming",
  "in_progress",
  "waiting_on_client",
  "under_review",
  "complete",
  "skipped",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  upcoming: "Not started",
  in_progress: "In progress",
  waiting_on_client: "Waiting on you",
  under_review: "Under review",
  complete: "Complete",
  skipped: "Not applicable",
};

export const DELIVERABLE_STATUSES = [
  "preparing",
  "ready_for_review",
  "revision_requested",
  "approved",
  "final",
] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  preparing: "Being prepared",
  ready_for_review: "Ready for your review",
  revision_requested: "Revision requested",
  approved: "Approved by you",
  final: "Final",
};

export type DeliveryHealth =
  | "not_started"
  | "on_track"
  | "waiting_on_client"
  | "at_risk"
  | "blocked"
  | "complete";

export const DELIVERY_HEALTH_LABEL: Record<DeliveryHealth, string> = {
  not_started: "Not started",
  on_track: "On track",
  waiting_on_client: "Waiting on you",
  at_risk: "At risk",
  blocked: "Blocked",
  complete: "Complete",
};

export interface ClientMilestone {
  id: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  target_date: string | null;
  completed_at: string | null;
  requires_client_action: boolean;
  sort_order: number;
}

export interface ClientDeliverable {
  id: string;
  title: string;
  instructions: string;
  version_label: string;
  status: DeliverableStatus;
  requires_client_review: boolean;
  milestone_id: string | null;
  file_name: string | null;
  has_file: boolean;
  shared_at: string | null;
  approved_at: string | null;
  revision_reason: string;
}

export interface ClientDeliveryProject {
  id: string;
  title: string;
  summary: string;
  stage: DeliveryStage;
  stage_label: string;
  health: DeliveryHealth;
  next_action: string;
  started_at: string | null;
  completed_at: string | null;
}

export type DeliveryAction = "review_deliverable" | "complete_milestone" | "wait" | "none";

export interface DeliveryNextStep {
  headline: string;
  detail: string;
  action: DeliveryAction;
  deliverable_id: string | null;
  milestone_id: string | null;
}

export interface DeliveryProgress {
  total: number;
  complete: number;
  /** Null when there is nothing to measure. We never invent a percentage. */
  percent: number | null;
}

export interface ClientDeliveryView {
  project: ClientDeliveryProject | null;
  milestones: ClientMilestone[];
  deliverables: ClientDeliverable[];
  next_step: DeliveryNextStep;
  progress: DeliveryProgress;
}

export function isDeliveryStage(value: string): value is DeliveryStage {
  return (DELIVERY_STAGES as readonly string[]).includes(value);
}

export function isMilestoneStatus(value: string): value is MilestoneStatus {
  return (MILESTONE_STATUSES as readonly string[]).includes(value);
}

export function isDeliverableStatus(value: string): value is DeliverableStatus {
  return (DELIVERABLE_STATUSES as readonly string[]).includes(value);
}

/** Progress is counted from milestones only. No milestones means no number. */
export function deliveryProgress(milestones: ClientMilestone[]): DeliveryProgress {
  const counted = milestones.filter((m) => m.status !== "skipped");
  if (counted.length === 0) return { total: 0, complete: 0, percent: null };
  const complete = counted.filter((m) => m.status === "complete").length;
  return {
    total: counted.length,
    complete,
    percent: Math.round((complete / counted.length) * 100),
  };
}

/**
 * Health is derived, never stored. Internal project status drives risk and
 * outstanding client work drives the waiting state.
 */
export function resolveDeliveryHealth(input: {
  projectStatus: string;
  stage: DeliveryStage;
  milestones: ClientMilestone[];
  deliverables: ClientDeliverable[];
}): DeliveryHealth {
  const { projectStatus, stage, milestones, deliverables } = input;
  if (projectStatus === "blocked") return "blocked";
  if (projectStatus === "at_risk") return "at_risk";
  if (projectStatus === "completed" || stage === "complete") return "complete";

  const waiting =
    milestones.some((m) => m.status === "waiting_on_client") ||
    deliverables.some((d) => d.requires_client_review && d.status === "ready_for_review");
  if (waiting) return "waiting_on_client";

  const started =
    projectStatus === "active" ||
    milestones.some((m) => m.status !== "upcoming" && m.status !== "skipped");
  return started ? "on_track" : "not_started";
}

const WAIT_STEP: DeliveryNextStep = {
  headline: "Nothing is needed from you right now",
  detail:
    "NorthStar Labs is working on the next step. We will post here when something needs you.",
  action: "wait",
  deliverable_id: null,
  milestone_id: null,
};

/** Exactly one next step. Client actions always outrank informational states. */
export function resolveDeliveryNextStep(input: {
  project: Omit<ClientDeliveryProject, "health"> | null;
  health: DeliveryHealth;
  milestones: ClientMilestone[];
  deliverables: ClientDeliverable[];
}): DeliveryNextStep {
  const { project, health, milestones, deliverables } = input;
  if (!project) {
    return {
      headline: "Delivery has not started yet",
      detail:
        "Your implementation appears here as soon as NorthStar Labs opens it. Finishing onboarding moves this forward.",
      action: "none",
      deliverable_id: null,
      milestone_id: null,
    };
  }

  const review = deliverables.find(
    (d) => d.requires_client_review && d.status === "ready_for_review",
  );
  if (review) {
    return {
      headline: `Review "${review.title}"`,
      detail: "Approve it or request a revision so implementation can continue.",
      action: "review_deliverable",
      deliverable_id: review.id,
      milestone_id: null,
    };
  }

  const waiting = milestones.find((m) => m.status === "waiting_on_client");
  if (waiting) {
    return {
      headline: waiting.title,
      detail:
        waiting.description.trim() ||
        "This milestone is waiting on you. Contact NorthStar Labs if you are unsure what is needed.",
      action: "complete_milestone",
      deliverable_id: null,
      milestone_id: waiting.id,
    };
  }

  if (health === "complete") {
    return {
      headline: "Delivery is complete",
      detail: "Your implementation is live. Ongoing work appears in your activity feed.",
      action: "none",
      deliverable_id: null,
      milestone_id: null,
    };
  }

  if (health === "blocked" || health === "at_risk") {
    return {
      headline: health === "blocked" ? "Delivery is currently blocked" : "Delivery is at risk",
      detail:
        project.next_action.trim() ||
        "NorthStar Labs is working the issue and will update you here.",
      action: "wait",
      deliverable_id: null,
      milestone_id: null,
    };
  }

  if (project.next_action.trim()) {
    return { ...WAIT_STEP, detail: project.next_action.trim() };
  }
  return WAIT_STEP;
}

export function stageLabelFor(stage: DeliveryStage, customLabel: string): string {
  const trimmed = customLabel.trim();
  return trimmed.length > 0 ? trimmed : DELIVERY_STAGE_LABEL[stage];
}