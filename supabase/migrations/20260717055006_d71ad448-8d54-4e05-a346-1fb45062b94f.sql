
-- ============================================================
-- Phase 3B — SAM Memory & Executive Graph
-- ============================================================

-- ---------- ENUMS ----------
CREATE TYPE public.sam_memory_layer AS ENUM (
  'founder','organization','venture','operational','historical','preference'
);
CREATE TYPE public.sam_memory_status AS ENUM (
  'proposed','confirmed','disputed','outdated','superseded','archived'
);
CREATE TYPE public.sam_memory_source_type AS ENUM (
  'manual','profile','organization_settings','venture_settings',
  'knowledge_record','decision','commitment','goal','conversation',
  'correction','proposal','integration'
);
CREATE TYPE public.sam_memory_feedback_type AS ENUM (
  'accurate','inaccurate','incomplete','outdated','disputed'
);
CREATE TYPE public.graph_entity_type AS ENUM (
  'organization','profile','member','venture','project','task','goal',
  'decision','commitment','knowledge','document','memory','activity'
);
CREATE TYPE public.graph_relationship_type AS ENUM (
  'belongs_to','supports','blocks','depends_on','advances','contradicts',
  'informs','derived_from','related_to','assigned_to','owned_by',
  'supersedes','caused','resulted_in','references'
);
CREATE TYPE public.sam_learning_event_type AS ENUM (
  'recommendation_accepted','recommendation_rejected','recommendation_edited',
  'recommendation_ignored','memory_confirmed','memory_corrected',
  'memory_rejected','memory_disputed','memory_expired',
  'outcome_completed','outcome_failed','outcome_superseded'
);
CREATE TYPE public.sam_response_feedback_type AS ENUM (
  'helpful','not_helpful','partially_helpful','incorrect','missing_context'
);

-- ---------- sam_memory_items ----------
CREATE TABLE public.sam_memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  layer public.sam_memory_layer NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  statement text NOT NULL,
  structured_value jsonb,
  status public.sam_memory_status NOT NULL DEFAULT 'proposed',
  confidence_score numeric CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  confidence_band text CHECK (confidence_band IS NULL OR confidence_band IN ('low','moderate','high','very_high')),
  source_type public.sam_memory_source_type NOT NULL,
  source_entity_type text,
  source_entity_id uuid,
  source_message_id uuid REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  source_conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  source_knowledge_record_id uuid REFERENCES public.knowledge_records(id) ON DELETE SET NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  effective_at timestamptz,
  expires_at timestamptz,
  last_confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  superseded_by uuid REFERENCES public.sam_memory_items(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT sam_memory_owner_required_for_personal
    CHECK ((layer NOT IN ('founder','preference')) OR owner_user_id IS NOT NULL),
  CONSTRAINT sam_memory_venture_required_for_venture_layer
    CHECK ((layer <> 'venture') OR venture_id IS NOT NULL)
);
CREATE INDEX idx_sam_memory_org ON public.sam_memory_items(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sam_memory_org_status ON public.sam_memory_items(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sam_memory_owner ON public.sam_memory_items(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sam_memory_venture ON public.sam_memory_items(venture_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sam_memory_layer ON public.sam_memory_items(organization_id, layer) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sam_memory_items TO authenticated;
GRANT ALL ON public.sam_memory_items TO service_role;

ALTER TABLE public.sam_memory_items ENABLE ROW LEVEL SECURITY;

-- Read: org member for org/venture/operational/historical; owner-only for founder/preference
CREATE POLICY sam_memory_select_org ON public.sam_memory_items FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      layer IN ('organization','venture','operational','historical')
      OR (layer IN ('founder','preference') AND owner_user_id = auth.uid())
    )
  );

-- Insert: org member creating items; personal layers must be self-owned
CREATE POLICY sam_memory_insert ON public.sam_memory_items FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND (
      layer NOT IN ('founder','preference') OR owner_user_id = auth.uid()
    )
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- Update: org members can update org/venture/operational/historical; owners for personal
CREATE POLICY sam_memory_update ON public.sam_memory_items FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      layer IN ('organization','venture','operational','historical')
      OR (layer IN ('founder','preference') AND owner_user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND (
      layer IN ('organization','venture','operational','historical')
      OR (layer IN ('founder','preference') AND owner_user_id = auth.uid())
    )
  );

-- Delete: only admins may hard-delete (we soft-delete in code)
CREATE POLICY sam_memory_delete_admin ON public.sam_memory_items FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));

CREATE TRIGGER sam_memory_items_set_updated_at
  BEFORE UPDATE ON public.sam_memory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- sam_memory_versions ----------
CREATE TABLE public.sam_memory_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  memory_item_id uuid NOT NULL REFERENCES public.sam_memory_items(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_type text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (memory_item_id, version_number)
);
CREATE INDEX idx_sam_memory_versions_item ON public.sam_memory_versions(memory_item_id, version_number DESC);

GRANT SELECT, INSERT ON public.sam_memory_versions TO authenticated;
GRANT ALL ON public.sam_memory_versions TO service_role;

ALTER TABLE public.sam_memory_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sam_memory_versions_select ON public.sam_memory_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sam_memory_items i
      WHERE i.id = sam_memory_versions.memory_item_id
        AND public.is_org_member(i.organization_id, auth.uid())
        AND (
          i.layer IN ('organization','venture','operational','historical')
          OR (i.layer IN ('founder','preference') AND i.owner_user_id = auth.uid())
        )
    )
  );
CREATE POLICY sam_memory_versions_insert ON public.sam_memory_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- Version trigger — snapshot on material change
CREATE OR REPLACE FUNCTION public.sam_memory_snapshot_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_ver integer;
  changed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    next_ver := 1;
    changed := true;
  ELSE
    changed := (
      OLD.statement IS DISTINCT FROM NEW.statement OR
      OLD.title IS DISTINCT FROM NEW.title OR
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.structured_value IS DISTINCT FROM NEW.structured_value OR
      OLD.confidence_score IS DISTINCT FROM NEW.confidence_score OR
      OLD.category IS DISTINCT FROM NEW.category OR
      OLD.expires_at IS DISTINCT FROM NEW.expires_at
    );
    IF NOT changed THEN RETURN NEW; END IF;
    SELECT COALESCE(MAX(version_number),0)+1 INTO next_ver
      FROM public.sam_memory_versions WHERE memory_item_id = NEW.id;
  END IF;

  INSERT INTO public.sam_memory_versions
    (organization_id, memory_item_id, version_number, snapshot, change_type, changed_by)
  VALUES
    (NEW.organization_id, NEW.id, next_ver, to_jsonb(NEW),
     CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,
     COALESCE(NEW.confirmed_by, NEW.created_by, auth.uid()));
  RETURN NEW;
END;
$$;

CREATE TRIGGER sam_memory_items_version_snapshot
  AFTER INSERT OR UPDATE ON public.sam_memory_items
  FOR EACH ROW EXECUTE FUNCTION public.sam_memory_snapshot_version();

-- ---------- sam_memory_feedback ----------
CREATE TABLE public.sam_memory_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  memory_item_id uuid NOT NULL REFERENCES public.sam_memory_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type public.sam_memory_feedback_type NOT NULL,
  correction_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sam_memory_feedback_item ON public.sam_memory_feedback(memory_item_id, created_at DESC);

GRANT SELECT, INSERT ON public.sam_memory_feedback TO authenticated;
GRANT ALL ON public.sam_memory_feedback TO service_role;

ALTER TABLE public.sam_memory_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY sam_memory_feedback_select ON public.sam_memory_feedback FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY sam_memory_feedback_insert ON public.sam_memory_feedback FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

-- ---------- sam_memory_conflicts ----------
CREATE TABLE public.sam_memory_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  memory_item_a_id uuid NOT NULL REFERENCES public.sam_memory_items(id) ON DELETE CASCADE,
  memory_item_b_id uuid NOT NULL REFERENCES public.sam_memory_items(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sam_memory_conflicts_distinct CHECK (memory_item_a_id <> memory_item_b_id)
);
CREATE INDEX idx_sam_memory_conflicts_org ON public.sam_memory_conflicts(organization_id, status);

GRANT SELECT, INSERT, UPDATE ON public.sam_memory_conflicts TO authenticated;
GRANT ALL ON public.sam_memory_conflicts TO service_role;

ALTER TABLE public.sam_memory_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY sam_memory_conflicts_select ON public.sam_memory_conflicts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY sam_memory_conflicts_insert ON public.sam_memory_conflicts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY sam_memory_conflicts_update ON public.sam_memory_conflicts FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER sam_memory_conflicts_set_updated_at
  BEFORE UPDATE ON public.sam_memory_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- executive_graph_edges ----------
CREATE TABLE public.executive_graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_entity_type public.graph_entity_type NOT NULL,
  source_entity_id uuid NOT NULL,
  relationship_type public.graph_relationship_type NOT NULL,
  target_entity_type public.graph_entity_type NOT NULL,
  target_entity_id uuid NOT NULL,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  weight numeric NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 10),
  confidence_score numeric CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  source text NOT NULL DEFAULT 'derived',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT executive_graph_edges_no_self_loop
    CHECK (source_entity_id <> target_entity_id OR source_entity_type <> target_entity_type)
);
CREATE INDEX idx_graph_edges_org_src ON public.executive_graph_edges(organization_id, source_entity_type, source_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_graph_edges_org_tgt ON public.executive_graph_edges(organization_id, target_entity_type, target_entity_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_graph_edges_unique ON public.executive_graph_edges(
  organization_id, source_entity_type, source_entity_id, relationship_type, target_entity_type, target_entity_id
) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_graph_edges TO authenticated;
GRANT ALL ON public.executive_graph_edges TO service_role;

ALTER TABLE public.executive_graph_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY graph_edges_select ON public.executive_graph_edges FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY graph_edges_insert ON public.executive_graph_edges FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'member'::org_role)
    AND (created_by IS NULL OR created_by = auth.uid())
  );
CREATE POLICY graph_edges_update ON public.executive_graph_edges FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY graph_edges_delete ON public.executive_graph_edges FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));

CREATE TRIGGER executive_graph_edges_set_updated_at
  BEFORE UPDATE ON public.executive_graph_edges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Validate both endpoints belong to same organization for known entity types.
CREATE OR REPLACE FUNCTION public.validate_graph_edge_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src_org uuid;
  tgt_org uuid;
BEGIN
  -- Resolve source org
  CASE NEW.source_entity_type
    WHEN 'organization' THEN src_org := NEW.source_entity_id;
    WHEN 'venture'  THEN SELECT organization_id INTO src_org FROM public.ventures WHERE id = NEW.source_entity_id;
    WHEN 'project'  THEN SELECT organization_id INTO src_org FROM public.projects WHERE id = NEW.source_entity_id;
    WHEN 'task'     THEN SELECT organization_id INTO src_org FROM public.tasks WHERE id = NEW.source_entity_id;
    WHEN 'goal'     THEN SELECT organization_id INTO src_org FROM public.goals WHERE id = NEW.source_entity_id;
    WHEN 'decision' THEN SELECT organization_id INTO src_org FROM public.decisions WHERE id = NEW.source_entity_id;
    WHEN 'commitment' THEN SELECT organization_id INTO src_org FROM public.commitments WHERE id = NEW.source_entity_id;
    WHEN 'knowledge' THEN SELECT organization_id INTO src_org FROM public.knowledge_records WHERE id = NEW.source_entity_id;
    WHEN 'document' THEN SELECT organization_id INTO src_org FROM public.documents WHERE id = NEW.source_entity_id;
    WHEN 'memory'   THEN SELECT organization_id INTO src_org FROM public.sam_memory_items WHERE id = NEW.source_entity_id;
    WHEN 'activity' THEN SELECT organization_id INTO src_org FROM public.activity_events WHERE id = NEW.source_entity_id;
    WHEN 'member'   THEN SELECT organization_id INTO src_org FROM public.organization_members WHERE id = NEW.source_entity_id;
    WHEN 'profile'  THEN src_org := NEW.organization_id; -- profiles are user-global; accept edge org
    ELSE src_org := NULL;
  END CASE;

  CASE NEW.target_entity_type
    WHEN 'organization' THEN tgt_org := NEW.target_entity_id;
    WHEN 'venture'  THEN SELECT organization_id INTO tgt_org FROM public.ventures WHERE id = NEW.target_entity_id;
    WHEN 'project'  THEN SELECT organization_id INTO tgt_org FROM public.projects WHERE id = NEW.target_entity_id;
    WHEN 'task'     THEN SELECT organization_id INTO tgt_org FROM public.tasks WHERE id = NEW.target_entity_id;
    WHEN 'goal'     THEN SELECT organization_id INTO tgt_org FROM public.goals WHERE id = NEW.target_entity_id;
    WHEN 'decision' THEN SELECT organization_id INTO tgt_org FROM public.decisions WHERE id = NEW.target_entity_id;
    WHEN 'commitment' THEN SELECT organization_id INTO tgt_org FROM public.commitments WHERE id = NEW.target_entity_id;
    WHEN 'knowledge' THEN SELECT organization_id INTO tgt_org FROM public.knowledge_records WHERE id = NEW.target_entity_id;
    WHEN 'document' THEN SELECT organization_id INTO tgt_org FROM public.documents WHERE id = NEW.target_entity_id;
    WHEN 'memory'   THEN SELECT organization_id INTO tgt_org FROM public.sam_memory_items WHERE id = NEW.target_entity_id;
    WHEN 'activity' THEN SELECT organization_id INTO tgt_org FROM public.activity_events WHERE id = NEW.target_entity_id;
    WHEN 'member'   THEN SELECT organization_id INTO tgt_org FROM public.organization_members WHERE id = NEW.target_entity_id;
    WHEN 'profile'  THEN tgt_org := NEW.organization_id;
    ELSE tgt_org := NULL;
  END CASE;

  IF src_org IS NULL OR tgt_org IS NULL THEN
    RAISE EXCEPTION 'Graph edge references a non-existent entity';
  END IF;
  IF src_org <> NEW.organization_id OR tgt_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Graph edge crosses organization boundary';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER executive_graph_edges_validate
  BEFORE INSERT OR UPDATE ON public.executive_graph_edges
  FOR EACH ROW EXECUTE FUNCTION public.validate_graph_edge_scope();

-- ---------- sam_learning_events ----------
CREATE TABLE public.sam_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  invocation_id uuid REFERENCES public.sam_invocations(id) ON DELETE SET NULL,
  memory_item_id uuid REFERENCES public.sam_memory_items(id) ON DELETE SET NULL,
  event_type public.sam_learning_event_type NOT NULL,
  original_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  revised_payload jsonb,
  outcome_status text,
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sam_learning_events_org ON public.sam_learning_events(organization_id, created_at DESC);

GRANT SELECT, INSERT ON public.sam_learning_events TO authenticated;
GRANT ALL ON public.sam_learning_events TO service_role;

ALTER TABLE public.sam_learning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY sam_learning_events_select ON public.sam_learning_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY sam_learning_events_insert ON public.sam_learning_events FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()));

-- ---------- sam_response_feedback ----------
CREATE TABLE public.sam_response_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type public.sam_response_feedback_type NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);
CREATE INDEX idx_sam_response_feedback_msg ON public.sam_response_feedback(message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sam_response_feedback TO authenticated;
GRANT ALL ON public.sam_response_feedback TO service_role;

ALTER TABLE public.sam_response_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY sam_response_feedback_select ON public.sam_response_feedback FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY sam_response_feedback_write_own ON public.sam_response_feedback FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY sam_response_feedback_update_own ON public.sam_response_feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY sam_response_feedback_delete_own ON public.sam_response_feedback FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------- Extend sam_settings ----------
ALTER TABLE public.sam_settings
  ADD COLUMN IF NOT EXISTS allow_memory_proposals boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_founder_memory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_org_memory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_venture_memory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS retain_conversation_history boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS memory_review_reminders boolean NOT NULL DEFAULT true;

-- ---------- Extend sam_invocations ----------
ALTER TABLE public.sam_invocations
  ADD COLUMN IF NOT EXISTS memory_considered_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS memory_selected_ids   uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS memory_excluded_ids   uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conflict_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS graph_nodes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS graph_edges_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS graph_depth integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precedence_version text,
  ADD COLUMN IF NOT EXISTS memory_framework_version text,
  ADD COLUMN IF NOT EXISTS confidence_framework_version text,
  ADD COLUMN IF NOT EXISTS citation_lineage jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS learning_event_ids uuid[] NOT NULL DEFAULT '{}';
