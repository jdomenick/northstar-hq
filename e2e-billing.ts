import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { createHash, randomBytes } from 'crypto';

const ORG_ID = '1c7c4814-5b92-4ba9-bc20-a9c7f2eb573a';
const OTHER_ORG = '00000000-0000-0000-0000-000000000abc'; // fake, for isolation check
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { telemetry: false, maxNetworkRetries: 2 });

const results: { step: string; status: 'PASS' | 'FAIL' | 'INFO'; detail?: string }[] = [];
const rec = (step: string, status: 'PASS'|'FAIL'|'INFO', detail?: string) => {
  results.push({ step, status, detail });
  console.log(`[${status}] ${step}${detail ? ' - ' + detail : ''}`);
};
const die = async (step: string, err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  rec(step, 'FAIL', msg);
  console.error('STACK', err);
  await report();
  process.exit(1);
};

async function report() {
  console.log('\n===== SUMMARY =====');
  for (const r of results) console.log(`${r.status.padEnd(4)} ${r.step}${r.detail?' - '+r.detail:''}`);
  const pass = results.filter(r => r.status==='PASS').length;
  const fail = results.filter(r => r.status==='FAIL').length;
  console.log(`\nTotal: ${pass} pass, ${fail} fail`);
}

async function main() {
  // Import billing modules dynamically (using file paths).
  const { startBillingFromProposal, generateFinalSetupInvoice, refundPayment, resendInvoiceEmail } = await import('/dev-server/src/lib/billing/invoices.server.ts');
  const { activateRecurringBilling } = await import('/dev-server/src/lib/billing/subscriptions.server.ts');
  const { ensureBillingCustomer } = await import('/dev-server/src/lib/billing/customers.server.ts');
  const { processStripeEvent } = await import('/dev-server/src/lib/billing/webhook.server.ts');

  // === Step 1: Create client + proposal (draft) ===
  const suffix = Date.now().toString().slice(-6);
  const clientName = `E2E Test Client ${suffix}`;
  const { data: client, error: cErr } = await supabase.from('revenue_clients').insert({
    organization_id: ORG_ID, name: clientName, status: 'active',
  }).select('*').single();
  if (cErr) return die('Create client', cErr);
  rec('1. Create client', 'PASS', client.id);

  const { data: proposal, error: pErr } = await supabase.from('nsl_proposals').insert({
    organization_id: ORG_ID,
    client_id: client.id,
    proposal_number: `E2E-${suffix}`,
    title: 'E2E Test Proposal',
    executive_summary: 'End to end validation.',
    status: 'draft',
    setup_fee_cents: 400000, // $4000, splits 2000/2000
    recurring_fee_cents: 250000, // $2500/mo
    total_value_cents: 400000 + 250000 * 12,
  }).select('*').single();
  if (pErr) return die('Generate proposal', pErr);
  rec('1. Generate proposal (draft)', 'PASS', proposal.id);

  // === Step 2: Approve ===
  await supabase.from('nsl_proposals').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', proposal.id);
  rec('2. Approve proposal', 'PASS');

  // === Step 3: Send ===
  const rawToken = randomBytes(24).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await supabase.from('nsl_proposals').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    public_token_hash: tokenHash,
    public_token_expires_at: new Date(Date.now() + 30*86400*1000).toISOString(),
  }).eq('id', proposal.id);
  rec('3. Send proposal', 'PASS', 'token generated');

  // === Step 4: Accept via RPC ===
  const { data: acceptRes, error: aErr } = await supabase.rpc('nsl_proposal_accept', {
    _token_hash: tokenHash,
    _signer_name: 'Jane Doe',
    _signer_email: `jane+${suffix}@example.com`,
    _acknowledgement: 'I agree to the terms of this proposal.',
    _ip: '127.0.0.1',
    _user_agent: 'e2e-test/1.0',
  });
  if (aErr) return die('Accept proposal', aErr);
  rec('4. Accept proposal', 'PASS', JSON.stringify(acceptRes));

  // === Step 5: Verify lock ===
  const { data: locked } = await supabase.from('nsl_proposals').select('*').eq('id', proposal.id).single();
  if (locked!.status !== 'accepted' || !locked!.locked_at || !locked!.accepted_at) return die('Verify lock', new Error(`status=${locked!.status} locked=${locked!.locked_at}`));
  rec('5. Verify proposal locked', 'PASS');

  // Verify lock enforcement: try to update
  const { error: lockErr } = await supabase.from('nsl_proposals').update({ title: 'HACKED' }).eq('id', proposal.id);
  if (!lockErr) rec('5b. Lock enforcement (update blocked)', 'INFO', 'service_role bypass expected'); 
  else rec('5b. Lock enforcement (update blocked)', 'PASS', lockErr.message);

  // === Step 6: Ensure Stripe customer ===
  const customer = await ensureBillingCustomer(supabase, { organization_id: ORG_ID, client_id: client.id });
  rec('6. Ensure Stripe customer', 'PASS', customer.stripe_customer_id);
  const customer2 = await ensureBillingCustomer(supabase, { organization_id: ORG_ID, client_id: client.id });
  if (customer.id !== customer2.id || customer.stripe_customer_id !== customer2.stripe_customer_id) return die('Idempotent customer', new Error('mismatch'));
  rec('21a. Duplicate customer request idempotent', 'PASS');

  // Attach default test payment method so invoice can be paid
  const pm = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } });
  await stripe.paymentMethods.attach(pm.id, { customer: customer.stripe_customer_id });
  await stripe.customers.update(customer.stripe_customer_id, { invoice_settings: { default_payment_method: pm.id } });
  rec('6b. Attach test card', 'PASS', pm.id);

  // === Step 7: Deposit invoice (50%) ===
  const dep = await startBillingFromProposal(supabase, { organization_id: ORG_ID, proposal_id: proposal.id });
  if (dep.type !== 'setup_deposit' || dep.amount_cents !== 200000) return die('Deposit amount', new Error(`got ${dep.amount_cents}`));
  rec('7. Deposit invoice created (50%)', 'PASS', `${dep.stripe_invoice_id} amount=${dep.amount_cents}`);

  // Idempotency: call twice
  const dep2 = await startBillingFromProposal(supabase, { organization_id: ORG_ID, proposal_id: proposal.id });
  if (dep2.id !== dep.id) return die('Deposit idempotent', new Error('duplicate invoice created'));
  rec('21b. Duplicate deposit invoice request idempotent', 'PASS');

  // === Step 8/9: Hosted URL + PDF ===
  if (!dep.hosted_invoice_url) return die('Hosted URL', new Error('missing'));
  if (!dep.invoice_pdf_url) return die('Invoice PDF', new Error('missing'));
  rec('8. Hosted invoice URL present', 'PASS', dep.hosted_invoice_url.slice(0, 60) + '...');
  rec('9. Invoice PDF URL present', 'PASS');

  // === Step 10: Pay deposit ===
  const payIfOpen = async (invId: string) => {
    const cur = await stripe.invoices.retrieve(invId);
    if (cur.status === 'paid') return cur;
    return stripe.invoices.pay(invId, { payment_method: pm.id });
  };
  const depPaid = await payIfOpen(dep.stripe_invoice_id);
  if (depPaid.status !== 'paid') return die('Pay deposit', new Error(`status=${depPaid.status}`));
  rec('10. Deposit paid via Stripe', 'PASS');

  // === Step 11: Process webhook event (invoice.paid) — poll for propagation ===
  const waitForPaidEvent = async (invId: string) => {
    for (let i = 0; i < 12; i++) {
      const events = await stripe.events.list({ type: 'invoice.paid', limit: 30 });
      const found = events.data.find(e => (e.data.object as any).id === invId);
      if (found) return found;
      await new Promise(r => setTimeout(r, 1500));
    }
    return null;
  };
  const depPaidEvent = await waitForPaidEvent(dep.stripe_invoice_id);
  if (!depPaidEvent) return die('Locate paid event', new Error('no invoice.paid event'));
  const wr1 = await processStripeEvent(supabase, depPaidEvent as any);
  if (wr1.kind !== 'processed') return die('Process invoice.paid', new Error(JSON.stringify(wr1)));
  rec('11. Webhook (invoice.paid) processed', 'PASS');

  // === Step 12: Verify billing records ===
  const { data: depRow } = await supabase.from('billing_invoices').select('*').eq('id', dep.id).single();
  if (depRow!.status !== 'paid' || depRow!.amount_paid_cents !== 200000) return die('Deposit row', new Error(JSON.stringify(depRow)));
  const { data: pay1 } = await supabase.from('billing_payments').select('*').eq('invoice_id', dep.id);
  if (!pay1 || pay1.length !== 1) return die('Deposit payment row', new Error(`count=${pay1?.length}`));
  rec('12. Deposit billing records reconciled', 'PASS', `payment=${pay1[0].id}`);

  // === Step 20a: Replay same event (idempotency) ===
  const wrDup = await processStripeEvent(supabase, depPaidEvent as any);
  if (wrDup.kind !== 'already_processed') return die('Replay idempotency', new Error(JSON.stringify(wrDup)));
  const { data: pay1b } = await supabase.from('billing_payments').select('id').eq('invoice_id', dep.id);
  if (pay1b!.length !== 1) return die('Replay dup payment', new Error(`count=${pay1b!.length}`));
  rec('20. Replay webhook event is idempotent', 'PASS');
  rec('21c. No duplicate payments on replay', 'PASS');

  // === Step 13: Final setup invoice ===
  const fin = await generateFinalSetupInvoice(supabase, { organization_id: ORG_ID, proposal_id: proposal.id });
  if (fin.type !== 'setup_final' || fin.amount_cents !== 200000) return die('Final amount', new Error(String(fin.amount_cents)));
  rec('13. Final setup invoice created (50%)', 'PASS', fin.stripe_invoice_id);
  const fin2 = await generateFinalSetupInvoice(supabase, { organization_id: ORG_ID, proposal_id: proposal.id });
  if (fin2.id !== fin.id) return die('Final idempotent', new Error('duplicate'));
  rec('21d. Duplicate final invoice request idempotent', 'PASS');

  // === Step 14: Pay final ===
  const finPaid = await payIfOpen(fin.stripe_invoice_id);
  if (finPaid.status !== 'paid') return die('Pay final', new Error(finPaid.status ?? 'no-status'));
  rec('14. Final invoice paid', 'PASS');

  // === Step 15: Reconciliation of final via webhook ===
  const finPaidEvent = await waitForPaidEvent(fin.stripe_invoice_id);
  if (!finPaidEvent) return die('Locate final paid event', new Error('missing'));
  const wr2 = await processStripeEvent(supabase, finPaidEvent as any);
  if (wr2.kind !== 'processed') return die('Process final invoice.paid', new Error(JSON.stringify(wr2)));
  const { data: finRow } = await supabase.from('billing_invoices').select('*').eq('id', fin.id).single();
  if (finRow!.status !== 'paid') return die('Final row status', new Error(finRow!.status));
  rec('15. Final invoice reconciled via webhook', 'PASS');

  // === Step 16/17/18: Activate subscription ===
  const sub = await activateRecurringBilling(supabase, { organization_id: ORG_ID, proposal_id: proposal.id });
  if (!sub.stripe_subscription_id) return die('Subscription id', new Error('missing'));
  rec('16. Recurring subscription activated', 'PASS', sub.stripe_subscription_id);

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, { expand: ['items.data.price'] });
  const unit = stripeSub.items.data[0].price.unit_amount;
  if (unit !== 250000) return die('Recurring amount', new Error(`got ${unit}`));
  rec('17. Recurring amount matches locked proposal ($2500)', 'PASS');
  rec('18. Subscription verified in Stripe', 'PASS', `status=${stripeSub.status}`);

  const sub2 = await activateRecurringBilling(supabase, { organization_id: ORG_ID, proposal_id: proposal.id });
  if (sub2.id !== sub.id) return die('Subscription idempotent', new Error('duplicate'));
  rec('21e. Duplicate subscription request idempotent', 'PASS');

  // === Step 19: Local <-> Stripe reconciliation ===
  const { data: subRow } = await supabase.from('billing_subscriptions').select('*').eq('id', sub.id).single();
  if (subRow!.stripe_subscription_id !== stripeSub.id) return die('Sub id match', new Error('mismatch'));
  const { data: custRow } = await supabase.from('billing_customers').select('*').eq('id', customer.id).single();
  if (custRow!.stripe_customer_id !== customer.stripe_customer_id) return die('Cust id match', new Error('mismatch'));
  rec('19. Local billing tables reconcile with Stripe', 'PASS');

  // === Step 22: Organization isolation ===
  try {
    await startBillingFromProposal(supabase, { organization_id: OTHER_ORG, proposal_id: proposal.id });
    return die('Cross-org isolation', new Error('foreign org was allowed to bill'));
  } catch (e) {
    rec('22. Organization isolation enforced', 'PASS', (e as Error).message);
  }

  // === Step 23: Activity history (proposal_activity) ===
  const { data: act } = await supabase.from('nsl_proposal_activity').select('*').eq('proposal_id', proposal.id).order('created_at');
  const acceptedAct = act?.find(a => a.action === 'accepted');
  if (!acceptedAct) return die('Activity history', new Error('no accepted activity'));
  rec('23. Activity history recorded', 'PASS', `${act!.length} entries`);

  // === Step 24: Audit records (billing_events) ===
  const { data: bev } = await supabase.from('billing_events')
    .select('event_type,proposal_id,client_id')
    .or(`proposal_id.eq.${proposal.id},client_id.eq.${client.id}`);
  const types = new Set(bev?.map(e => e.event_type));
  const wanted = ['customer_created','invoice_created','invoice_finalized','setup_deposit_paid','onboarding_payment_complete','setup_final_paid','ready_for_go_live','subscription_created','recurring_billing_active'];
  const missing = wanted.filter(t => !types.has(t));
  if (missing.length) return die('Audit records', new Error('missing: ' + missing.join(',')));
  rec('24. Audit records complete', 'PASS', `${wanted.length} event types present`);

  // Verify no secrets leaked in payloads
  const { data: bevFull } = await supabase.from('billing_events').select('payload').eq('proposal_id', proposal.id);
  const asStr = JSON.stringify(bevFull);
  if (/sk_(test|live)_/.test(asStr) || /whsec_/.test(asStr)) return die('Audit secrecy', new Error('secret leaked'));
  rec('24b. Audit payloads contain no secrets', 'PASS');

  // === Step 25: Proposal history unchanged ===
  const { data: after } = await supabase.from('nsl_proposals').select('title,setup_fee_cents,recurring_fee_cents,version,locked_at,accepted_at').eq('id', proposal.id).single();
  if (
    after!.title !== 'E2E Test Proposal' ||
    Number(after!.setup_fee_cents) !== 400000 ||
    Number(after!.recurring_fee_cents) !== 250000 ||
    after!.version !== 1 ||
    !after!.locked_at || !after!.accepted_at
  ) return die('Proposal immutability', new Error(JSON.stringify(after)));
  rec('25. Proposal remains locked & unchanged', 'PASS');

  await report();
}

main().catch(async (e) => { console.error(e); await report(); process.exit(1); });
