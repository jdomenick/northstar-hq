// Contracts for social Job Engine handlers. Handlers do NOT execute in this
// milestone. Every social job type remains registered as `not_implemented`
// in src/lib/automation/registry.server.ts and returns `job_not_implemented`
// when a worker attempts to run it.
//
// Future pipelines (documented for planning; not enqueued):
//   Content Pipeline:      social_content_plan -> social_content_generate -> social_content_review -> social_publish
//   Performance Pipeline:  social_metrics_sync -> social_performance_analysis -> social_content_repurpose
//   Engagement Pipeline:   social_comment_monitor -> social_engagement_summary
//
// social_publish additionally requires:
//   - organization publishing_master_switch = true
//   - organization emergency_stop = false
//   - venture publishing_enabled = true, paused = false
//   - account publishing_enabled = true, connection_status = 'connected'
//   - approved content whose approved_content_version = content_version
//   - active brand profile
//   - server-verified credential + granted scopes
//   - idempotency: (organization_id, idempotency_key) unique among active attempts
//   - creates external side effects; replays require human confirmation
//
// None of these gates are provider-controllable.

export const SOCIAL_JOB_TYPES = [
  "social_content_plan","social_content_generate","social_content_review",
  "social_publish","social_metrics_sync","social_performance_analysis",
  "social_content_repurpose","social_comment_monitor","social_engagement_summary",
] as const;
export type SocialJobType = (typeof SOCIAL_JOB_TYPES)[number];

export interface SocialJobContract {
  key: SocialJobType;
  createsExternalSideEffects: boolean;
  mayRequireApproval: boolean;
  requiresConnector: boolean;
  requiresApproval: boolean;
  requiresMasterSwitch: boolean;
  requiresEmergencyStopOff: boolean;
}

export const SOCIAL_JOB_CONTRACTS: Record<SocialJobType, SocialJobContract> = {
  social_content_plan:         { key: "social_content_plan",         createsExternalSideEffects: false, mayRequireApproval: true,  requiresConnector: false, requiresApproval: false, requiresMasterSwitch: false, requiresEmergencyStopOff: true  },
  social_content_generate:     { key: "social_content_generate",     createsExternalSideEffects: false, mayRequireApproval: true,  requiresConnector: false, requiresApproval: false, requiresMasterSwitch: false, requiresEmergencyStopOff: true  },
  social_content_review:       { key: "social_content_review",       createsExternalSideEffects: false, mayRequireApproval: true,  requiresConnector: false, requiresApproval: false, requiresMasterSwitch: false, requiresEmergencyStopOff: true  },
  social_publish:              { key: "social_publish",               createsExternalSideEffects: true,  mayRequireApproval: true,  requiresConnector: true,  requiresApproval: true,  requiresMasterSwitch: true,  requiresEmergencyStopOff: true  },
  social_metrics_sync:         { key: "social_metrics_sync",         createsExternalSideEffects: false, mayRequireApproval: false, requiresConnector: true,  requiresApproval: false, requiresMasterSwitch: false, requiresEmergencyStopOff: false },
  social_performance_analysis: { key: "social_performance_analysis", createsExternalSideEffects: false, mayRequireApproval: false, requiresConnector: false, requiresApproval: false, requiresMasterSwitch: false, requiresEmergencyStopOff: false },
  social_content_repurpose:    { key: "social_content_repurpose",    createsExternalSideEffects: false, mayRequireApproval: true,  requiresConnector: false, requiresApproval: false, requiresMasterSwitch: false, requiresEmergencyStopOff: true  },
  social_comment_monitor:      { key: "social_comment_monitor",      createsExternalSideEffects: false, mayRequireApproval: false, requiresConnector: true,  requiresApproval: false, requiresMasterSwitch: false, requiresEmergencyStopOff: false },
  social_engagement_summary:   { key: "social_engagement_summary",   createsExternalSideEffects: false, mayRequireApproval: false, requiresConnector: false, requiresApproval: false, requiresMasterSwitch: false, requiresEmergencyStopOff: false },
};