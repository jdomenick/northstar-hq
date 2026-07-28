// Helpers for the public proposal routes. Uses the service-role admin client
// because the client is unauthenticated - RLS is bypassed only after the
// token hash has been verified against nsl_proposals.public_token_hash.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { hashToken } from "./token.server";
import { isPubliclyActionable, isTerminal } from "./transitions";
import { sanitizeProposal, type PublicProposal } from "./sanitize";

type DB = SupabaseClient<Database>;

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
  );
}

export function clientIp(request: Request): string | null {
  const h = request.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? null;
}