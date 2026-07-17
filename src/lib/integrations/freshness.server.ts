// Freshness computation for ingested content.
// Pure functions - no I/O. Called by sync engine and SAM context assembly.

import { CONTENT_FRESHNESS_THRESHOLDS } from "@/lib/constants";
import type { ContentFreshnessStatus } from "./types";

export function classifyFreshness(
  lastIngestedAt: string | Date | null,
  now: Date = new Date(),
): ContentFreshnessStatus {
  if (!lastIngestedAt) return "unknown";
  const then = typeof lastIngestedAt === "string" ? new Date(lastIngestedAt) : lastIngestedAt;
  if (Number.isNaN(then.getTime())) return "unknown";

  const ageDays = (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays >= CONTENT_FRESHNESS_THRESHOLDS.staleAfterDays) return "stale";
  if (ageDays >= CONTENT_FRESHNESS_THRESHOLDS.agingAfterDays) return "aging";
  return "fresh";
}

export function markInaccessible(): ContentFreshnessStatus {
  return "inaccessible";
}

// True when SAM should treat this content as safe evidence.
// Unreviewed or stale content is never trusted evidence.
export function isTrustedForEvidence(input: {
  verification: "unverified" | "reviewed" | "verified" | "disputed" | "rejected";
  freshness: ContentFreshnessStatus;
  reviewStatus: string;
}): boolean {
  if (input.verification !== "verified") return false;
  if (input.reviewStatus !== "accepted") return false;
  if (input.freshness === "stale" || input.freshness === "inaccessible") return false;
  return true;
}