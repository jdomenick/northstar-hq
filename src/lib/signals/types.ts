// Signal abstraction. Signals are meaningful observations produced by
// Assets/Integrations. They are NOT Knowledge - they are evidence that may
// later be promoted into Knowledge by the Intelligence Center.

import type { SignalSeverity, SignalType } from "@/lib/constants";

export interface SignalDescriptor {
  id: string;
  organizationId: string;
  ventureId: string | null;
  assetId: string | null;
  connectionId: string | null;
  sourceId: string | null;
  contentItemId: string | null;
  signalType: SignalType | string;
  severity: SignalSeverity;
  title: string;
  description: string | null;
  significance: "none" | "minor" | "moderate" | "major" | null;
  status:
    | "new"
    | "triaged"
    | "acknowledged"
    | "resolved"
    | "dismissed"
    | "converted_to_knowledge";
  dedupKey: string | null;
  occurredAt: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

// Deterministic dedup key builder so repeat detections collapse into one row.
export function buildSignalDedupKey(parts: {
  organizationId: string;
  signalType: string;
  assetId?: string | null;
  contentItemId?: string | null;
  fingerprint?: string | null;
}): string {
  return [
    parts.organizationId,
    parts.signalType,
    parts.assetId ?? "-",
    parts.contentItemId ?? "-",
    parts.fingerprint ?? "-",
  ].join("|");
}