ALTER TABLE public.client_workspace_events DROP CONSTRAINT cwe_type_chk;
ALTER TABLE public.client_workspace_events ADD CONSTRAINT cwe_type_chk CHECK (event_type = ANY (ARRAY[
 'proposal_accepted','payment_received','invoice_ready','onboarding_item_assigned','onboarding_item_submitted',
 'onboarding_item_approved','onboarding_revision_requested','document_requested','document_uploaded',
 'document_approved','document_shared','implementation_ready','service_activated',
 'delivery_visible','delivery_stage_changed','milestone_completed','milestone_waiting_on_client',
 'deliverable_shared','deliverable_revision_requested','deliverable_approved']));