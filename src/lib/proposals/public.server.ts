// Helpers for the public proposal routes. Uses the service-role admin client
// because the client is unauthenticated - RLS is bypassed only after the
// token hash has been verified against nsl_proposals.public_token_hash.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { hashToken } from "./token.server";
import { isPubliclyActionable, isTerminal } from "./transitions";
import { sanitizeProposal, type PublicProposal } from "./sanitize";
import {
  deriveNextStep,
  INVOICE_LABEL,
  type PublicBilling,
  type PublicInvoice,
  type PublicInvoicePurpose,
} from "./client-billing";

type DB = SupabaseClient<Database>;

function toPurpose(t: string): PublicInvoicePurpose {
  return t === "setup_deposit" || t === "setup_final" || t === "recurring" ? t : "other";
}

/**
 * Resolves billing strictly from the already-token-verified proposal id.
 * No client-supplied identifier is ever used here.
 */
export async function buildPublicBilling(admin: DB, proposalId: string): Promise<PublicBilling> {
  const [{ data: invoices }, { data: subs }] = await Promise.all([
    admin
      .from("billing_invoices")
      .select(
        "id, type, status, amount_cents, amount_paid_cents, currency, due_at, paid_at, hosted_invoice_url, invoice_pdf_url, created_at",
      )
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: true }),
    admin
      .from("billing_subscriptions")
      .select("status, amount_cents, currency, interval, current_period_end, created_at")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const rows = (invoices ?? []).filter((i) => i.status !== "void" && i.status !== "draft");
  const ids = rows.map((r) => r.id);
  const receipts = new Map<string, string>();
  if (ids.length) {
    const { data: payments } = await admin
      .from("billing_payments")
      .select("invoice_id, receipt_url, status")
      .in("invoice_id", ids)
      .eq("status", "succeeded");
    for (const p of payments ?? []) {
      if (p.receipt_url && !receipts.has(p.invoice_id)) receipts.set(p.invoice_id, p.receipt_url);
    }
  }

  const list: PublicInvoice[] = rows.map((r) => {
    const purpose = toPurpose(r.type);
    const paid = Number(r.amount_paid_cents ?? 0);
    const total = Number(r.amount_cents ?? 0);
    const open = r.status === "open";
    return {
      purpose,
      label: INVOICE_LABEL[purpose],
      status: r.status,
      amount_cents: total,
      amount_paid_cents: paid,
      amount_remaining_cents: Math.max(0, total - paid),
      currency: r.currency ?? "usd",
      due_at: r.due_at,
      paid_at: r.paid_at,
      payment_url: open ? (r.hosted_invoice_url ?? null) : null,
      receipt_url: receipts.get(r.id) ?? (r.status === "paid" ? (r.invoice_pdf_url ?? r.hosted_invoice_url ?? null) : null),
    };
  });

  const s = (subs ?? [])[0];
  return {
    invoices: list,
    subscription: s
      ? {
          status: s.status,
          amount_cents: Number(s.amount_cents ?? 0),
          currency: s.currency ?? "usd",
          interval: s.interval ?? "month",
          current_period_end: s.current_period_end,
        }
      : null,
  };
}

export async function loadByToken(admin: DB, token: string) {
  if (!token || token.length < 8 || token.length > 128) throw new Error("invalid_token");
  const hash = hashToken(token);
  const { data: p, error } = await admin
    .from("nsl_proposals")
    .select("*")
    .eq("public_token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  if (!p) throw new Error("not_found");
  if (p.public_token_expires_at && new Date(p.public_token_expires_at) < new Date()) {
    throw new Error("expired");
  }
  if (isTerminal(p.status) && p.status !== "accepted") throw new Error("not_available");
  if (!isPubliclyActionable(p.status) && p.status !== "accepted") throw new Error("not_available");
  return p;
}

export async function buildPublicPayload(
  admin: DB,
  proposalId: string,
): Promise<PublicProposal> {
  const { data: p, error } = await admin.from("nsl_proposals").select("*").eq("id", proposalId).maybeSingle();
  if (error || !p) throw new Error("not_found");
  const [{ data: client }, { data: sig }] = await Promise.all([
    admin.from("revenue_clients").select("id, name").eq("id", p.client_id).maybeSingle(),
    admin.from("nsl_proposal_signatures").select("*").eq("proposal_id", p.id).maybeSingle(),
  ]);
  const accepted = p.status === "accepted";
  const billing = accepted
    ? await buildPublicBilling(admin, p.id)
    : { invoices: [], subscription: null };
  return sanitizeProposal(
    p,
    client?.name ?? "Client",
    sig
      ? {
          signer_name: sig.signer_name,
          signer_email: sig.signer_email,
          acknowledgement: sig.acknowledgement,
          signed_at: sig.signed_at,
          proposal_version: sig.proposal_version,
        }
      : null,
    {
      billing,
      next_step: accepted ? deriveNextStep(billing, Number(p.recurring_fee_cents ?? 0)) : null,
      contact_email: process.env.NSL_CONTACT_EMAIL ?? null,
    },
  );
}

export function clientIp(request: Request): string | null {
  const h = request.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? null;
}