-- =========================================================================
-- NorthStar Labs Billing & Payments (Phase 1) — schema, RLS, constraints
-- =========================================================================

-- Enums --------------------------------------------------------------------
CREATE TYPE public.billing_invoice_type AS ENUM (
  'setup_deposit', 'setup_final', 'subscription', 'adjustment'
);

CREATE TYPE public.billing_invoice_status AS ENUM (
  'draft', 'open', 'paid', 'uncollectible', 'void', 'refunded', 'partially_refunded'
);

CREATE TYPE public.billing_collection_method AS ENUM (
  'send_invoice', 'charge_automatically'
);

CREATE TYPE public.billing_payment_status AS ENUM (
  'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'
);

CREATE TYPE public.billing_subscription_status AS ENUM (
  'incomplete', 'incomplete_expired', 'trialing', 'active',
  'past_due', 'canceled', 'unpaid', 'paused'
);

CREATE TYPE public.billing_webhook_processing_status AS ENUM (
  'received', 'processing', 'processed', 'failed'
);

CREATE TYPE public.billing_event_type AS ENUM (
  'customer_created',
  'invoice_created',
  'invoice_finalized',
  'invoice_sent',
  'invoice_payment_failed',
  'setup_deposit_paid',
  'onboarding_payment_complete',
  'setup_final_paid',
  'ready_for_go_live',
  'subscription_created',
  'subscription_updated',
  'subscription_canceled',
  'recurring_billing_active',
  'refund_issued'
);

-- billing_customers --------------------------------------------------------
CREATE TABLE public.billing_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_customers_stripe_customer_id_key UNIQUE (stripe_customer_id),
  CONSTRAINT billing_customers_org_client_key UNIQUE (organization_id, client_id)
);
CREATE INDEX idx_billing_customers_org ON public.billing_customers(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_customers TO authenticated;
GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_customers_select ON public.billing_customers
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY billing_customers_insert ON public.billing_customers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

CREATE POLICY billing_customers_update ON public.billing_customers
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

CREATE POLICY billing_customers_delete ON public.billing_customers
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- billing_invoices ---------------------------------------------------------
CREATE TABLE public.billing_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.revenue_clients(id) ON DELETE RESTRICT,
  proposal_id UUID REFERENCES public.nsl_proposals(id) ON DELETE SET NULL,
  proposal_version INTEGER,
  customer_id UUID REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  type public.billing_invoice_type NOT NULL,
  stripe_invoice_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.billing_invoice_status NOT NULL DEFAULT 'draft',
  collection_method public.billing_collection_method NOT NULL DEFAULT 'send_invoice',
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  finalized_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_invoices_stripe_invoice_id_key UNIQUE (stripe_invoice_id),
  CONSTRAINT billing_invoices_stripe_pi_key UNIQUE (stripe_payment_intent_id),
  CONSTRAINT billing_invoices_amount_nonneg CHECK (amount_cents >= 0),
  CONSTRAINT billing_invoices_paid_nonneg CHECK (amount_paid_cents >= 0),
  CONSTRAINT billing_invoices_refund_nonneg CHECK (refunded_amount_cents >= 0),
  CONSTRAINT billing_invoices_refund_le_paid CHECK (refunded_amount_cents <= amount_paid_cents),
  CONSTRAINT billing_invoices_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX idx_billing_invoices_org ON public.billing_invoices(organization_id);
CREATE INDEX idx_billing_invoices_client ON public.billing_invoices(client_id);
CREATE INDEX idx_billing_invoices_proposal ON public.billing_invoices(proposal_id);
CREATE INDEX idx_billing_invoices_status ON public.billing_invoices(status);

-- One active setup deposit / final per proposal (excludes void/uncollectible)
CREATE UNIQUE INDEX billing_invoices_one_active_setup
  ON public.billing_invoices(proposal_id, type)
  WHERE proposal_id IS NOT NULL
    AND type IN ('setup_deposit','setup_final')
    AND status NOT IN ('void','uncollectible');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_invoices TO authenticated;
GRANT ALL ON public.billing_invoices TO service_role;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_invoices_select ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY billing_invoices_insert ON public.billing_invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));
CREATE POLICY billing_invoices_update ON public.billing_invoices
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));
CREATE POLICY billing_invoices_delete ON public.billing_invoices
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- billing_payments ---------------------------------------------------------
CREATE TABLE public.billing_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  amount_cents INTEGER NOT NULL,
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.billing_payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  receipt_url TEXT,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_payments_charge_key UNIQUE (stripe_charge_id),
  CONSTRAINT billing_payments_amount_nonneg CHECK (amount_cents >= 0),
  CONSTRAINT billing_payments_refund_nonneg CHECK (refunded_amount_cents >= 0),
  CONSTRAINT billing_payments_refund_le_paid CHECK (refunded_amount_cents <= amount_cents),
  CONSTRAINT billing_payments_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE INDEX idx_billing_payments_org ON public.billing_payments(organization_id);
CREATE INDEX idx_billing_payments_invoice ON public.billing_payments(invoice_id);
CREATE INDEX idx_billing_payments_pi ON public.billing_payments(stripe_payment_intent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_payments TO authenticated;
GRANT ALL ON public.billing_payments TO service_role;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_payments_select ON public.billing_payments
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY billing_payments_write ON public.billing_payments
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

-- billing_subscriptions ----------------------------------------------------
CREATE TABLE public.billing_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.revenue_clients(id) ON DELETE RESTRICT,
  proposal_id UUID REFERENCES public.nsl_proposals(id) ON DELETE SET NULL,
  proposal_version INTEGER,
  customer_id UUID REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  stripe_subscription_id TEXT NOT NULL,
  stripe_price_id TEXT,
  status public.billing_subscription_status NOT NULL DEFAULT 'incomplete',
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  interval TEXT NOT NULL DEFAULT 'month',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_subscriptions_stripe_sub_key UNIQUE (stripe_subscription_id),
  CONSTRAINT billing_subscriptions_amount_nonneg CHECK (amount_cents >= 0),
  CONSTRAINT billing_subscriptions_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT billing_subscriptions_interval_ok CHECK (interval IN ('day','week','month','year'))
);
CREATE INDEX idx_billing_subscriptions_org ON public.billing_subscriptions(organization_id);
CREATE INDEX idx_billing_subscriptions_client ON public.billing_subscriptions(client_id);
CREATE INDEX idx_billing_subscriptions_proposal ON public.billing_subscriptions(proposal_id);

-- One active subscription per proposal
CREATE UNIQUE INDEX billing_subscriptions_one_active_per_proposal
  ON public.billing_subscriptions(proposal_id)
  WHERE proposal_id IS NOT NULL
    AND status IN ('trialing','active','past_due');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_subscriptions TO authenticated;
GRANT ALL ON public.billing_subscriptions TO service_role;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_subs_select ON public.billing_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY billing_subs_write ON public.billing_subscriptions
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

-- billing_webhook_events ---------------------------------------------------
CREATE TABLE public.billing_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processing_status public.billing_webhook_processing_status NOT NULL DEFAULT 'received',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_webhook_events_event_id_key UNIQUE (stripe_event_id)
);
CREATE INDEX idx_billing_webhook_events_status ON public.billing_webhook_events(processing_status);
CREATE INDEX idx_billing_webhook_events_type ON public.billing_webhook_events(event_type);

-- Service-role only. No policies for authenticated.
GRANT ALL ON public.billing_webhook_events TO service_role;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

-- billing_events (audit trail) --------------------------------------------
CREATE TABLE public.billing_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.revenue_clients(id) ON DELETE SET NULL,
  proposal_id UUID REFERENCES public.nsl_proposals(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  event_type public.billing_event_type NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_events_actor_type_ok CHECK (actor_type IN ('user','system','stripe'))
);
CREATE INDEX idx_billing_events_org ON public.billing_events(organization_id);
CREATE INDEX idx_billing_events_proposal ON public.billing_events(proposal_id);
CREATE INDEX idx_billing_events_invoice ON public.billing_events(invoice_id);
CREATE INDEX idx_billing_events_type ON public.billing_events(event_type);

GRANT SELECT, INSERT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_events_select ON public.billing_events
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY billing_events_insert ON public.billing_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

-- updated_at triggers -----------------------------------------------------
CREATE TRIGGER trg_billing_customers_updated_at
  BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_billing_invoices_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_billing_payments_updated_at
  BEFORE UPDATE ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_billing_webhook_events_updated_at
  BEFORE UPDATE ON public.billing_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cross-org validation trigger (invoices) ---------------------------------
CREATE OR REPLACE FUNCTION public.validate_billing_invoice_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.revenue_clients WHERE id = NEW.client_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'billing invoice client must belong to organization';
  END IF;
  IF NEW.proposal_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.nsl_proposals WHERE id = NEW.proposal_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'billing invoice proposal must belong to organization';
    END IF;
  END IF;
  IF NEW.customer_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.billing_customers WHERE id = NEW.customer_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'billing invoice customer must belong to organization';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_billing_invoice_scope
  BEFORE INSERT OR UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.validate_billing_invoice_scope();

CREATE OR REPLACE FUNCTION public.validate_billing_subscription_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.revenue_clients WHERE id = NEW.client_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'subscription client must belong to organization';
  END IF;
  IF NEW.proposal_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.nsl_proposals WHERE id = NEW.proposal_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'subscription proposal must belong to organization';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_billing_subscription_scope
  BEFORE INSERT OR UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_billing_subscription_scope();

CREATE OR REPLACE FUNCTION public.validate_billing_payment_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.billing_invoices WHERE id = NEW.invoice_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'payment invoice must belong to organization';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_billing_payment_scope
  BEFORE INSERT OR UPDATE ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_billing_payment_scope();