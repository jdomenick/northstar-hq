// The growth-system visual used on the public homepage hero.
//
// It renders a faithful, static composition of the NorthStar reporting surface:
// the revenue path (Leads -> Conversations -> Appointments -> Sales -> Revenue),
// the point where a constraint is detected, and the transition from detected to
// implemented to measured.
//
// Nothing here reports customer data. Stage states are illustrative and the
// panel is labelled as such.

import { AlertTriangle, Check, Radar, Wrench } from "lucide-react";
import { useSequence, usePrefersReducedMotion } from "./motion";
import { cn } from "@/lib/utils";

type Stage = {
  key: string;
  label: string;
  /** What the system watches at this stage. */
  watch: string;
};

const STAGES: Stage[] = [
  { key: "leads", label: "Leads", watch: "Captured from every source" },
  { key: "conversations", label: "Conversations", watch: "Answered and qualified" },
  { key: "appointments", label: "Appointments", watch: "Booked and recovered" },
  { key: "sales", label: "Sales", watch: "Moved, not stalled" },
  { key: "revenue", label: "Revenue", watch: "Attributed to a source" },
];

/** Index of the stage the illustrative constraint sits on. */
const CONSTRAINT_INDEX = 1;

const PHASES = [
  {
    key: "detected",
    label: "Constraint detected",
    detail: "Inbound conversations are not answered fast enough.",
    icon: Radar,
    tone: "warn" as const,
  },
  {
    key: "implemented",
    label: "Fix implemented",
    detail: "Response and follow-up run without waiting on a person.",
    icon: Wrench,
    tone: "primary" as const,
  },
  {
    key: "measured",
    label: "Result measured",
    detail: "The change is reported against the number it was meant to move.",
    icon: Check,
    tone: "ok" as const,
  },
];

export function GrowthPipelineVisual({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const { ref, index } = useSequence(PHASES.length, 3000, 0);
  const phase = PHASES[index] ?? PHASES[0]!;
  const PhaseIcon = phase.icon;
  const resolved = index > 0;

  return (
    <div
      ref={ref}
      className={cn(
        "nsl-elev-2 relative overflow-hidden border border-border bg-card",
        className,
      )}
      aria-label="Illustration of the NorthStar growth system monitoring the revenue path"
    >
      {/* Panel chrome, matched to the internal reporting surface. */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-foreground/70">
            Growth System / Revenue Path
          </span>
        </div>
        <span className="border border-border px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Illustrative
        </span>
      </div>

      <div className="relative px-4 py-6 md:px-6 md:py-7">
        <div className="pointer-events-none absolute inset-0 nsl-grid-field" aria-hidden />

        <ol className="relative grid gap-3 sm:grid-cols-5">
          {STAGES.map((stage, i) => {
            const isConstraint = i === CONSTRAINT_INDEX;
            const state = isConstraint ? (resolved ? "fixed" : "leaking") : "ok";
            return (
              <li key={stage.key} className="relative">
                <div
                  className={cn(
                    "h-full border bg-background/85 p-3 transition-colors duration-500",
                    state === "leaking"
                      ? "border-destructive/55"
                      : state === "fixed"
                        ? "border-primary/55"
                        : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9.5px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      0{i + 1}
                    </span>
                    <span className="relative flex h-2 w-2 items-center justify-center">
                      {state === "leaking" && !reduced && (
                        <span className="nsl-pulse absolute inset-0 rounded-full bg-destructive/50" />
                      )}
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-colors duration-500",
                          state === "leaking"
                            ? "bg-destructive"
                            : state === "fixed"
                              ? "bg-primary"
                              : "bg-foreground/30",
                        )}
                      />
                    </span>
                  </div>
                  <div className="mt-2 font-display text-[13.5px] font-semibold text-foreground">
                    {stage.label}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-[1.6] text-muted-foreground">
                    {stage.watch}
                  </p>
                </div>

                {/* Connector with a travelling signal, horizontal on wide screens. */}
                {i < STAGES.length - 1 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-[-13px] top-1/2 hidden h-px w-3 overflow-hidden bg-border sm:block"
                  >
                    {!reduced && (
                      <span className="nsl-flow-dot absolute inset-y-0 left-0 w-1.5 bg-primary" />
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* Phase readout: detected -> implemented -> measured. */}
        <div
          className={cn(
            "relative mt-5 flex items-start gap-3 border bg-background/85 p-4 transition-colors duration-500",
            phase.tone === "warn"
              ? "border-destructive/45"
              : phase.tone === "primary"
                ? "border-primary/45"
                : "border-border",
          )}
        >
          <span
            className={cn(
              "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center border transition-colors duration-500",
              phase.tone === "warn"
                ? "border-destructive/45 text-destructive"
                : phase.tone === "primary"
                  ? "border-primary/45 text-primary"
                  : "border-border text-foreground",
            )}
          >
            <PhaseIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-foreground/70">
              {phase.label}
            </div>
            <p className="mt-1 text-[13px] leading-[1.65] text-muted-foreground">{phase.detail}</p>
          </div>
          <div className="ml-auto hidden items-center gap-1.5 sm:flex" aria-hidden>
            {PHASES.map((p, i) => (
              <span
                key={p.key}
                className={cn(
                  "h-1 w-6 transition-colors duration-500",
                  i === index ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact constraint badge reused in the diagnostic story section. */
export function ConstraintChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-destructive/45 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-destructive">
      <AlertTriangle className="h-3 w-3" />
      {label}
    </span>
  );
}
