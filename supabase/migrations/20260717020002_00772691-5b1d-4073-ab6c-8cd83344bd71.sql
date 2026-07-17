
-- ENUMS
CREATE TYPE public.org_role AS ENUM ('owner','admin','executive','member','viewer');
CREATE TYPE public.member_status AS ENUM ('invited','active','suspended','removed');
CREATE TYPE public.venture_status AS ENUM ('idea','active','paused','at_risk','closed','archived');
CREATE TYPE public.goal_status AS ENUM ('proposed','active','at_risk','achieved','missed','paused','archived');
CREATE TYPE public.project_status AS ENUM ('proposed','planned','active','at_risk','blocked','completed','archived');
CREATE TYPE public.task_status AS ENUM ('backlog','ready','in_progress','waiting','blocked','completed','canceled');
CREATE TYPE public.decision_status AS ENUM ('draft','under_review','waiting_for_founder','decided','revisit_later','closed');
CREATE TYPE public.commitment_status AS ENUM ('open','in_progress','waiting','overdue','completed','canceled');
CREATE TYPE public.knowledge_type AS ENUM ('founder_profile','venture_knowledge','person','policy','brand_guideline','strategy','research','meeting_note','conversation_summary','operating_procedure','general');
CREATE TYPE public.verification_status AS ENUM ('unverified','verified','outdated','disputed');
CREATE TYPE public.document_processing_status AS ENUM ('uploaded','pending','processing','ready','failed');
CREATE TYPE public.conversation_message_role AS ENUM ('user','operator','system','tool');
CREATE TYPE public.integration_status AS ENUM ('disconnected','pending','connected','error','paused');
CREATE TYPE public.insight_severity AS ENUM ('information','attention','warning','critical','opportunity');
CREATE TYPE public.insight_status AS ENUM ('active','dismissed','resolved','expired');
CREATE TYPE public.priority_level AS ENUM ('low','normal','high','critical');

-- HELPERS
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  preferred_name TEXT,
  email TEXT,
  avatar_url TEXT,
  title TEXT,
  timezone TEXT DEFAULT 'UTC',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NULL))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  logo_url TEXT,
  industry TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORG MEMBERS
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  status public.member_status NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_org_members_user ON public.organization_members(user_id) WHERE status = 'active';
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE TRIGGER trg_org_members_updated BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- MEMBERSHIP HELPERS
CREATE OR REPLACE FUNCTION public.is_org_member(_org UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = _user AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.org_role_of(_org UUID, _user UUID)
RETURNS public.org_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = _org AND user_id = _user AND status = 'active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org UUID, _user UUID, _min public.org_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT public.org_role_of(_org,_user) AS role)
  SELECT CASE
    WHEN (SELECT role FROM r) IS NULL THEN false
    WHEN _min = 'viewer' THEN true
    WHEN _min = 'member' THEN (SELECT role FROM r) IN ('member','executive','admin','owner')
    WHEN _min = 'executive' THEN (SELECT role FROM r) IN ('executive','admin','owner')
    WHEN _min = 'admin' THEN (SELECT role FROM r) IN ('admin','owner')
    WHEN _min = 'owner' THEN (SELECT role FROM r) = 'owner'
    ELSE false END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_org UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.org_role_of(_org,_user) = 'owner';
$$;

CREATE POLICY "Members read organizations" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "Users create organizations" ON public.organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins update organization" ON public.organizations FOR UPDATE TO authenticated USING (public.has_org_role(id, auth.uid(), 'admin')) WITH CHECK (public.has_org_role(id, auth.uid(), 'admin'));
CREATE POLICY "Owners delete organization" ON public.organizations FOR DELETE TO authenticated USING (public.is_org_owner(id, auth.uid()));

CREATE POLICY "Members read fellow members" ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Self insert or admin invite" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins update members" ON public.organization_members FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins remove members" ON public.organization_members FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.protect_last_owner()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE remaining INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'owner' AND (NEW.role <> 'owner' OR NEW.status <> 'active') THEN
      SELECT count(*) INTO remaining FROM public.organization_members
        WHERE organization_id = OLD.organization_id AND role='owner' AND status='active' AND id <> OLD.id;
      IF remaining = 0 THEN RAISE EXCEPTION 'Cannot demote the final owner'; END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' AND OLD.status = 'active' THEN
      SELECT count(*) INTO remaining FROM public.organization_members
        WHERE organization_id = OLD.organization_id AND role='owner' AND status='active' AND id <> OLD.id;
      IF remaining = 0 THEN RAISE EXCEPTION 'Cannot remove the final owner'; END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_protect_last_owner_upd BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();
CREATE TRIGGER trg_protect_last_owner_del BEFORE DELETE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();

-- VENTURES
CREATE TABLE public.ventures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  mission TEXT,
  business_model TEXT,
  audience TEXT,
  website_url TEXT,
  logo_url TEXT,
  status public.venture_status NOT NULL DEFAULT 'active',
  priority public.priority_level NOT NULL DEFAULT 'normal',
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  current_focus TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (organization_id, slug)
);
CREATE INDEX idx_ventures_org ON public.ventures(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ventures_status ON public.ventures(organization_id, status) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ventures TO authenticated;
GRANT ALL ON public.ventures TO service_role;
ALTER TABLE public.ventures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read ventures" ON public.ventures FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create ventures" ON public.ventures FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update ventures" ON public.ventures FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'member')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete ventures" ON public.ventures FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_ventures_updated BEFORE UPDATE ON public.ventures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- GOALS
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT,
  status public.goal_status NOT NULL DEFAULT 'proposed',
  priority public.priority_level NOT NULL DEFAULT 'normal',
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date DATE,
  target_date DATE,
  target_value NUMERIC,
  current_value NUMERIC,
  unit TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_goals_org ON public.goals(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_goals_venture ON public.goals(venture_id) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read goals" ON public.goals FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update goals" ON public.goals FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'member')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete goals" ON public.goals FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  objective TEXT,
  desired_outcome TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority public.priority_level NOT NULL DEFAULT 'normal',
  status public.project_status NOT NULL DEFAULT 'planned',
  progress_percentage INT NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  start_date DATE,
  deadline DATE,
  next_action TEXT,
  risk_summary TEXT,
  blocker_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_projects_org ON public.projects(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_venture ON public.projects(venture_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_status ON public.projects(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_deadline ON public.projects(deadline) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read projects" ON public.projects FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'member')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority public.priority_level NOT NULL DEFAULT 'normal',
  status public.task_status NOT NULL DEFAULT 'backlog',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_tasks_org ON public.tasks(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_project ON public.tasks(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read tasks" ON public.tasks FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'member')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DECISIONS
CREATE TABLE public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  question TEXT,
  context TEXT,
  options_considered JSONB,
  operator_recommendation TEXT,
  evidence JSONB,
  risks JSONB,
  opportunity_cost TEXT,
  final_decision TEXT,
  rationale TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.decision_status NOT NULL DEFAULT 'draft',
  decision_date DATE,
  review_date DATE,
  outcome TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_decisions_org ON public.decisions(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_decisions_status ON public.decisions(organization_id, status) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read decisions" ON public.decisions FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create decisions" ON public.decisions FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update decisions" ON public.decisions FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'member')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete decisions" ON public.decisions FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_decisions_updated BEFORE UPDATE ON public.decisions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- COMMITMENTS
CREATE TABLE public.commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority public.priority_level NOT NULL DEFAULT 'normal',
  status public.commitment_status NOT NULL DEFAULT 'open',
  due_date DATE,
  original_due_date DATE,
  postponement_count INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_commitments_org ON public.commitments(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_commitments_owner ON public.commitments(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_commitments_due ON public.commitments(due_date) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commitments TO authenticated;
GRANT ALL ON public.commitments TO service_role;
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read commitments" ON public.commitments FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create commitments" ON public.commitments FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update commitments" ON public.commitments FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'member')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete commitments" ON public.commitments FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_commitments_updated BEFORE UPDATE ON public.commitments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- KNOWLEDGE
CREATE TABLE public.knowledge_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  knowledge_type public.knowledge_type NOT NULL DEFAULT 'general',
  content TEXT,
  source TEXT,
  source_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  importance public.priority_level NOT NULL DEFAULT 'normal',
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  effective_date DATE,
  expiration_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_knowledge_org ON public.knowledge_records(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_knowledge_type ON public.knowledge_records(organization_id, knowledge_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_knowledge_tags ON public.knowledge_records USING GIN (tags);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_records TO authenticated;
GRANT ALL ON public.knowledge_records TO service_role;
ALTER TABLE public.knowledge_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read knowledge" ON public.knowledge_records FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create knowledge" ON public.knowledge_records FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update knowledge" ON public.knowledge_records FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'member')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete knowledge" ON public.knowledge_records FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_knowledge_updated BEFORE UPDATE ON public.knowledge_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DOCUMENTS
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  knowledge_record_id UUID REFERENCES public.knowledge_records(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  processing_status public.document_processing_status NOT NULL DEFAULT 'uploaded',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_documents_org ON public.documents(organization_id) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read documents" ON public.documents FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update documents" ON public.documents FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'member')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete documents" ON public.documents FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CONVERSATIONS + MESSAGES
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  title TEXT,
  conversation_type TEXT,
  summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_conversations_org ON public.conversations(organization_id) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read conversations" ON public.conversations FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update conversations" ON public.conversations FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'member')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete conversations" ON public.conversations FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.conversation_message_role NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conv_messages_conv ON public.conversation_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read messages" ON public.conversation_messages FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create messages" ON public.conversation_messages FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update own messages" ON public.conversation_messages FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins delete messages" ON public.conversation_messages FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- INTEGRATIONS
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  display_name TEXT,
  status public.integration_status NOT NULL DEFAULT 'disconnected',
  permissions JSONB,
  last_synced_at TIMESTAMPTZ,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, integration_type)
);
CREATE INDEX idx_integrations_org ON public.integrations(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read integrations" ON public.integrations FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Admins ins integrations" ON public.integrations FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins upd integrations" ON public.integrations FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "Admins del integrations" ON public.integrations FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ACTIVITY EVENTS
CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id UUID,
  action TEXT NOT NULL,
  summary TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_org_created ON public.activity_events(organization_id, created_at DESC);
CREATE INDEX idx_activity_venture ON public.activity_events(venture_id, created_at DESC);
GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read activity" ON public.activity_events FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members write activity" ON public.activity_events FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- EXECUTIVE INSIGHTS
CREATE TABLE public.executive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  severity public.insight_severity NOT NULL DEFAULT 'information',
  status public.insight_status NOT NULL DEFAULT 'active',
  source_records JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_insights_org_status ON public.executive_insights(organization_id, status, generated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_insights TO authenticated;
GRANT ALL ON public.executive_insights TO service_role;
ALTER TABLE public.executive_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read insights" ON public.executive_insights FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create insights" ON public.executive_insights FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update insights" ON public.executive_insights FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'member')) WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete insights" ON public.executive_insights FOR DELETE TO authenticated USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_insights_updated BEFORE UPDATE ON public.executive_insights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STORAGE POLICIES for organization-documents (path: <organization_id>/...)
CREATE POLICY "Org members read files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'organization-documents' AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "Org members upload files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'organization-documents' AND public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), 'member'));
CREATE POLICY "Org members update files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'organization-documents' AND public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), 'member'));
CREATE POLICY "Org admins delete files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'organization-documents' AND public.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), 'admin'));
