// Shared AES-256-GCM encryption for at-rest integration secrets.
//
// Server-only. Reuses SUPABASE_SERVICE_ROLE_KEY as key material via SHA-256
// derivation - matches the pattern already used for Meta page tokens.
// Ciphertext layout: base64( iv(12) || tag(16) || cipher ).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function deriveKey(purpose: string): Buffer {
  const material = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!material) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set - cannot encrypt integration secret");
  return createHash("sha256").update(`${purpose}:${material}`).digest();
}

export function encryptSecret(plaintext: string, purpose = "integration_secret_v1"): string {
  const key = deriveKey(purpose);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(ciphertext: string, purpose = "integration_secret_v1"): string {
  const key = deriveKey(purpose);
  const raw = Buffer.from(ciphertext, "base64");
  if (raw.length < 12 + 16 + 1) throw new Error("integration_secret_ciphertext_too_short");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// HMAC-SHA256 signature for outbound webhook payloads.
export function signPayload(secret: string, body: string): string {
  const { createHmac } = require("node:crypto") as typeof import("node:crypto");
  return createHmac("sha256", secret).update(body).digest("hex");
}