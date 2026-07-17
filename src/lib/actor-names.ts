import type { Profile } from "./data-hooks";

/** Prefer preferred_name → full_name → email → "System". Never expose IDs. */
export function actorName(
  p: Pick<Profile, "preferred_name" | "full_name" | "email"> | null | undefined,
): string {
  if (!p) return "System";
  return (
    p.preferred_name?.trim() ||
    p.full_name?.trim() ||
    p.email?.trim() ||
    "System"
  );
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}