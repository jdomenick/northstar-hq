/**
 * Only http(s) URLs may ever reach an anchor href. Anything else (javascript:,
 * data:, vbscript:, relative junk) resolves to null so callers render plain text.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
