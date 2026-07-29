-- ============ enums ============
CREATE TYPE public.client_onboarding_status AS ENUM
  ('not_started','in_progress','submitted','needs_revision','approved','blocked','not_applicable');
CREATE TYPE public.client_onboarding_owner AS ENUM ('client','northstar');
CREATE TYPE public.client_onboarding_item_type AS ENUM
  ('company_information','contact_information','service_area','business_hours','brand_assets',
   'system_access','existing_software','required_document','approval','other');
CREATE TYPE public.client_document_visibility AS ENUM ('internal_only','client_visible','client_uploaded');
CREATE TYPE public.client_document_status AS ENUM ('requested','uploaded','needs_revision','approved','archived');

-- ============ company profile ============
CREATE TABLE public.client_company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL UNIQUE REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  legal_business_name text NOT NULL DEFAULT '',
  operating_name text NOT NULL DEFAULT '',
  primary_phone text NOT NULL DEFAULT '',
  primary_email text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  address_line1 text NOT NULL DEFAULT '',
  address_line2 text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  service_area text NOT NULL DEFAULT '',
  business_hours text NOT NULL DEFAULT '',
  primary_contact_name text NOT NULL DEFAULT '',
  primary_contact_email text NOT NULL DEFAULT '',
  primary_contact_phone text NOT NULL DEFAULT '',
  billing_contact_name text NOT NULL DEFAULT '',
  billing_contact_email text NOT NULL DEFAULT '',
  billing_contact_phone text NOT NULL DEFAULT '',
  preferred_communication_method text NOT NULL DEFAULT 'email',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ccp_comm_method_chk CHECK (preferred_communication_method IN ('email','phone','sms'))
);
CREATE INDEX ccp_org_idx ON public.client_company_profiles(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_company_profiles TO authenticated;
GRANT ALL ON public.client_company_profiles TO service_role;
ALTER TABLE public.client_company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY ccp_operator_all ON public.client_company_profiles
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY ccp_client_select ON public.client_company_profiles
  FOR SELECT TO authenticated
  USING (client_id = public.client_account_client_id(auth.uid())
         AND organization_id = public.client_account_org_id(auth.uid()));

CREATE POLICY ccp_client_insert ON public.client_company_profiles
  FOR INSERT TO authenticated
  WITH CHECK (client_id = public.client_account_client_id(auth.uid())
              AND organization_id = public.client_account_org_id(auth.uid())
              AND EXISTS (SELECT 1 FROM public.client_accounts ca
                          WHERE ca.user_id = auth.uid() AND ca.status='active' AND ca.role='client_admin'));

CREATE POLICY ccp_client_update ON public.client_company_profiles
  FOR UPDATE TO authenticated
  USING (client_id = public.client_account_client_id(auth.uid())
         AND EXISTS (SELECT 1 FROM public.client_accounts ca
                     WHERE ca.user_id = auth.uid() AND ca.status='active' AND ca.role='client_admin'))
  WITH CHECK (client_id = public.client_account_client_id(auth.uid())
              AND organization_id = public.client_account_org_id(auth.uid()));

CREATE TRIGGER ccp_touch BEFORE UPDATE ON public.client_company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ onboarding items ============
CREATE TABLE public.client_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  item_type public.client_onboarding_item_type NOT NULL DEFAULT 'other',
  owner public.client_onboarding_owner NOT NULL DEFAULT 'client',
  instructions text NOT NULL DEFAULT '',
  is_required boolean NOT NULL DEFAULT true,
  requires_review boolean NOT NULL DEFAULT false,
  requires_document boolean NOT NULL DEFAULT false,
  due_at timestamptz,
  status public.client_onboarding_status NOT NULL DEFAULT 'not_started',
  client_response text NOT NULL DEFAULT '',
  revision_note text NOT NULL DEFAULT '',
  blocked_reason text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  submitted_by uuid,
  completed_at timestamptz,
  completed_by uuid,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coi_client_idx ON public.client_onboarding_items(client_id, sort_order);
CREATE INDEX coi_org_idx ON public.client_onboarding_items(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_onboarding_items TO authenticated;
GRANT ALL ON public.client_onboarding_items TO service_role;
ALTER TABLE public.client_onboarding_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY coi_operator_all ON public.client_onboarding_items
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY coi_client_select ON public.client_onboarding_items
  FOR SELECT TO authenticated
  USING (client_id = public.client_account_client_id(auth.uid())
         AND organization_id = public.client_account_org_id(auth.uid()));

CREATE POLICY coi_client_update ON public.client_onboarding_items
  FOR UPDATE TO authenticated
  USING (client_id = public.client_account_client_id(auth.uid()))
  WITH CHECK (client_id = public.client_account_client_id(auth.uid()));

CREATE TRIGGER coi_touch BEFORE UPDATE ON public.client_onboarding_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Clients may only progress their own items. Everything else is rejected.
CREATE OR REPLACE FUNCTION public.client_onboarding_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_client_account(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF OLD.organization_id <> NEW.organization_id
     OR OLD.client_id <> NEW.client_id
     OR OLD.title <> NEW.title
     OR OLD.item_type <> NEW.item_type
     OR OLD.owner <> NEW.owner
     OR OLD.instructions <> NEW.instructions
     OR OLD.is_required <> NEW.is_required
     OR OLD.requires_review <> NEW.requires_review
     OR OLD.requires_document <> NEW.requires_document
     OR OLD.due_at IS DISTINCT FROM NEW.due_at
     OR OLD.sort_order <> NEW.sort_order
     OR OLD.revision_note <> NEW.revision_note
     OR OLD.blocked_reason <> NEW.blocked_reason
     OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at
     OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by THEN
    RAISE EXCEPTION 'only NorthStar Labs can change this item';
  END IF;
  IF OLD.owner <> 'client' THEN
    RAISE EXCEPTION 'this item is not assigned to you';
  END IF;
  IF NEW.status NOT IN ('in_progress','submitted') THEN
    RAISE EXCEPTION 'invalid status change';
  END IF;
  IF OLD.status IN ('approved','not_applicable','blocked') THEN
    RAISE EXCEPTION 'this item can no longer be changed';
  END IF;
  IF NEW.status = 'submitted' THEN
    NEW.submitted_at := now();
    NEW.submitted_by := auth.uid();
    IF NOT NEW.requires_review THEN
      NEW.completed_at := now();
      NEW.completed_by := auth.uid();
    ELSE
      NEW.completed_at := NULL;
      NEW.completed_by := NULL;
    END IF;
  ELSE
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.client_onboarding_guard() FROM anon, public;

CREATE TRIGGER coi_client_guard BEFORE UPDATE ON public.client_onboarding_items
  FOR EACH ROW EXECUTE FUNCTION public.client_onboarding_guard();

-- ============ documents ============
CREATE TABLE public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  onboarding_item_id uuid REFERENCES public.client_onboarding_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  visibility public.client_document_visibility NOT NULL DEFAULT 'client_visible',
  status public.client_document_status NOT NULL DEFAULT 'requested',
  is_required boolean NOT NULL DEFAULT true,
  storage_path text,
  file_name text,
  file_size bigint,
  file_type text,
  uploaded_by uuid,
  uploaded_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  revision_note text NOT NULL DEFAULT '',
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cd_client_idx ON public.client_documents(client_id, created_at DESC);
CREATE INDEX cd_org_idx ON public.client_documents(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_documents TO authenticated;
GRANT ALL ON public.client_documents TO service_role;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY cd_operator_all ON public.client_documents
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY cd_client_select ON public.client_documents
  FOR SELECT TO authenticated
  USING (client_id = public.client_account_client_id(auth.uid())
         AND organization_id = public.client_account_org_id(auth.uid())
         AND visibility <> 'internal_only');

CREATE POLICY cd_client_insert ON public.client_documents
  FOR INSERT TO authenticated
  WITH CHECK (client_id = public.client_account_client_id(auth.uid())
              AND organization_id = public.client_account_org_id(auth.uid())
              AND visibility = 'client_uploaded');

CREATE POLICY cd_client_update ON public.client_documents
  FOR UPDATE TO authenticated
  USING (client_id = public.client_account_client_id(auth.uid()) AND visibility <> 'internal_only')
  WITH CHECK (client_id = public.client_account_client_id(auth.uid()) AND visibility <> 'internal_only');

CREATE TRIGGER cd_touch BEFORE UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.client_documents_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_client_account(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.visibility := 'client_uploaded';
    NEW.status := 'uploaded';
    NEW.uploaded_by := auth.uid();
    NEW.uploaded_at := now();
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.revision_note := '';
    RETURN NEW;
  END IF;
  IF OLD.organization_id <> NEW.organization_id
     OR OLD.client_id <> NEW.client_id
     OR OLD.visibility <> NEW.visibility
     OR OLD.title <> NEW.title
     OR OLD.instructions <> NEW.instructions
     OR OLD.is_required <> NEW.is_required
     OR OLD.revision_note <> NEW.revision_note
     OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at
     OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by THEN
    RAISE EXCEPTION 'only NorthStar Labs can change this document record';
  END IF;
  IF OLD.status = 'approved' OR OLD.status = 'archived' THEN
    RAISE EXCEPTION 'this document can no longer be changed';
  END IF;
  IF NEW.status <> 'uploaded' THEN
    RAISE EXCEPTION 'invalid document status change';
  END IF;
  NEW.uploaded_by := auth.uid();
  NEW.uploaded_at := now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.client_documents_guard() FROM anon, public;

CREATE TRIGGER cd_client_guard BEFORE INSERT OR UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.client_documents_guard();

-- ============ client-safe notices / activity ============
CREATE TABLE public.client_workspace_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_notice boolean NOT NULL DEFAULT false,
  onboarding_item_id uuid REFERENCES public.client_onboarding_items(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.client_documents(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cwe_type_chk CHECK (event_type IN (
    'proposal_accepted','payment_received','invoice_ready','onboarding_item_assigned',
    'onboarding_item_submitted','onboarding_item_approved','onboarding_revision_requested',
    'document_requested','document_uploaded','document_approved','document_shared',
    'implementation_ready','service_activated'))
);
CREATE INDEX cwe_client_idx ON public.client_workspace_events(client_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_workspace_events TO authenticated;
GRANT ALL ON public.client_workspace_events TO service_role;
ALTER TABLE public.client_workspace_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY cwe_operator_all ON public.client_workspace_events
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY cwe_client_select ON public.client_workspace_events
  FOR SELECT TO authenticated
  USING (client_id = public.client_account_client_id(auth.uid())
         AND organization_id = public.client_account_org_id(auth.uid()));

-- ============ storage policies for the client-documents bucket ============
-- Path convention: <organization_id>/<client_id>/<file>
CREATE POLICY client_docs_operator_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'client-documents'
         AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()))
  WITH CHECK (bucket_id = 'client-documents'
         AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()));

CREATE POLICY client_docs_client_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents'
         AND ((storage.foldername(name))[1])::uuid = public.client_account_org_id(auth.uid())
         AND ((storage.foldername(name))[2])::uuid = public.client_account_client_id(auth.uid()));

CREATE POLICY client_docs_client_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents'
         AND ((storage.foldername(name))[1])::uuid = public.client_account_org_id(auth.uid())
         AND ((storage.foldername(name))[2])::uuid = public.client_account_client_id(auth.uid()));