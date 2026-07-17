// Pure helpers to construct typed OperationResult values. Kept dependency-free
// so tests and ops modules can share them.

import type {
  AffectedRecord,
  BlockedReasonCode,
  FailedReasonCode,
  OperationBlocked,
  OperationFailed,
  OperationResult,
  OperationSuccess,
  SamOperationName,
} from "./types";
import { SAM_OPERATIONS_VERSION } from "./types";

export interface BaseResultArgs {
  operation: SamOperationName;
  organizationId: string;
  ventureId?: string | null;
  actorUserId: string;
  affectedRecords?: AffectedRecord[];
  startedAt?: number;
  recommendedNextAction?: string;
}

function elapsed(startedAt?: number) {
  if (typeof startedAt !== "number") return 0;
  return Math.max(0, Date.now() - startedAt);
}

export function success<T extends Record<string, unknown>>(
  args: BaseResultArgs & { summary: string; data: T },
): OperationSuccess<T> {
  return {
    operation: args.operation,
    version: SAM_OPERATIONS_VERSION,
    organizationId: args.organizationId,
    ventureId: args.ventureId ?? null,
    actorUserId: args.actorUserId,
    status: "success",
    summary: args.summary,
    recommendedNextAction: args.recommendedNextAction,
    affectedRecords: args.affectedRecords ?? [],
    durationMs: elapsed(args.startedAt),
    data: args.data,
  };
}

export function blocked(
  args: BaseResultArgs & {
    summary: string;
    reasonCode: BlockedReasonCode;
    detail?: Record<string, string | number | boolean | null>;
    actionRoute?: string | null;
  },
): OperationBlocked {
  return {
    operation: args.operation,
    version: SAM_OPERATIONS_VERSION,
    organizationId: args.organizationId,
    ventureId: args.ventureId ?? null,
    actorUserId: args.actorUserId,
    status: "blocked",
    summary: args.summary,
    reasonCode: args.reasonCode,
    detail: args.detail ?? {},
    actionRoute: args.actionRoute ?? null,
    recommendedNextAction: args.recommendedNextAction,
    affectedRecords: args.affectedRecords ?? [],
    durationMs: elapsed(args.startedAt),
  };
}

export function failed(
  args: BaseResultArgs & { message: string; reasonCode: FailedReasonCode },
): OperationFailed {
  return {
    operation: args.operation,
    version: SAM_OPERATIONS_VERSION,
    organizationId: args.organizationId,
    ventureId: args.ventureId ?? null,
    actorUserId: args.actorUserId,
    status: "failed",
    summary: args.message,
    reasonCode: args.reasonCode,
    message: args.message,
    recommendedNextAction: args.recommendedNextAction,
    affectedRecords: args.affectedRecords ?? [],
    durationMs: elapsed(args.startedAt),
  };
}

/** Sanitize an arbitrary thrown value into a `failed` result. Never leaks
 *  stack traces, DB messages, or provider payloads to the caller. */
export function fromThrown(
  base: BaseResultArgs,
  err: unknown,
): OperationResult {
  const code = ((): FailedReasonCode => {
    const c = (err as { code?: unknown })?.code;
    if (typeof c !== "string") return "server_error";
    if (c === "forbidden") return "unauthorized";
    if (c === "not_found") return "not_found";
    if (c === "invalid_input") return "invalid_input";
    if (c === "invalid_transition" || c === "conflict") return "invalid_input";
    if (c === "provider_not_available") return "provider_error";
    return "server_error";
  })();
  const safeMessage = ((): string => {
    // Only surface messages we chose ourselves (ContentOpsError). Everything
    // else collapses to a generic phrase.
    const m = (err as { message?: unknown; name?: unknown }).message;
    const name = (err as { name?: unknown }).name;
    if (name === "ContentOpsError" && typeof m === "string" && m.length < 240) return m;
    return "The underlying server operation could not be completed.";
  })();
  return failed({ ...base, reasonCode: code, message: safeMessage });
}