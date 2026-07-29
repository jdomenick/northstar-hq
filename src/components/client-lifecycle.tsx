// Shared, presentational lifecycle rail for the client onboarding workflow.
// One place defines the canonical order of steps so the proposal screen and
// the billing screen can never disagree about "where am I".

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const LIFECYCLE_STEPS = [
  "Client",
  "Proposal",
  "Approved",
  "Sent",
  "Accepted",
  "Deposit paid",
  "Balance paid",
  "Recurring live",
] as const;

export type LifecycleStep = (typeof LIFECYCLE_STEPS)[number];

export interface LifecycleState {
  /** Index of the step currently in progress. */
  currentIndex: number;
  /** Plain-language instruction for what happens next. */
  nextStep: string;
  /** True when nothing is left to do on this engagement. */
  complete: boolean;
}

export interface LifecycleInput {
  proposalStatus: string;
  depositStatus?: string | null;
  finalStatus?: string | null;
  subscriptionStatus?: string | null;
  recurringFeeCents?: number;
}

/** Derive the lifecycle position from real record state. No guessing. */
export function deriveLifecycle(input: LifecycleInput): LifecycleState {
  const { proposalStatus, depositStatus, finalStatus, subscriptionStatus } = input;
  const recurring = Number(input.recurringFeeCents ?? 0);
  const paid = (s?: string | null) => s === "paid";

  if (proposalStatus === "declined") {
    return { currentIndex: 4, nextStep: "Client declined. Supersede this proposal and issue a revised version.", complete: false };
  }
  if (proposalStatus === "expired" || proposalStatus === "superseded" || proposalStatus === "cancelled") {
    return { currentIndex: 3, nextStep: "This proposal is no longer live. Generate a replacement to continue.", complete: false };
  }
  if (proposalStatus === "draft") {
    return { currentIndex: 1, nextStep: "Fill in the investment figures, then submit for review.", complete: false };
  }
  if (proposalStatus === "internal_review") {
    return { currentIndex: 2, nextStep: "Approve the proposal to unlock sending.", complete: false };
  }
  if (proposalStatus === "approved" || proposalStatus === "ready_to_send") {
    return { currentIndex: 3, nextStep: "Send it. You get a secure client link to share.", complete: false };
  }
  if (proposalStatus === "sent" || proposalStatus === "viewed") {
    return { currentIndex: 4, nextStep: "Waiting on the client to sign. Copy the link again if they lost it.", complete: false };
  }
  // Accepted from here down.
  if (!depositStatus) {
    return { currentIndex: 5, nextStep: "Start billing to create and send the 50 percent deposit invoice.", complete: false };
  }
  if (!paid(depositStatus)) {
    return { currentIndex: 5, nextStep: "Deposit invoice is open. Share the payment link or resend the email.", complete: false };
  }
  if (!finalStatus) {
    return { currentIndex: 6, nextStep: "Deposit cleared. Generate the final balance invoice.", complete: false };
  }
  if (!paid(finalStatus)) {
    return { currentIndex: 6, nextStep: "Balance invoice is open. Share the payment link or resend the email.", complete: false };
  }
  if (recurring <= 0) {
    return { currentIndex: 7, nextStep: "Setup is paid in full. No recurring fee on this engagement.", complete: true };
  }
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return { currentIndex: 7, nextStep: "Recurring billing is live. Nothing is waiting on you.", complete: true };
  }
  return { currentIndex: 7, nextStep: "Balance cleared. Activate the recurring subscription.", complete: false };
}

export function LifecycleRail({ state, className }: { state: LifecycleState; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-2", className)}>
      {LIFECYCLE_STEPS.map((label, i) => {
        const done = state.complete ? true : i < state.currentIndex;
        const current = !state.complete && i === state.currentIndex;
        return (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                done && "border-primary/30 bg-primary/10 text-primary",
                current && "border-foreground/40 bg-foreground text-background",
                !done && !current && "border-foreground/15 text-foreground/45",
              )}
            >
              {done && <Check className="h-3 w-3" />}
              {label}
            </span>
            {i < LIFECYCLE_STEPS.length - 1 && <span aria-hidden className="h-px w-3 bg-foreground/15" />}
          </div>
        );
      })}
    </div>
  );
}

export function NextStepBanner({
  state,
  action,
  className,
}: {
  state: LifecycleState;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
        state.complete ? "border-primary/30 bg-primary/5" : "border-foreground/15 bg-muted/40",
        className,
      )}
    >
      <div>
        <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-foreground/60">
          {state.complete ? "Status" : "Next step"}
        </div>
        <div className="mt-0.5 text-sm">{state.nextStep}</div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}