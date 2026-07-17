// Zod schemas + shared types for SAM Memory (Phase 3B).
// See docs/sam/03-memory.md and adr/0010-memory-privacy-scopes.md.

import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const MemoryLayer = z.enum([
  "founder",
  "organization",
  "venture",
  "operational",
  "historical",
  "preference",
]);
export type MemoryLayer = z.infer<typeof MemoryLayer>;

export const MemoryStatus = z.enum([
  "proposed",
  "confirmed",
  "disputed",
  "outdated",
  "superseded",
  "archived",
]);
export type MemoryStatus = z.infer<typeof MemoryStatus>;

export const MemorySourceType = z.enum([
  "manual",
  "profile",
  "organization_settings",
  "venture_settings",
  "knowledge_record",
  "decision",
  "commitment",
  "goal",
  "conversation",
  "correction",
  "proposal",
  "integration",
]);
export type MemorySourceType = z.infer<typeof MemorySourceType>;

export const MemoryConfidenceBand = z.enum(["low", "moderate", "high", "very_high"]);

// Phase 3D.3a - typed memory kind classification (working / episodic /
// semantic / operational / strategic). Nullable  -  legacy rows keep
// their free-text `category` and no `memory_kind`.
export const MemoryKind = z.enum([
  "working",
  "episodic",
  "semantic",
  "operational",
  "strategic",
]);
export type MemoryKind = z.infer<typeof MemoryKind>;

// Personal layers stay private to owner_user_id.
export const PERSONAL_LAYERS: ReadonlySet<MemoryLayer> = new Set(["founder", "preference"]);

// A safe, project-controlled DTO  -  clients never write organization_id / owner_user_id directly.
export const CreateMemoryInput = z.object({
  organizationId: z.string().uuid(),
  layer: MemoryLayer,
  memory_kind: MemoryKind.optional(),
  category: z.string().min(1).max(80),
  title: z.string().min(1).max(140),
  statement: z.string().min(1).max(2000),
  structured_value: z.unknown().optional(),
  ventureId: z.string().uuid().nullable().optional(),
  effective_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  source_type: MemorySourceType.default("manual"),
  source_entity_type: z.string().max(64).nullable().optional(),
  source_entity_id: z.string().uuid().nullable().optional(),
  source_knowledge_record_id: z.string().uuid().nullable().optional(),
  source_conversation_id: z.string().uuid().nullable().optional(),
  source_message_id: z.string().uuid().nullable().optional(),
  confidence_score: z.number().min(0).max(1).nullable().optional(),
  status: MemoryStatus.optional(),
});
export type CreateMemoryInput = z.infer<typeof CreateMemoryInput>;

export const UpdateMemoryInput = z.object({
  organizationId: z.string().uuid(),
  id: z.string().uuid(),
  patch: z.object({
    title: z.string().min(1).max(140).optional(),
    statement: z.string().min(1).max(2000).optional(),
    category: z.string().min(1).max(80).optional(),
    memory_kind: MemoryKind.nullable().optional(),
    structured_value: z.unknown().optional(),
    effective_at: z.string().datetime().nullable().optional(),
    expires_at: z.string().datetime().nullable().optional(),
    confidence_score: z.number().min(0).max(1).nullable().optional(),
  }),
  change_reason: z.string().max(400).optional(),
});
export type UpdateMemoryInput = z.infer<typeof UpdateMemoryInput>;

// Phase 3D.3a - explicit "replace with a newer truth" flow. Marks the old
// row `superseded` + sets `superseded_by`, and inserts a fresh row that
// carries the corrected values. History is preserved (never deleted).
export const SupersedeMemoryInput = z.object({
  organizationId: z.string().uuid(),
  id: z.string().uuid(),
  replacement: z.object({
    title: z.string().min(1).max(140),
    statement: z.string().min(1).max(2000),
    category: z.string().min(1).max(80).optional(),
    memory_kind: MemoryKind.optional(),
    structured_value: z.unknown().optional(),
    confidence_score: z.number().min(0).max(1).optional(),
    effective_at: z.string().datetime().nullable().optional(),
    expires_at: z.string().datetime().nullable().optional(),
  }),
  change_reason: z.string().max(400).optional(),
});
export type SupersedeMemoryInput = z.infer<typeof SupersedeMemoryInput>;

export type MemoryItemRow = Database["public"]["Tables"]["sam_memory_items"]["Row"];
export type MemoryVersionRow = Database["public"]["Tables"]["sam_memory_versions"]["Row"];
export type MemoryFeedbackRow = Database["public"]["Tables"]["sam_memory_feedback"]["Row"];
export type MemoryConflictRow = Database["public"]["Tables"]["sam_memory_conflicts"]["Row"];
export type GraphEdgeRow = Database["public"]["Tables"]["executive_graph_edges"]["Row"];
export type LearningEventRow = Database["public"]["Tables"]["sam_learning_events"]["Row"];

export function bandForScore(score: number | null | undefined): z.infer<typeof MemoryConfidenceBand> {
  const s = score ?? 0;
  if (s >= 0.85) return "very_high";
  if (s >= 0.65) return "high";
  if (s >= 0.4) return "moderate";
  return "low";
}