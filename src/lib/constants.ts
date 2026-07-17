// Reusable operational constants for Northstar.
export const STALLED_PROJECT_DAYS = 7;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "image/png",
  "image/jpeg",
  "image/webp",
];

// Centralized query and pagination limits.
export const LIMITS = {
  primaryList: 25,
  activityFeed: 20,
  searchPerCategory: 10,
  archivedList: 25,
  memberList: 50,
  sam: {
    maxMessageChars: 4000,
    maxHistoryMessages: 16,
    maxContextPerType: 12,
    maxResponseChars: 16000,
    perOrgPerDay: 200,
    perUserPerDay: 100,
  },
} as const;

// Debounce (ms) for typing-driven queries such as global search.
export const SEARCH_DEBOUNCE_MS = 200;

// ─────────────────────────────────────────────────────────────
// SAM framework version constants (Phase 3B)
// Stamped into audit rows so every invocation is reproducible.
// ─────────────────────────────────────────────────────────────
export const MEMORY_FRAMEWORK_VERSION = "sam.memory.v1.0.0";
export const MEMORY_PRECEDENCE_VERSION = "sam.memory.precedence.v1";
export const MEMORY_DECAY_VERSION = "sam.memory.decay.v1";
export const EXECUTIVE_GRAPH_VERSION = "sam.graph.v1.0.0";
export const GRAPH_TRAVERSAL_VERSION = "sam.graph.traversal.v1";
export const LEARNING_EVENT_SCHEMA_VERSION = "sam.learning.v1";
export const RESPONSE_FEEDBACK_VERSION = "sam.feedback.v1";
export const CONFIDENCE_FRAMEWORK_VERSION = "sam.confidence.v2";

export const SAM_MEMORY_LIMITS = {
  maxListPage: 100,
  maxProposalsPage: 50,
  maxContextPerLayer: 8,
  maxVersionHistory: 50,
  maxLearningEvents: 100,
  maxConflictsPerRun: 25,
} as const;

export const SAM_GRAPH_LIMITS = {
  maxDepth: 3,
  maxNodes: 200,
  maxEdges: 500,
  maxNeighbors: 50,
} as const;