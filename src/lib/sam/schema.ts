import { z } from "zod";

export const CitationEntityType = z.enum([
  "venture",
  "project",
  "task",
  "goal",
  "decision",
  "commitment",
  "knowledge_record",
  "document",
  "activity_event",
]);

export const CitationKind = z.enum(["direct", "supporting", "assumption", "inference"]);

export const CitationSchema = z.object({
  kind: CitationKind,
  entity_type: CitationEntityType,
  entity_id: z.string(),
  title: z.string().nullable(),
  relevance: z.string().nullable(),
});

export const UnsupportedActionSchema = z.object({
  requested_action: z.string(),
  reason: z.string(),
  suggested_manual_path: z.string().nullable(),
});

// Executive response contract — see docs/sam/04-reasoning.md.
export const SamResponseSchema = z.object({
  answer: z.string(),
  executive_summary: z.string().nullable(),
  observations: z.array(z.string()),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
  recommendations: z.array(z.string()),
  missing_information: z.array(z.string()),
  assumptions: z.array(z.string()),
  next_question: z.string().nullable(),
  model_confidence_hint: z.enum(["low", "moderate", "high", "very_high"]).nullable(),
  citations: z.array(CitationSchema),
  unsupported_action: UnsupportedActionSchema.nullable(),
});

export type SamResponse = z.infer<typeof SamResponseSchema>;
export type SamCitation = z.infer<typeof CitationSchema>;