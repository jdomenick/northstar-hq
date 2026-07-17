ALTER TYPE public.sam_learning_event_type ADD VALUE IF NOT EXISTS 'workflow_run_completed';
ALTER TYPE public.sam_learning_event_type ADD VALUE IF NOT EXISTS 'workflow_run_failed';
ALTER TYPE public.sam_learning_event_type ADD VALUE IF NOT EXISTS 'workflow_marked_useful';
ALTER TYPE public.sam_learning_event_type ADD VALUE IF NOT EXISTS 'workflow_marked_partially_useful';
ALTER TYPE public.sam_learning_event_type ADD VALUE IF NOT EXISTS 'workflow_marked_not_useful';
ALTER TYPE public.sam_learning_event_type ADD VALUE IF NOT EXISTS 'workflow_marked_incorrect';
ALTER TYPE public.sam_learning_event_type ADD VALUE IF NOT EXISTS 'workflow_marked_missing_context';

CREATE UNIQUE INDEX IF NOT EXISTS sam_workflow_runs_active_scope_key
  ON public.sam_workflow_runs (
    organization_id,
    initiated_by,
    workflow_type,
    COALESCE(venture_id::text, ''),
    COALESCE((input_snapshot ->> 'entityId'), '')
  )
  WHERE status IN ('pending', 'running');