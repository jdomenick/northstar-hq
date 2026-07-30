CREATE TABLE public.nsl_assessment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  full_name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  industry TEXT,
  business_size TEXT,
  biggest_challenge TEXT NOT NULL,
  referral_source TEXT,
  consent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new',
  operator_notes TEXT,
  source_ip_hash TEXT,
  user_agent TEXT,
  CONSTRAINT nsl_assessment_requests_status_check CHECK (status IN ('new','contacted','scheduled','qualified','disqualified','archived')),
  CONSTRAINT nsl_assessment_requests_consent_check CHECK (consent = true)
);

CREATE INDEX nsl_assessment_requests_created_idx ON public.nsl_assessment_requests (created_at DESC);
CREATE INDEX nsl_assessment_requests_ip_idx ON public.nsl_assessment_requests (source_ip_hash, created_at DESC);

GRANT SELECT, UPDATE ON public.nsl_assessment_requests TO authenticated;
GRANT ALL ON public.nsl_assessment_requests TO service_role;

ALTER TABLE public.nsl_assessment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can view assessment requests"
  ON public.nsl_assessment_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid()));

CREATE POLICY "Operators can update assessment requests"
  ON public.nsl_assessment_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.nsl_assessment_requests_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER nsl_assessment_requests_updated_at
  BEFORE UPDATE ON public.nsl_assessment_requests
  FOR EACH ROW EXECUTE FUNCTION public.nsl_assessment_requests_touch();