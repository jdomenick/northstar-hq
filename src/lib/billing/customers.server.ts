// Ensure a Stripe customer exists for a client. Idempotent per (org, client).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getStripe, isStripeLive, stripeErrorMessage } from "./stripe.server";
import { recordBillingEvent } from "./events.server";
import { buildIdempotencyKey } from "./money";

export type BillingCustomerRow = Database["public"]["Tables"]["billing_customers"]["Row"];

export async function ensureBillingCustomer(
  supabase: SupabaseClient<Database>,
  input: {
    organization_id: string;
    client_id: string;
    actor_id?: string | null;
    email?: string | null;
  },
): Promise<BillingCustomerRow> {
  // 1. Return existing row if present.
  const existing = await supabase
    .from("billing_customers")
    .select("*")
    .eq("organization_id", input.organization_id)
    .eq("client_id", input.client_id)
    .maybeSingle();
  if (existing.data) {
    // Back-fill email on the Stripe customer + local row if we just learned it.
    if (input.email && !existing.data.email) {
      try {
        await getStripe().customers.update(existing.data.stripe_customer_id, {
          email: input.email,
        });
      } catch (err) {
        throw new Error(`Failed to update Stripe customer email: ${stripeErrorMessage(err)}`);
      }
      const patched = await supabase
        .from("billing_customers")
        .update({ email: input.email })
        .eq("id", existing.data.id)
        .select("*")
        .maybeSingle();
      if (patched.data) return patched.data;
    }
    return existing.data;
  }

  // 2. Load client for email/name metadata.
  const clientRes = await supabase
    .from("revenue_clients")
    .select("id, organization_id, name, notes")
    .eq("id", input.client_id)
    .eq("organization_id", input.organization_id)
    .maybeSingle();
  if (clientRes.error || !clientRes.data) {
    throw new Error("Client not found for this organization");
  }
  const client = clientRes.data as {
    id: string;
    organization_id: string;
    name: string;
    notes: string | null;
  };

  // 3. Create Stripe customer with idempotency key.
  const stripe = getStripe();
  let stripeCustomer;
  try {
    stripeCustomer = await stripe.customers.create(
      {
        name: client.name,
        ...(input.email ? { email: input.email } : {}),
        metadata: {
          organization_id: input.organization_id,
          client_id: input.client_id,
          source: "northstar_labs_billing",
        },
      },
      { idempotencyKey: buildIdempotencyKey("nsl_customer", input.organization_id, input.client_id) },
    );
  } catch (err) {
    throw new Error(`Failed to create Stripe customer: ${stripeErrorMessage(err)}`);
  }

  // 4. Persist local row.
  const insertRes = await supabase
    .from("billing_customers")
    .insert({
      organization_id: input.organization_id,
      client_id: input.client_id,
      stripe_customer_id: stripeCustomer.id,
      email: input.email ?? null,
      name: client.name,
      created_by: input.actor_id ?? null,
      livemode: isStripeLive(),
    })
    .select("*")
    .maybeSingle();

  // 5. If a concurrent request already inserted, return the winner.
  if (insertRes.error) {
    const retry = await supabase
      .from("billing_customers")
      .select("*")
      .eq("organization_id", input.organization_id)
      .eq("client_id", input.client_id)
      .maybeSingle();
    if (retry.data) return retry.data;
    throw insertRes.error;
  }
  if (!insertRes.data) throw new Error("Failed to persist billing customer");

  await recordBillingEvent(supabase, {
    organization_id: input.organization_id,
    client_id: input.client_id,
    event_type: "customer_created",
    actor_id: input.actor_id ?? null,
    actor_type: input.actor_id ? "user" : "system",
    payload: { stripe_customer_id: stripeCustomer.id },
  });

  return insertRes.data;
}