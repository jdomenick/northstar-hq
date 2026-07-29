// Client-safe lifecycle events for the client workspace activity feed.
//
// Two system-generated events live here: payment_received and
// implementation_ready. Both are emitted from trusted server paths (the Stripe
// webhook processor and the delivery activation engine) after those paths have
// already verified their own preconditions.
//
// Everything in this module is dependency-light on purpose: no path aliases, no
// React, no Supabase client construction. The emitters take a Supabase client as
// a parameter so the pure logic and the write guard are both directly testable.

import { createHash } from "node:crypto";
import { formatMoney } from "../billing/money.ts";

export type LifecycleEventType = "payment_received" | "implementation_ready";

export interface ClientSafeEvent {
  event_type: LifecycleEventType;
  title: string;
  body: string;
  is_notice: boolean;
  source_key: string;
}

/**
 * Deterministic dedupe key. Hashed so no internal identifier is ever stored in
 * a client-readable row, and stable so a replayed webhook or a retried
 * activation resolves to the same key.
 */
export function workspaceSourceKey(
  eventType: LifecycleEventType,
  parts: Array<string | number | null | undefined>,
): string {
  const material = [eventType, ...parts.map((p) => (p == null ? "" : String(p)))].join("|");
  return createHash("sha256").update(material).digest("hex");
}

const INTERNAL_ID_PATTERNS: RegExp[] = [
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, // uuid
  /\b(?:cus|in|pi|ch|sub|evt|price|prod|acct|seti|txn|re|py|il|si)_[A-Za-z0-9]{6,}\b/g, // stripe
  /\b[0-9a-f]{32,}\b/gi, // hashes and long hex ids
];

/**
 * Removes anything that looks like an internal identifier from client-facing
 * copy. A defensive second layer: the builders below already avoid identifiers.
 */
export function sanitizeClientEventText(text: string): string {
  let out = String(text ?? "");
  for (const pattern of INTERNAL_ID_PATTERNS) out = out.replace(pattern, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

const INVOICE_PURPOSE: Record<string, string> = {
  setup_deposit: "setup deposit",
  setup_final: "final setup balance",
  subscription: "recurring service invoice",
  adjustment: "billing adjustment",
};

/** Plain-language purpose for a client. Never leaks the raw enum to copy. */
export function invoicePurposeLabel(type: string | null | undefined): string {
  return INVOICE_PURPOSE[String(type ?? "")] ?? "invoice";
}

export interface PaymentReceivedInput {
  /** Internal billing invoice id. Used only for the hashed dedupe key. */
  invoice_id: string;
  invoice_type: string | null | undefined;
  amount_paid_cents: number;
  currency: string | null | undefined;
  paid_at: string | null | undefined;
  proposal_number: string | null | undefined;
}

export function buildPaymentReceivedEvent(input: PaymentReceivedInput): ClientSafeEvent {
  const purpose = invoicePurposeLabel(input.invoice_type);
  const amount = formatMoney(Number(input.amount_paid_cents) || 0, input.currency ?? "usd");
  const parts = [
    "Payment received. Thank you. NorthStar Labs has recorded your payment.",
    `Amount: ${amount} for your ${purpose}.`,
  ];
  if (input.proposal_number) parts.push(`Proposal ${input.proposal_number}.`);
  if (input.paid_at) parts.push(`Paid ${formatDay(input.paid_at)}.`);

  return {
    event_type: "payment_received",
    title: "Payment received",
    // Payments require nothing from the client, so this is activity only.
    is_notice: false,
    body: sanitizeClientEventText(parts.join(" ")),
    source_key: workspaceSourceKey("payment_received", [input.invoice_id]),
  };
}

export interface ImplementationReadyInput {
  /** Internal ids. Used only for the hashed dedupe key. */
  client_id: string;
  proposal_id: string;
  project_id: string;
  implementation_name: string | null | undefined;
  activated_at: string | null | undefined;
  next_step: string | null | undefined;
}

export function buildImplementationReadyEvent(
  input: ImplementationReadyInput,
): ClientSafeEvent {
  const parts = [
    "Your onboarding is complete and your implementation is ready to begin.",
  ];
  if (input.implementation_name) parts.push(`Implementation: ${input.implementation_name}.`);
  if (input.activated_at) parts.push(`Activated ${formatDay(input.activated_at)}.`);
  parts.push("Current phase: implementation.");
  const next = (input.next_step ?? "").trim();
  parts.push(`Next step: ${next || "NorthStar Labs will reach out to schedule your kickoff."}`);

  return {
    event_type: "implementation_ready",
    title: "Implementation ready",
    // The client has a real next action (kickoff), so this surfaces as a notice.
    is_notice: true,
    body: sanitizeClientEventText(parts.join(" ")),
    source_key: workspaceSourceKey("implementation_ready", [input.client_id, input.proposal_id]),
  };
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/* ------------------------------- persistence ------------------------------ */

export type EmitOutcome = "created" | "duplicate" | "failed";

/**
 * Minimal structural contract so tests can pass a stub. Matches the shape used
 * by supabase-js for the two calls this function makes.
 */
export interface WorkspaceEventWriter {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        eq(
          column: string,
          value: string,
        ): { maybeSingle(): Promise<{ data: { id: string } | null; error: unknown }> };
      };
    };
    insert(row: Record<string, unknown>): Promise<{ error: { code?: string } | null }>;
  };
}

/**
 * Insert a client-safe lifecycle event exactly once.
 *
 * Dedupe is by (client_id, source_key): checked first, then enforced by the
 * partial unique index so concurrent webhook deliveries still cannot double
 * insert.
 */
export async function emitClientLifecycleEvent(
  supabase: WorkspaceEventWriter,
  input: {
    organization_id: string;
    client_id: string;
    invoice_id?: string | null;
    event: ClientSafeEvent;
  },
): Promise<EmitOutcome> {
  const existing = await supabase
    .from("client_workspace_events")
    .select("id")
    .eq("client_id", input.client_id)
    .eq("source_key", input.event.source_key)
    .maybeSingle();
  if (existing.data) return "duplicate";

  const { error } = await supabase.from("client_workspace_events").insert({
    organization_id: input.organization_id,
    client_id: input.client_id,
    invoice_id: input.invoice_id ?? null,
    event_type: input.event.event_type,
    title: input.event.title,
    body: input.event.body,
    is_notice: input.event.is_notice,
    source_key: input.event.source_key,
  });
  if (!error) return "created";
  if (error.code === "23505") return "duplicate";
  return "failed";
}