// Shared, browser-safe types for the NorthStar Labs client identity model.
// Client roles are deliberately separate from operator org roles and never
// inherit operator permissions.

export const CLIENT_ROLES = ["client_admin", "client_user"] as const;
export type ClientRole = (typeof CLIENT_ROLES)[number];

export type ClientAccountStatus = "active" | "deactivated";

export type PreferredContactMethod = "email" | "phone" | "sms";

export const CLIENT_AUDIT_EVENTS = [
  "client_invited",
  "client_invitation_resent",
  "client_invitation_revoked",
  "client_invitation_accepted",
  "client_login",
  "client_logout",
  "client_profile_updated",
  "client_deactivated",
  "client_reactivated",
  "client_removed",
] as const;
export type ClientAuditEvent = (typeof CLIENT_AUDIT_EVENTS)[number];

export type InvitationState = "pending" | "accepted" | "revoked" | "expired";

export interface ClientAccountSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  preferred_contact_method: PreferredContactMethod;
  role: ClientRole;
  status: ClientAccountStatus;
  last_login_at: string | null;
  created_at: string;
}

export interface ClientInvitationSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: ClientRole;
  state: InvitationState;
  expires_at: string;
  created_at: string;
}

export function roleLabel(role: ClientRole): string {
  return role === "client_admin" ? "Client admin" : "Client user";
}

export function invitationState(row: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): InvitationState {
  if (row.accepted_at) return "accepted";
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

/** Truthful, minimal status text derived from the company record only. */
export function clientStatusCopy(status: string): { status: string; nextStep: string } {
  switch (status) {
    case "prospect":
      return {
        status: "Proposal stage",
        nextStep: "Review and accept your proposal. NorthStar Labs will follow up directly.",
      };
    case "onboarding":
      return {
        status: "Onboarding",
        nextStep: "Complete your setup payments. NorthStar Labs will contact you with next steps.",
      };
    case "active":
      return {
        status: "Active engagement",
        nextStep: "Nothing is required from you right now.",
      };
    case "paused":
      return { status: "Paused", nextStep: "Contact NorthStar Labs to resume work." };
    case "churned":
      return { status: "Closed", nextStep: "This engagement has ended." };
    default:
      return { status: status.replaceAll("_", " "), nextStep: "Contact NorthStar Labs for next steps." };
  }
}