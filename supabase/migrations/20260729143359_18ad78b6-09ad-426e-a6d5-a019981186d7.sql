ALTER TABLE public.billing_customers ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT false;
ALTER TABLE public.billing_invoices ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT false;
ALTER TABLE public.billing_payments ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT false;
ALTER TABLE public.billing_subscriptions ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT false;
ALTER TABLE public.billing_webhook_events ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS billing_customers_livemode_idx ON public.billing_customers(organization_id, livemode);
CREATE INDEX IF NOT EXISTS billing_invoices_livemode_idx ON public.billing_invoices(organization_id, livemode);
CREATE INDEX IF NOT EXISTS billing_payments_livemode_idx ON public.billing_payments(organization_id, livemode);
CREATE INDEX IF NOT EXISTS billing_subscriptions_livemode_idx ON public.billing_subscriptions(organization_id, livemode);
CREATE INDEX IF NOT EXISTS billing_webhook_events_livemode_idx ON public.billing_webhook_events(livemode);