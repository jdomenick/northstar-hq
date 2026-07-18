// AES-256-GCM encryption/decryption for Page tokens at rest.
// Key material derives from SUPABASE_SERVICE_ROLE_KEY - never exposed
// to the browser. Ciphertext format: base64( iv(12) || tag(16) || cipher ).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getMetaConfig } from "./config.server";

function deriveKey(): Buffer {
  const cfg = getMetaConfig();
  return createHash("sha256").update(`meta_page_token_v1:${cfg.encryptionKey}`).digest();
}

export function encryptPageToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptPageToken(ciphertext: string): string {
  const key = deriveKey();
  const raw = Buffer.from(ciphertext, "base64");
  if (raw.length < 12 + 16 + 1) throw new Error("meta_token_ciphertext_too_short");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
