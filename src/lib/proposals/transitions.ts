// Explicit state-machine for NorthStar Labs proposals. Server functions and
// the public routes both consult this table before mutating status.

import type { Database } from "@/integrations/supabase/types";

export type ProposalStatus = Database["public"]["Enums"]["nsl_proposal_status"];

const TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ["internal_review", "cancelled", "superseded"],
  internal_review: ["approved", "draft", "cancelled", "superseded"],
  approved: ["ready_to_send", "draft", "cancelled", "superseded"],
  ready_to_send: ["sent", "draft", "cancelled", "superseded"],
  sent: ["viewed", "accepted", "declined", "expired", "superseded", "cancelled"],
  viewed: ["accepted", "declined", "expired", "superseded", "cancelled"],
  accepted: [], // terminal / locked
  declined: ["superseded"],
  expired: ["superseded"],
  superseded: [],
  cancelled: [],
};

export function canTransition(from: ProposalStatus, to: ProposalStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: ProposalStatus, to: ProposalStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid_transition:${from}->${to}`);
  }
}

export const TERMINAL: ProposalStatus[] = ["accepted", "superseded", "cancelled"];

export function isTerminal(s: ProposalStatus): boolean {
  return TERMINAL.includes(s);
}

export function isPubliclyActionable(s: ProposalStatus): boolean {
  return s === "sent" || s === "viewed";
}