// Sanitize a proposal row for public rendering. Strips internal-only fields
// (comments, activity, hashed tokens, audit metadata, internal identifiers).

import type { Database } from "@/integrations/supabase/types";
import type { PublicBilling, ClientNextStep } from "./client-billing";

type Row = Database["public"]["Tables"]["nsl_proposals"]["Row"];

export interface PublicProposal {
  proposal_number: string;
  title: string;
  status: Row["status"];
  version: number;
  executive_summary: string;
  business_overview: string;
  current_challenges: string;
  assessment_summary: string;
  growth_opportunities: string;
  recommended_strategy: string;
  recommended_services: string;
  deliverables: string;
  implementation_timeline: string;
  investment_summary: string;
  payment_schedule: string;
  terms: string;
  total_value_cents: number;
  setup_fee_cents: number;
  recurring_fee_cents: number;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  expires_at: string | null;
  locked: boolean;
  client_name: string;
  prepared_date: string;
  contact_email: string | null;
  billing: PublicBilling;
  next_step: ClientNextStep | null;
  acceptance?: {
    signer_name: string;
    signer_email: string;
    acknowledgement: string;
    signed_at: string;
    proposal_version: number;
  } | null;
}

export function sanitizeProposal(
  row: Row,
  clientName: string,
  acceptance?: PublicProposal["acceptance"],
  extras?: { billing?: PublicBilling; next_step?: ClientNextStep | null; contact_email?: string | null },
): PublicProposal {
  return {
    proposal_number: row.proposal_number,
    title: row.title,
    status: row.status,
    version: row.version,
    executive_summary: row.executive_summary ?? "",
    business_overview: row.business_overview ?? "",
    current_challenges: row.current_challenges ?? "",
    assessment_summary: row.assessment_summary ?? "",
    growth_opportunities: row.growth_opportunities ?? "",
    recommended_strategy: row.recommended_strategy ?? "",
    recommended_services: row.recommended_services ?? "",
    deliverables: row.deliverables ?? "",
    implementation_timeline: row.implementation_timeline ?? "",
    investment_summary: row.investment_summary ?? "",
    payment_schedule: row.payment_schedule ?? "",
    terms: row.terms ?? "",
    total_value_cents: Number(row.total_value_cents ?? 0),
    setup_fee_cents: Number(row.setup_fee_cents ?? 0),
    recurring_fee_cents: Number(row.recurring_fee_cents ?? 0),
    sent_at: row.sent_at,
    accepted_at: row.accepted_at,
    declined_at: row.declined_at,
    expires_at: row.public_token_expires_at,
    locked: row.locked_at != null,
    client_name: clientName,
    prepared_date: row.created_at,
    contact_email: extras?.contact_email ?? null,
    billing: extras?.billing ?? { invoices: [], subscription: null },
    next_step: extras?.next_step ?? null,
    acceptance: acceptance ?? null,
  };
}