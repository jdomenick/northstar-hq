// Composed visual sections for the public marketing site.
//
// These are presentation only. Copy lives in src/lib/marketing/content.ts where
// it is shared, and nothing here fabricates customer data or metrics.

import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Clock,
  GitBranch,
  PhoneMissed,
  Repeat,
  Search,
  Target,
  Unplug,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Reveal, useSequence } from "./motion";
import { ConstraintChip } from "./pipeline-visual";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* What we actually fix                                                        */
/* -------------------------------------------------------------------------- */

const FIXES: { icon: ComponentType<{ className?: string }>; title: string; body: string }[] = [
  { icon: PhoneMissed, title: "Missed calls", body: "Demand you already paid for hangs up and calls someone else." },
  { icon: Clock, title: "Slow follow-up", body: "The first reply arrives hours or days after the buyer moved on." },
  { icon: Target, title: "Poor lead handling", body: "Inquiries land in an inbox with no owner and no next step." },
  { icon: Unplug, title: "Disconnected systems", body: "The CRM, the phone, and the calendar do not talk to each other." },
  { icon: GitBranch, title: "Weak conversion", body: "Deals stall mid-pipeline and nobody can say at which step." },
  { icon: BarChart3, title: "Missing attribution", body: "Spend runs without a truthful read on what produced revenue." },
  { icon: Repeat, title: "Manual processes", body: "Hours a week spent re-entering, copying, and chasing by hand." },
];

export function WhatWeFix() {
  return (
    <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {FIXES.map((f, i) => {
        const Icon = f.icon;
        return (
          <Reveal key={f.title} delay={i * 55} className="bg-background">
            <div className="group h-full p-6 transition-colors duration-300 hover:bg-accent/40">
              <span className="inline-flex h-9 w-9 items-center justify-center border border-border text-muted-foreground transition-colors duration-300 group-hover:border-primary/50 group-hover:text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="mt-4 font-display text-[15px] font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">{f.body}</p>
            </div>
          </Reveal>
        );
      })}
      <Reveal delay={FIXES.length * 55} className="bg-background">
        <div className="flex h-full flex-col justify-between gap-4 bg-primary/[0.06] p-6">
          <p className="text-[13.5px] leading-[1.7] text-foreground">
            Most businesses have several of these at once. The Assessment tells you which one is costing
            you the most right now.
          </p>
          <Link
            to="/request-assessment"
            className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground underline underline-offset-4"
          >
            Request an Assessment <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* How NorthStar works: Assess -> Diagnose -> Implement -> Measure -> Optimize */
/* -------------------------------------------------------------------------- */

const FLOW: { key: string; label: string; detail: string }[] = [
  { key: "assess", label: "Assess", detail: "We walk the real customer journey the way a buyer experiences it." },
  { key: "diagnose", label: "Diagnose", detail: "We name the constraint, and what it costs to leave it in place." },
  { key: "implement", label: "Implement", detail: "We build the system that closes the gap inside the tools you run." },
  { key: "measure", label: "Measure", detail: "We report the change against the number it was meant to move." },
  { key: "optimize", label: "Optimize", detail: "We keep tuning after go live, then look for the next constraint." },
];

export function ProcessFlow() {
  const { ref, index } = useSequence(FLOW.length, 2600, FLOW.length - 1);

  return (
    <div ref={ref} className="mt-12">
      {/* Progress rail */}
      <div className="relative hidden h-px w-full bg-border md:block" aria-hidden>
        <div
          className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${((index + 1) / FLOW.length) * 100}%` }}
        />
      </div>

      <ol className="grid gap-px overflow-hidden border border-border bg-border md:mt-px md:grid-cols-5">
        {FLOW.map((step, i) => {
          const reached = i <= index;
          return (
            <li
              key={step.key}
              className={cn(
                "relative bg-background p-6 transition-colors duration-500",
                reached ? "bg-background" : "bg-background",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 top-0 h-[2px] transition-colors duration-500",
                  reached ? "bg-primary" : "bg-transparent",
                )}
              />
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-display text-[26px] font-semibold leading-none transition-colors duration-500",
                    reached ? "text-primary" : "text-foreground/15",
                  )}
                >
                  {i + 1}
                </span>
                <span className="font-display text-[16px] font-semibold text-foreground">{step.label}</span>
              </div>
              <p className="mt-3 text-[13.5px] leading-[1.7] text-muted-foreground">{step.detail}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Diagnostic storytelling sequence                                            */
/* -------------------------------------------------------------------------- */

const STORY: { label: string; body: string; state: "neutral" | "leak" | "fix" }[] = [
  { label: "Demand arrives", body: "Marketing works. Leads and calls come in every day.", state: "neutral" },
  { label: "Response is slow", body: "The first reply takes hours. The buyer has already called someone else.", state: "leak" },
  { label: "Calls go unanswered", body: "After hours and peak periods, nobody picks up and nothing is logged.", state: "leak" },
  { label: "Follow-up stops", body: "The second and third touch depend on someone remembering.", state: "leak" },
  { label: "Attribution is incomplete", body: "Revenue cannot be traced back to what produced it.", state: "leak" },
  { label: "NorthStar closes the gap", body: "We name the constraint, implement the fix, and measure the result.", state: "fix" },
];

export function DiagnosticStory() {
  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <ConstraintChip label="Illustrative sequence" />
        <p className="mt-5 max-w-md text-[15px] leading-[1.8] text-muted-foreground">
          This is the pattern we find most often. The business is not short on demand. It is losing the
          demand it already generates between the steps.
        </p>
      </div>

      <ol className="relative border-l border-border pl-6">
        {STORY.map((s, i) => (
          <Reveal as="li" key={s.label} delay={i * 70} className="relative pb-8 last:pb-0">
            <span
              aria-hidden
              className={cn(
                "absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full",
                s.state === "leak"
                  ? "bg-destructive"
                  : s.state === "fix"
                    ? "bg-primary"
                    : "bg-foreground/30",
              )}
            />
            <div
              className={cn(
                "text-[10.5px] font-medium uppercase tracking-[0.2em]",
                s.state === "leak"
                  ? "text-destructive"
                  : s.state === "fix"
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              Step {i + 1}
            </div>
            <h3 className="mt-1.5 font-display text-[17px] font-semibold text-foreground">{s.label}</h3>
            <p className="mt-1.5 max-w-xl text-[14px] leading-[1.75] text-muted-foreground">{s.body}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Supporting infrastructure                                                   */
/* -------------------------------------------------------------------------- */

const MODULES: { name: string; role: string }[] = [
  { name: "CAM", role: "Customer acquisition and lead flow" },
  { name: "CCM", role: "Conversation capture and response" },
  { name: "NorthStar CRM", role: "Pipeline and sales visibility" },
  { name: "SAM", role: "Reporting, analysis, and workflow automation" },
];

export function EcosystemStrip() {
  return (
    <div className="mt-12">
      <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m, i) => (
          <Reveal key={m.name} delay={i * 60} className="bg-background">
            <div className="h-full bg-card/40 p-6">
              <div className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                {m.name}
              </div>
              <p className="mt-2 text-[13px] leading-[1.7] text-muted-foreground">{m.role}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 max-w-2xl text-[13.5px] leading-[1.8] text-muted-foreground">
        These run underneath the engagement. You are not buying software licences. You are buying a
        result, and this is part of how we deliver and measure it.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Outcome board                                                               */
/* -------------------------------------------------------------------------- */

const OUTCOME_METRICS: { label: string; note: string }[] = [
  { label: "Leads captured", note: "Counted at the source, not estimated." },
  { label: "Response time", note: "Measured from first touch to first reply." },
  { label: "Appointments booked", note: "Including recovered no-shows and cancellations." },
  { label: "Pipeline and revenue", note: "One number, reconciled across systems." },
  { label: "Attribution", note: "Which source produced which closed revenue." },
  { label: "Recovered opportunities", note: "Deals re-engaged that would have gone cold." },
];

export function OutcomeBoard() {
  return (
    <div className="mt-12">
      <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {OUTCOME_METRICS.map((m, i) => (
          <Reveal key={m.label} delay={i * 55} className="bg-background">
            <div className="flex h-full flex-col justify-between gap-6 p-6">
              <div className="font-display text-[15px] font-semibold text-foreground">{m.label}</div>
              <div>
                <div className="flex items-center gap-2">
                  <span aria-hidden className="h-px w-6 bg-primary/50" />
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Baseline set at Assessment
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-[1.7] text-muted-foreground">{m.note}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 max-w-2xl text-[13.5px] leading-[1.8] text-muted-foreground">
        We do not publish other clients' numbers, and we do not show numbers we have not measured. Your
        baseline is captured during the Assessment, and every result is reported against it.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Assessment CTA                                                              */
/* -------------------------------------------------------------------------- */

export function AssessmentCta({
  eyebrow = "The Assessment",
  title = "Find out what is actually limiting your growth.",
  body = "We inspect the real customer journey, then show you in writing what is broken, where opportunity is being lost, what should change, and what we can implement.",
  children,
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-y border-border bg-card/40">
      <div className="pointer-events-none absolute inset-0 nsl-wash" aria-hidden />
      <div className="pointer-events-none absolute inset-0 nsl-grid-field opacity-20" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <Search className="h-3.5 w-3.5 text-primary" />
              {eyebrow}
            </div>
            <h2 className="mt-5 max-w-3xl font-display text-[32px] font-semibold leading-[1.08] text-foreground md:text-[46px]">
              {title}
            </h2>
            <p className="mt-6 max-w-xl text-[15.5px] leading-[1.8] text-muted-foreground">{body}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/request-assessment"
                className="nsl-elev-1 inline-flex items-center justify-center gap-2 bg-primary px-7 py-4 text-[12.5px] font-medium uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Request an Assessment <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center justify-center gap-2 border border-border px-7 py-4 text-[12.5px] font-medium uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-accent"
              >
                See how it works
              </Link>
            </div>
          </div>

          <div className="nsl-elev-1 border border-border bg-background/85 p-6">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              What you get back
            </div>
            <ul className="mt-5 space-y-4">
              {[
                "What is broken, named and evidenced",
                "Where opportunity is being lost today",
                "What should change, in order of impact",
                "What NorthStar Labs can implement, in writing",
              ].map((line) => (
                <li key={line} className="flex gap-3 text-[14px] leading-[1.65] text-foreground">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[12.5px] leading-[1.7] text-muted-foreground">
              No software demo. Submitting the form does not create an account or a binding agreement.
            </p>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
