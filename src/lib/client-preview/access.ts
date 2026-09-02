/**
 * Access rule for the internal "View as client" preview.
 *
 * This is preview only. It never changes the operator's session, never creates
 * a client account, and never grants the operator client-side write paths.
 * Only active organization admins and owners may open it.
 */
export type PreviewOrgRole = "viewer" | "member" | "executive" | "admin" | "owner";

export const PREVIEW_ALLOWED_ROLES: readonly PreviewOrgRole[] = ["admin", "owner"];

export function canPreviewAsClient(
  role: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (status !== "active") return false;
  if (!role) return false;
  return (PREVIEW_ALLOWED_ROLES as readonly string[]).includes(role);
}
