// Content normalization utilities. Every connector maps its raw payload
// into this shape before persistence. Pure - no I/O.

import { createHash } from "crypto";
import { INTEGRATION_LIMITS } from "@/lib/constants";
import type { NormalizedContent } from "./types";

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncateContent(text: string, max = INTEGRATION_LIMITS.maxContentTextChars): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export function hashContent(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// Very small extractive summary: first N sentences up to charLimit.
// Deterministic. Real summarization can come later through a provider.
export function shortSummary(text: string, charLimit = 400): string | null {
  if (!text) return null;
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return null;
  const sentences = cleaned.split(/(?<=[.!?])\s+/).slice(0, 6);
  let out = "";
  for (const s of sentences) {
    if ((out + " " + s).trim().length > charLimit) break;
    out = (out ? out + " " : "") + s;
  }
  return out || cleaned.slice(0, charLimit);
}

export function normalizeContent(input: {
  externalId?: string | null;
  canonicalUrl?: string | null;
  title: string;
  rawText?: string | null;
  publishedAt?: string | null;
  modifiedAt?: string | null;
  author?: string | null;
  category?: NormalizedContent["category"];
  tags?: string[];
  metadata?: Record<string, unknown>;
}): NormalizedContent {
  const cleanedText = input.rawText ? truncateContent(normalizeWhitespace(input.rawText)) : null;
  return {
    externalId: input.externalId ?? null,
    canonicalUrl: input.canonicalUrl ?? null,
    title: input.title.trim().slice(0, 500),
    contentText: cleanedText,
    contentSummary: cleanedText ? shortSummary(cleanedText) : null,
    publishedAt: input.publishedAt ?? null,
    modifiedAt: input.modifiedAt ?? null,
    author: input.author ?? null,
    category: input.category ?? null,
    tags: (input.tags ?? []).slice(0, 32),
    metadata: input.metadata ?? {},
  };
}

// Deterministic hash of the normalized content used to detect changes.
export function contentFingerprint(c: NormalizedContent): string {
  const canonical = JSON.stringify({
    title: c.title,
    contentText: c.contentText ?? "",
    canonicalUrl: c.canonicalUrl ?? "",
  });
  return hashContent(canonical);
}