// Public re-exports for the AI COO Core (Phase 3D.3).
//
// SAM is Northstar's AI COO. This module owns the durable operating
// context (organization + venture), the executive-context assembler that
// bounds and ranks what SAM sees on every turn, and (in later
// sub-phases) the deterministic engines for accountability, bottleneck,
// project health, prioritization, and briefings.
//
// Everything server-side is behind requireSupabaseAuth. Every calculation
// is versioned via a *_VERSION constant so audit rows stay reproducible.

export * from "./context/schema";
export * from "./context/operating-context.functions";
export { assembleExecutiveContext } from "./context/assemble.server";
export type {
  ExecutiveContext,
  ExecutiveContextInput,
  ContextContradiction,
} from "./context/assemble.server";