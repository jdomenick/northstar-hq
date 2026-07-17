// Content lineage contract. Bounded references only; no full source
// documents, no raw provider prompts, no hidden reasoning.

import { z } from "zod";
import { SOCIAL_LIMITS } from "@/lib/constants";

export const SOCIAL_LINEAGE_SOURCE_TYPES = [
  "knowledge","signal","website_content","document","product","service",
  "offer","event","campaign","brand_profile","approved_content",
  "performance_summary","venture_profile","goal","user_input",
] as const;
export type SocialLineageSourceType = (typeof SOCIAL_LINEAGE_SOURCE_TYPES)[number];

export const SocialLineageRefSchema = z.object({
  sourceType: z.enum(SOCIAL_LINEAGE_SOURCE_TYPES),
  sourceId: z.string().min(1).max(200),
  sourceVersion: z.string().max(64).nullable().optional(),
  sourceHash: z.string().max(128).nullable().optional(),
  boundedExcerpt: z.string().max(2000).nullable().optional(),
  relevance: z.number().min(0).max(1).nullable().optional(),
  addedBy: z.string().max(64),
  addedAt: z.string().datetime(),
}).strict();
export type SocialLineageRef = z.infer<typeof SocialLineageRefSchema>;

export const SocialLineageArraySchema = z.array(SocialLineageRefSchema)
  .max(SOCIAL_LIMITS.maxLineageReferences);