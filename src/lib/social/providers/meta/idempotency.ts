// Deterministic idempotency key derivation. Pure function; identical inputs
// always produce the identical key so duplicate-detection is reliable across
// worker restarts, retries, and callback replays.

import { createHash } from "crypto";

export interface IdempotencyInput {
  organizationId: string;
  contentItemId: string;
  approvedVersionId: string | null;
  destinationExternalId: string;
  provider: "facebook" | "instagram";
  publishGeneration: number;
}

export function deriveIdempotencyKey(input: IdempotencyInput): string {
  const parts = [
    input.organizationId,
    input.contentItemId,
    input.approvedVersionId ?? "no_version",
    input.destinationExternalId,
    input.provider,
    String(input.publishGeneration),
  ];
  const raw = parts.join("|");
  const hash = createHash("sha256").update(raw).digest("hex");
  return `meta_pub_${hash.slice(0, 32)}`;
}
