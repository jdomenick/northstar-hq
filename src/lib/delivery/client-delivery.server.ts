// Server-only delivery visibility logic.
// Client reads go through the caller's RLS-bound client so the database is the
// authority. Client review decisions are validated here and then written with
// the service client, because the database guard deliberately blocks clients
// from writing deliverable state directly.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ClientIdentityError } from "@/lib/client-identity/errors";
import {
  resolveClientAccount,
  requireOrgMember,
  signStoragePath,
} from "@/lib/client-workspace/workspace.server";
import {
  deliveryProgress,
  isDeliverableStatus,
  isDeliveryStage,
  isMilestoneStatus,
  resolveDeliveryHealth,
  resolveDeliveryNextStep,
  stageLabelFor,
  type ClientDeliverable,
  type ClientDeliveryProject,
  type ClientDeliveryView,
  type ClientMilestone,
  type DeliveryStage,
  type MilestoneStatus,
} from "./client-delivery";

type SB = SupabaseClient<Database>;
type MilestoneRow = Database["public"]["Tables"]["client_delivery_milestones"]["Row"];
type DocRow = Database["public"]["Tables"]["client_documents"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

const MILESTONE_FIELDS =
  "id, project_id, title, description, status, target_date, completed_at, sort_order, requires_client_action, client_visible";
const DELIVERABLE_FIELDS =
  "id, title, instructions, version_label, deliverable_status, requires_client_review, milestone_id, project_id, file_name, storage_path, shared_at, approved_at, revision_reason, visibility, is_deliverable";
const PROJECT_FIELDS =
  "id, name, status, client_visible, client_title, client_summary, client_stage, client_stage_label, client_next_action, client_delivery_started_at, client_delivery_completed_at, created_at";

function toMilestone(row: Pick<MilestoneRow, keyof MilestoneRow>): ClientMilestone {
  const status: MilestoneStatus = isMilestoneStatus(row.status) ? row.status : "upcoming";
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status,
    target_date: row.target_date,
    completed_at: row.completed_at,
    requires_client_action: row.requires_client_action,
    sort_order: row.sort_order,
  };
}

function toDeliverable(row: DocRow): ClientDeliverable {
  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    version_label: row.version_label,
    status: isDeliverableStatus(row.deliverable_status) ? row.deliverable_status : "preparing",
    requires_client_review: row.requires_client_review,
    milestone_id: row.milestone_id,
    file_name: row.file_name,
    has_file: Boolean(row.storage_path),
    shared_at: row.shared_at,
    approved_at: row.approved_at,
    revision_reason: row.revision_reason,
  };
}

function projectStage(row: Pick<ProjectRow, "client_stage">): DeliveryStage {
  return isDeliveryStage(row.client_stage) ? row.client_stage : "preparation";
}

/* --------------------------------- client -------------------------------- */

export async function loadClientDelivery(supabase: SB, userId: string): Promise<ClientDeliveryView> {
  const acct = await resolveClientAccount(supabase, userId);
  return buildClientDelivery(supabase, acct);
}

/** Same client-facing delivery view for an explicit org + client scope. */
export async function buildClientDelivery(
  supabase: SB,
  acct: { organization_id: string; client_id: string },
): Promise<ClientDeliveryView> {


  // RLS restricts this to client-visible, non-deleted projects for this client.
  const projectRes = await supabase
    .from("projects")
    .select(PROJECT_FIELDS)
    .eq("client_id", acct.client_id)
    .eq("organization_id", acct.organization_id)
    .eq("client_visible", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (projectRes.error) throw new ClientIdentityError("internal_error", projectRes.error.message);

  const projectRow = projectRes.data;
  if (!projectRow) {
    const next = resolveDeliveryNextStep({
      project: null,
      health: "not_started",
      milestones: [],
      deliverables: [],
    });
    return {
      project: null,
      milestones: [],
      deliverables: [],
      next_step: next,
      progress: { total: 0, complete: 0, percent: null },
    };
  }

  const [milestoneRes, deliverableRes] = await Promise.all([
    supabase
      .from("client_delivery_milestones")
      .select(MILESTONE_FIELDS)
      .eq("project_id", projectRow.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("client_documents")
      .select(DELIVERABLE_FIELDS)
      .eq("project_id", projectRow.id)
      .eq("is_deliverable", true)
      .order("created_at", { ascending: true }),
  ]);

  if (milestoneRes.error) {
    throw new ClientIdentityError("internal_error", milestoneRes.error.message);
  }
  if (deliverableRes.error) {
    throw new ClientIdentityError("internal_error", deliverableRes.error.message);
  }

  const milestones = (milestoneRes.data ?? []).map((r) => toMilestone(r as MilestoneRow));
  const deliverables = (deliverableRes.data ?? [])
    .map((r) => toDeliverable(r as DocRow))
    // A deliverable the client cannot see yet is not shown at all.
    .filter((d) => d.status !== "preparing");

  const stage = projectStage(projectRow);
  const base = {
    id: projectRow.id,
    title: projectRow.client_title.trim() || projectRow.name,
    summary: projectRow.client_summary,
    stage,
    stage_label: stageLabelFor(stage, projectRow.client_stage_label),
    next_action: projectRow.client_next_action,
    started_at: projectRow.client_delivery_started_at,
    completed_at: projectRow.client_delivery_completed_at,
  };

  const health = resolveDeliveryHealth({
    projectStatus: projectRow.status,
    stage,
    milestones,
    deliverables,
  });

  const project: ClientDeliveryProject = { ...base, health };

  return {
    project,
    milestones,
    deliverables,
    next_step: resolveDeliveryNextStep({ project: base, health, milestones, deliverables }),
    progress: deliveryProgress(milestones),
  };
}

export async function createDeliverableDownloadUrl(
  supabase: SB,
  userId: string,
  documentId: string,
): Promise<string> {
  const acct = await resolveClientAccount(supabase, userId);
  const { data, error } = await supabase
    .from("client_documents")
    .select("storage_path, visibility, is_deliverable, deliverable_status")
    .eq("id", documentId)
    .eq("client_id", acct.client_id)
    .maybeSingle();
  if (error) throw new ClientIdentityError("internal_error", error.message);
  if (
    !data?.storage_path ||
    !data.is_deliverable ||
    data.visibility === "internal_only" ||
    data.deliverable_status === "preparing"
  ) {
    throw new ClientIdentityError("permission_denied");
  }
  return signStoragePath(data.storage_path);
}

export interface DeliverableDecision {
  documentId: string;
  decision: "approved" | "revision_requested";
  reason: string;
}

export async function decideDeliverable(
  supabase: SB,
  userId: string,
  input: DeliverableDecision,
): Promise<{ status: "approved" | "revision_requested" }> {
  const acct = await resolveClientAccount(supabase, userId);
  if (acct.role !== "client_admin") throw new ClientIdentityError("permission_denied");
  if (input.decision === "revision_requested" && input.reason.trim().length === 0) {
    throw new ClientIdentityError("invalid_input", "A revision reason is required.");
  }

  // Read through the caller's RLS so we only ever act on a row this client
  // is genuinely allowed to see.
  const { data, error } = await supabase
    .from("client_documents")
    .select("id, title, project_id, is_deliverable, deliverable_status, requires_client_review")
    .eq("id", input.documentId)
    .eq("client_id", acct.client_id)
    .eq("organization_id", acct.organization_id)
    .maybeSingle();
  if (error) throw new ClientIdentityError("internal_error", error.message);
  if (!data || !data.is_deliverable || !data.requires_client_review) {
    throw new ClientIdentityError("permission_denied");
  }
  if (data.deliverable_status !== "ready_for_review") {
    throw new ClientIdentityError("invalid_input", "This deliverable is not open for review.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const approved = input.decision === "approved";
  const update = await supabaseAdmin
    .from("client_documents")
    .update({
      deliverable_status: approved ? "approved" : "revision_requested",
      requires_client_review: approved ? false : true,
      approved_by: approved ? userId : null,
      approved_at: approved ? new Date().toISOString() : null,
      revision_reason: approved ? "" : input.reason.trim().slice(0, 2000),
    })
    .eq("id", data.id)
    // Idempotency guard: a duplicate submit cannot flip a settled decision.
    .eq("deliverable_status", "ready_for_review")
    .select("id")
    .maybeSingle();
  if (update.error) throw new ClientIdentityError("internal_error", update.error.message);
  if (!update.data) {
    throw new ClientIdentityError("invalid_input", "This deliverable was already reviewed.");
  }

  await supabaseAdmin.from("client_workspace_events").insert({
    organization_id: acct.organization_id,
    client_id: acct.client_id,
    document_id: data.id,
    event_type: approved ? "deliverable_approved" : "deliverable_revision_requested",
    title: approved
      ? `Approved "${data.title}"`
      : `Revision requested on "${data.title}"`,
    body: approved ? "" : input.reason.trim().slice(0, 2000),
    is_notice: false,
  });

  return { status: approved ? "approved" : "revision_requested" };
}

/* -------------------------------- operator ------------------------------- */

export interface OperatorDeliveryProject {
  id: string;
  name: string;
  status: string;
  client_visible: boolean;
  client_title: string;
  client_summary: string;
  client_stage: DeliveryStage;
  client_stage_label: string;
  client_next_action: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface OperatorDeliveryView {
  projects: OperatorDeliveryProject[];
  milestones: (ClientMilestone & { project_id: string; client_visible: boolean })[];
  deliverables: (ClientDeliverable & { project_id: string | null; visibility: string })[];
  candidate_documents: { id: string; title: string; file_name: string | null }[];
}

export async function loadOperatorDelivery(
  supabase: SB,
  organizationId: string,
  clientId: string,
  userId: string,
): Promise<OperatorDeliveryView> {
  await requireOrgMember(supabase, organizationId, userId);

  const [projectRes, docRes] = await Promise.all([
    supabase
      .from("projects")
      .select(PROJECT_FIELDS)
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_documents")
      .select(DELIVERABLE_FIELDS)
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);
  if (projectRes.error) throw new ClientIdentityError("internal_error", projectRes.error.message);
  if (docRes.error) throw new ClientIdentityError("internal_error", docRes.error.message);

  const projects: OperatorDeliveryProject[] = (projectRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    client_visible: p.client_visible,
    client_title: p.client_title,
    client_summary: p.client_summary,
    client_stage: projectStage(p),
    client_stage_label: p.client_stage_label,
    client_next_action: p.client_next_action,
    started_at: p.client_delivery_started_at,
    completed_at: p.client_delivery_completed_at,
  }));

  const milestoneRes = projects.length
    ? await supabase
        .from("client_delivery_milestones")
        .select(MILESTONE_FIELDS)
        .eq("organization_id", organizationId)
        .eq("client_id", clientId)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (milestoneRes.error) {
    throw new ClientIdentityError("internal_error", milestoneRes.error.message);
  }

  const docs = (docRes.data ?? []) as DocRow[];

  return {
    projects,
    milestones: (milestoneRes.data ?? []).map((r) => {
      const row = r as MilestoneRow;
      return { ...toMilestone(row), project_id: row.project_id, client_visible: row.client_visible };
    }),
    deliverables: docs
      .filter((d) => d.is_deliverable)
      .map((d) => ({ ...toDeliverable(d), project_id: d.project_id, visibility: d.visibility })),
    candidate_documents: docs
      .filter((d) => !d.is_deliverable && d.storage_path)
      .map((d) => ({ id: d.id, title: d.title, file_name: d.file_name })),
  };
}

export interface DeliveryVisibilityInput {
  projectId: string;
  clientId: string;
  client_visible: boolean;
  client_title: string;
  client_summary: string;
  client_stage: DeliveryStage;
  client_stage_label: string;
  client_next_action: string;
}

export async function saveDeliveryVisibility(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: DeliveryVisibilityInput,
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);

  const current = await supabase
    .from("projects")
    .select("id, client_visible, client_stage, client_delivery_started_at")
    .eq("id", input.projectId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (current.error) throw new ClientIdentityError("internal_error", current.error.message);
  if (!current.data) throw new ClientIdentityError("permission_denied");

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("projects")
    .update({
      client_id: input.clientId,
      client_visible: input.client_visible,
      client_title: input.client_title.slice(0, 200),
      client_summary: input.client_summary.slice(0, 2000),
      client_stage: input.client_stage,
      client_stage_label: input.client_stage_label.slice(0, 80),
      client_next_action: input.client_next_action.slice(0, 500),
      client_delivery_started_at:
        input.client_visible && !current.data.client_delivery_started_at
          ? nowIso
          : current.data.client_delivery_started_at,
      client_delivery_completed_at: input.client_stage === "complete" ? nowIso : null,
    })
    .eq("id", input.projectId)
    .eq("organization_id", organizationId);
  if (error) throw new ClientIdentityError("internal_error", error.message);

  const events: { event_type: string; title: string; is_notice: boolean }[] = [];
  if (input.client_visible && !current.data.client_visible) {
    events.push({
      event_type: "delivery_visible",
      title: "Your implementation plan is now available",
      is_notice: true,
    });
  } else if (input.client_visible && current.data.client_stage !== input.client_stage) {
    events.push({
      event_type: "delivery_stage_changed",
      title: `Delivery moved to ${stageLabelFor(input.client_stage, input.client_stage_label)}`,
      is_notice: false,
    });
  }
  for (const e of events) {
    await supabase.from("client_workspace_events").insert({
      organization_id: organizationId,
      client_id: input.clientId,
      event_type: e.event_type,
      title: e.title,
      body: "",
      is_notice: e.is_notice,
    });
  }
}

export interface MilestoneInput {
  id?: string;
  projectId: string;
  clientId: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  target_date: string | null;
  requires_client_action: boolean;
  client_visible: boolean;
  sort_order: number;
}

export async function upsertMilestone(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: MilestoneInput,
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);

  const payload = {
    organization_id: organizationId,
    client_id: input.clientId,
    project_id: input.projectId,
    title: input.title.slice(0, 200),
    description: input.description.slice(0, 2000),
    status: input.status,
    target_date: input.target_date,
    requires_client_action: input.requires_client_action,
    client_visible: input.client_visible,
    sort_order: input.sort_order,
  };

  let previousStatus: MilestoneStatus | null = null;
  if (input.id) {
    const prev = await supabase
      .from("client_delivery_milestones")
      .select("status")
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (prev.error) throw new ClientIdentityError("internal_error", prev.error.message);
    if (!prev.data) throw new ClientIdentityError("permission_denied");
    previousStatus = isMilestoneStatus(prev.data.status) ? prev.data.status : "upcoming";
    const { error } = await supabase
      .from("client_delivery_milestones")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", organizationId);
    if (error) throw new ClientIdentityError("internal_error", error.message);
  } else {
    const { error } = await supabase
      .from("client_delivery_milestones")
      .insert({ ...payload, created_by: userId });
    if (error) throw new ClientIdentityError("internal_error", error.message);
  }

  if (input.client_visible && input.status === "complete" && previousStatus !== "complete") {
    await supabase.from("client_workspace_events").insert({
      organization_id: organizationId,
      client_id: input.clientId,
      event_type: "milestone_completed",
      title: `Milestone complete: ${input.title.slice(0, 160)}`,
      body: "",
      is_notice: false,
    });
  }
  if (input.client_visible && input.status === "waiting_on_client" && previousStatus !== "waiting_on_client") {
    await supabase.from("client_workspace_events").insert({
      organization_id: organizationId,
      client_id: input.clientId,
      event_type: "milestone_waiting_on_client",
      title: `Action needed: ${input.title.slice(0, 160)}`,
      body: input.description.slice(0, 500),
      is_notice: true,
    });
  }
}

export async function deleteMilestone(
  supabase: SB,
  organizationId: string,
  userId: string,
  milestoneId: string,
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);
  const { error } = await supabase
    .from("client_delivery_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("organization_id", organizationId);
  if (error) throw new ClientIdentityError("internal_error", error.message);
}

export interface DeliverableShareInput {
  documentId: string;
  clientId: string;
  projectId: string;
  milestoneId: string | null;
  versionLabel: string;
  requiresClientReview: boolean;
  finalize: boolean;
}

/**
 * Promotes an existing client document into a delivery deliverable and shares
 * it. Nothing is marked shared unless the row actually has a stored file.
 */
export async function shareDeliverable(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: DeliverableShareInput,
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);

  const doc = await supabase
    .from("client_documents")
    .select("id, title, storage_path")
    .eq("id", input.documentId)
    .eq("organization_id", organizationId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (doc.error) throw new ClientIdentityError("internal_error", doc.error.message);
  if (!doc.data) throw new ClientIdentityError("permission_denied");
  if (!doc.data.storage_path) {
    throw new ClientIdentityError("invalid_input", "Upload a file before sharing it.");
  }

  const status = input.finalize
    ? "final"
    : input.requiresClientReview
      ? "ready_for_review"
      : "approved";

  const { error } = await supabase
    .from("client_documents")
    .update({
      is_deliverable: true,
      project_id: input.projectId,
      milestone_id: input.milestoneId,
      version_label: input.versionLabel.slice(0, 40),
      deliverable_status: status,
      requires_client_review: !input.finalize && input.requiresClientReview,
      visibility: "client_visible",
      shared_at: new Date().toISOString(),
      revision_reason: "",
      approved_by: null,
      approved_at: null,
    })
    .eq("id", input.documentId)
    .eq("organization_id", organizationId);
  if (error) throw new ClientIdentityError("internal_error", error.message);

  await supabase.from("client_workspace_events").insert({
    organization_id: organizationId,
    client_id: input.clientId,
    document_id: input.documentId,
    event_type: "deliverable_shared",
    title: input.requiresClientReview
      ? `Ready for your review: ${doc.data.title.slice(0, 160)}`
      : `New deliverable: ${doc.data.title.slice(0, 160)}`,
    body: "",
    is_notice: input.requiresClientReview,
  });
}