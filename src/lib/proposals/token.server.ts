// Public proposal token helpers. The raw token is only returned once (in the
// sendProposal response). The DB stores only the SHA-256 hex hash.

import { createHash, randomBytes } from "crypto";

export function generateToken(): { token: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  return { token: raw, hash: hashToken(raw) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}