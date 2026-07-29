export const CLIENT_IDENTITY_ERRORS = [
  "invitation_invalid",
  "invitation_expired",
  "invitation_revoked",
  "invitation_accepted",
  "email_in_use",
  "client_not_found",
  "account_not_found",
  "permission_denied",
  "invalid_input",
  "internal_error",
] as const;
export type ClientIdentityErrorCode = (typeof CLIENT_IDENTITY_ERRORS)[number];

export class ClientIdentityError extends Error {
  readonly code: ClientIdentityErrorCode;
  constructor(code: ClientIdentityErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ClientIdentityError";
    this.code = code;
  }
}

export function toClientIdentityCode(err: unknown): ClientIdentityErrorCode {
  return err instanceof ClientIdentityError ? err.code : "internal_error";
}

export const CLIENT_ERROR_COPY: Record<ClientIdentityErrorCode, string> = {
  invitation_invalid: "This invitation link is not valid.",
  invitation_expired: "This invitation has expired. Ask NorthStar Labs to resend it.",
  invitation_revoked: "This invitation was revoked. Ask NorthStar Labs to resend it.",
  invitation_accepted: "This invitation has already been used. Sign in instead.",
  email_in_use: "An account already exists for this email. Sign in instead.",
  client_not_found: "We could not find this company record.",
  account_not_found: "We could not find your account.",
  permission_denied: "You do not have access to this.",
  invalid_input: "Please check the details you entered.",
  internal_error: "Something went wrong. Please try again.",
};