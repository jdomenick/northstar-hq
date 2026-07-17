import type { Membership } from "./org-context";

export type Role = Membership["role"];

const RANK: Record<Role, number> = {
  viewer: 0,
  member: 1,
  executive: 2,
  admin: 3,
  owner: 4,
};

export function atLeast(role: Role | undefined | null, min: Role): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

/**
 * UI-level capability checks. These are hints only —
 * RLS is the actual enforcement layer.
 */
export const can = {
  writeContent: (role?: Role | null) => atLeast(role, "member"),
  archiveContent: (role?: Role | null) => atLeast(role, "executive"),
  manageOrg: (role?: Role | null) => atLeast(role, "admin"),
  manageMembers: (role?: Role | null) => atLeast(role, "admin"),
};