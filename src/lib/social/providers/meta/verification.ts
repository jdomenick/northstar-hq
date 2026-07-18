// Verification state machine transitions. Pure - callers wire persistence.

export type VerificationState =
  | "not_started"
  | "pending"
  | "attempted"
  | "verified"
  | "delayed"
  | "failed";

export interface VerificationTransitionInput {
  currentState: VerificationState;
  attemptCount: number;
  providerReturnedPost: boolean;
  contentChecksumMatches: boolean;
  networkError: boolean;
  maxAttempts: number;
}

export interface VerificationTransition {
  nextState: VerificationState;
  shouldRetry: boolean;
  retryAfterSeconds: number | null;
}

export function nextVerificationState(input: VerificationTransitionInput): VerificationTransition {
  if (input.networkError && input.attemptCount < input.maxAttempts) {
    return { nextState: "delayed", shouldRetry: true, retryAfterSeconds: 60 };
  }
  if (!input.providerReturnedPost && input.attemptCount < input.maxAttempts) {
    return { nextState: "delayed", shouldRetry: true, retryAfterSeconds: 30 };
  }
  if (!input.providerReturnedPost) {
    return { nextState: "failed", shouldRetry: false, retryAfterSeconds: null };
  }
  if (!input.contentChecksumMatches) {
    return { nextState: "failed", shouldRetry: false, retryAfterSeconds: null };
  }
  return { nextState: "verified", shouldRetry: false, retryAfterSeconds: null };
}
