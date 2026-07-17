// Media requirement contracts. Deterministic; no live media generation.

import { z } from "zod";

export const SocialMediaRequirementSchema = z.object({
  kind: z.enum(["image","video","carousel","thumbnail","other"]),
  aspectRatio: z.string().max(16).optional(),
  minWidth: z.number().int().positive().optional(),
  minHeight: z.number().int().positive().optional(),
  maxBytes: z.number().int().positive().optional(),
  altText: z.string().max(1000).optional(),
  caption: z.string().max(1000).optional(),
  reference: z.string().max(200).optional(),
}).strict();
export type SocialMediaRequirement = z.infer<typeof SocialMediaRequirementSchema>;