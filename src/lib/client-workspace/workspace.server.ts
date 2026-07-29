// Server-only logic for the NorthStar Labs client workspace.
// Client-scoped tables are read through the caller's RLS-bound client.
// Internal tables (revenue_clients, billing_*, projects) are never exposed to
// clients directly; they are projected server-side into client-safe shapes
// after the caller's client account has been verified.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ClientIdentityError } from "@/lib/client-identity/errors";
import {
  EMPTY_COMPANY_PROFILE,
  STAGE_LABEL,
  type ClientDocument,
  type ClientInvoiceView,
  type ClientWorkspaceData,
  type CompanyProfile,
  type DeliveryView,
  type OnboardingItem,
  type OnboardingStatus,
  type WorkspaceEvent,
  type WorkspaceNextStep,
  type WorkspaceStage,
} from "./types";

type SB = SupabaseClient<Database>;
type EventType = Database["public"]["Tables"]["client_workspace_events"]["Insert"]["event_type"];

export interface ResolvedAccount {
  account_id: string;
  organization_id: string;
  client_id: string;
  role: "client_admin" | "client_user";
}

export async function resolveClientAccount(supabase: SB, userId: string): Promise<ResolvedAccount> {
  const { data, error } = await supabase
    .from("client_accounts")
    .select("id, organization_id, client_id, role, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new ClientIdentityError("internal_error");
  if (!data || data.status !== "active") throw new ClientIdentityError("account_not_found");
  return {
    account_id: data.id,
    organization_id: data.organization_id,
    client_id: data.client_id,
    role: data.role,
  };
}

export async function requireOrgMember(supabase: SB, organizationId: string, userId: string) {
  const { data, error } = await supabase.rpc("is_org_member", {
    _org: organizationId,
    _user: userId,
  });
  if (error || data !== true) throw new ClientIdentityError("permission_denied");
}

/* ------------------------------ projections ----------------------------- */

const DOC_FIELDS =
  "id, title, instructions, visibility, status, is_required, storage_path, file_name, file_size, file_type, uploaded_at, uploaded_by, requested_by, reviewed_at, revision_note, onboarding_item_id, created_at";
const ITEM_FIELDS =
  "id, title, item_type, owner, instructions, is_required, requires_review, requires_document, due_at, status, client_response, revision_note, blocked_reason, sort_order, submitted_at, completed_at, reviewed_at";

function toDocument(row: Database["public"]["Tables"]["client_documents"]["Row"]): ClientDocument {
  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    visibility: row.visibility,
    status: row.status,
    is_required: row.is_required,
    // Truthful origin flag: the client either created the row, or filled a
    // request that an operator opened. No user ids are exposed to the client.
    uploaded_by_client:
      row.visibility === "client_uploaded" ||
      (row.uploaded_by !== null && row.uploaded_by !== row.requested_by),
    storage_path: row.storage_path,
    file_name: row.file_name,
    file_size: row.file_size,
    file_type: row.file_type,
    uploaded_at: row.uploaded_at,
    reviewed_at: row.reviewed_at,
    revision_note: row.revision_note,
    onboarding_item_id: row.onboarding_item_id,
    created_at: row.created_at,
  };
}

function invoiceLabel(type: Database["public"]["Enums"]["billing_invoice_type"]): string {
  switch (type) {
    case "setup_deposit":
      return "Initial deposit";
    case "setup_final":
      return "Remaining setup balance";
    case "subscription":
      return "Monthly service";
    default:
      return "Adjustment";
  }
}

function toCompanyProfile(
  row: Database["public"]["Tables"]["client_company_profiles"]["Row"] | null,
): CompanyProfile {
  if (!row) return EMPTY_COMPANY_PROFILE;
  return {
    legal_business_name: row.legal_business_name,
    operating_name: row.operating_name,
    primary_phone: row.primary_phone,
    primary_email: row.primary_email,
    website_url: row.website_url,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    city: row.city,
    region: row.region,
    postal_code: row.postal_code,
    country: row.country,
    service_area: row.service_area,
    business_hours: row.business_hours,
    primary_contact_name: row.primary_contact_name,
    primary_contact_email: row.primary_contact_email,
    primary_contact_phone: row.primary_contact_phone,
    billing_contact_name: row.billing_contact_name,
    billing_contact_email: row.billing_contact_email,
    billing_contact_phone: row.billing_contact_phone,
    preferred_communication_method:
      row.preferred_communication_method as CompanyProfile["preferred_communication_method"],
    updated_at: row.updated_at,
  };
}

/* ----------------------------- stage resolver ---------------------------- */

export function resolveStage(input: {
  clientStatus: string;
  invoices: ClientInvoiceView[];
  onboarding: OnboardingItem[];
  delivery: DeliveryView | null;
}): { stage: WorkspaceStage; next: WorkspaceNextStep } {
  const { clientStatus, invoices, onboarding, delivery } = input;

  if (clientStatus === "paused") {
    return {
      stage: "paused",
      next: {
        headline: "Your engagement is paused.",
        detail: "Contact your NorthStar Labs representative to resume work.",
        action: "contact",
      },
    };
  }
  if (clientStatus === "churned") {
    return {
      stage: "closed",
      next: {
        headline: "This engagement has ended.",
        detail: "Your records remain available here for reference.",
        action: "none",
      },
    };
  }

  const openSetup = invoices.find(
    (i) => i.status === "open" && (i.label === "Initial deposit" || i.label === "Remaining setup balance"),
  );
  if (openSetup) {
    return {
      stage: "payment",
      next: {
        headline: `${openSetup.label} is ready for payment.`,
        detail: "Payment is processed securely by Stripe. Work continues once it clears.",
        action: "pay",
      },
    };
  }

  const clientOutstanding = onboarding.filter(
    (i) =>
      i.owner === "client" &&
      (i.status === "not_started" || i.status === "in_progress" || i.status === "needs_revision"),
  );
  if (clientOutstanding.length > 0) {
    const first = clientOutstanding[0];
    return {
      stage: "onboarding",
      next: {
        headline:
          clientOutstanding.length === 1
            ? `One onboarding item needs you: ${first.title}.`
            : `${clientOutstanding.length} onboarding items need you. Start with ${first.title}.`,
        detail:
          first.status === "needs_revision"
            ? "NorthStar Labs asked for a revision. Details are on the onboarding page."
            : "Complete each item on the onboarding page. Nothing is submitted until you send it.",
        action: first.requires_document ? "documents" : "onboarding",
      },
    };
  }

  const awaitingReview = onboarding.some((i) => i.status === "submitted");
  if (awaitingReview) {
    return {
      stage: "review",
      next: {
        headline: "Everything on your side is submitted.",
        detail: "NorthStar Labs is reviewing your submissions. You will be notified here.",
        action: "wait",
      },
    };
  }

  if (delivery && delivery.status !== "completed" && delivery.status !== "archived") {
    return {
      stage: "implementation",
      next: {
        headline: "Your implementation is underway.",
        detail: delivery.next_action ?? "NorthStar Labs will contact you if anything is needed.",
        action: "wait",
      },
    };
  }

  if (clientStatus === "active") {
    return {
      stage: "active",
      next: {
        headline: "Your service is active.",
        detail: "Nothing is required from you right now.",
        action: "none",
      },
    };
  }

  if (invoices.length === 0) {
    return {
      stage: "proposal",
      next: {
        headline: "Your proposal is being prepared.",
        detail: "NorthStar Labs will send your agreement and first invoice here.",
        action: "wait",
      },
    };
  }

  return {
    stage: "onboarding",
    next: {
      headline: "Onboarding is in progress.",
      detail: "NorthStar Labs will let you know when something is needed from you.",
      action: "wait",
    },
  };
}

/* ------------------------------ client reads ----------------------------- */

export async function loadClientWorkspace(supabase: SB, userId: string): Promise<ClientWorkspaceData> {
  const acct = await resolveClientAccount(supabase, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [profileRes, itemsRes, docsRes, eventsRes] = await Promise.all([
    supabase.from("client_company_profiles").select("*").eq("client_id", acct.client_id).maybeSingle(),
    supabase
      .from("client_onboarding_items")
      .select(ITEM_FIELDS)
      .eq("client_id", acct.client_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("client_documents")
      .select(DOC_FIELDS)
      .eq("client_id", acct.client_id)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("client_workspace_events")
      .select("id, event_type, title, body, is_notice, occurred_at")
      .eq("client_id", acct.client_id)
      .order("occurred_at", { ascending: false })
      .limit(25),
  ]);

  const documents = (docsRes.data ?? []).map((d) =>
    toDocument(d as Database["public"]["Tables"]["client_documents"]["Row"]),
  );

  const onboarding: OnboardingItem[] = (itemsRes.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    item_type: row.item_type,
    owner: row.owner,
    instructions: row.instructions,
    is_required: row.is_required,
    requires_review: row.requires_review,
    requires_document: row.requires_document,
    due_at: row.due_at,
    status: row.status,
    client_response: row.client_response,
    revision_note: row.revision_note,
    blocked_reason: row.blocked_reason,
    sort_order: row.sort_order,
    submitted_at: row.submitted_at,
    completed_at: row.completed_at,
    reviewed_at: row.reviewed_at,
    documents: documents.filter((d) => d.onboarding_item_id === row.id),
  }));

  const [clientRes, invoiceRes, projectRes] = await Promise.all([
    supabaseAdmin
      .from("revenue_clients")
      .select("id, name, status")
      .eq("id", acct.client_id)
      .eq("organization_id", acct.organization_id)
      .maybeSingle(),
    supabaseAdmin
      .from("billing_invoices")
      .select(
        "id, type, status, amount_cents, amount_paid_cents, currency, due_at, paid_at, hosted_invoice_url, invoice_pdf_url, created_at",
      )
      .eq("client_id", acct.client_id)
      .eq("organization_id", acct.organization_id)
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("projects")
      .select("client_title, name, status, progress_percentage, client_next_action")
      .eq("client_id", acct.client_id)
      .eq("organization_id", acct.organization_id)
      .eq("client_visible", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!clientRes.data) throw new ClientIdentityError("client_not_found");

  const invoices: ClientInvoiceView[] = (invoiceRes.data ?? []).map((inv) => ({
    id: inv.id,
    label: invoiceLabel(inv.type),
    status: inv.status,
    amount_cents: inv.amount_cents,
    amount_paid_cents: inv.amount_paid_cents,
    amount_remaining_cents: Math.max(0, inv.amount_cents - inv.amount_paid_cents),
    currency: inv.currency,
    due_at: inv.due_at,
    paid_at: inv.paid_at,
    hosted_invoice_url: inv.status === "open" ? inv.hosted_invoice_url : null,
    invoice_pdf_url: inv.invoice_pdf_url,
  }));

  const delivery: DeliveryView | null = projectRes.data
    ? {
        name: projectRes.data.client_title?.trim() || "Your implementation",
        status: projectRes.data.status,
        progress_percentage: projectRes.data.progress_percentage,
        next_action: projectRes.data.client_next_action?.trim() || null,
      }
    : null;

  const { stage, next } = resolveStage({
    clientStatus: clientRes.data.status,
    invoices,
    onboarding,
    delivery,
  });

  const events: WorkspaceEvent[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    event_type: e.event_type,
    title: e.title,
    body: e.body,
    is_notice: e.is_notice,
    occurred_at: e.occurred_at,
  }));

  return {
    stage,
    stage_label: STAGE_LABEL[stage],
    next_step: next,
    company_profile: toCompanyProfile(profileRes.data),
    can_edit_company: acct.role === "client_admin",
    onboarding,
    documents,
    invoices,
    delivery,
    events,
    notices: events.filter((e) => e.is_notice),
    storage_prefix: `${acct.organization_id}/${acct.client_id}`,
  };
}

/* ----------------------------- client writes ----------------------------- */

export async function saveCompanyProfile(
  supabase: SB,
  userId: string,
  patch: Omit<CompanyProfile, "updated_at">,
): Promise<void> {
  const acct = await resolveClientAccount(supabase, userId);
  if (acct.role !== "client_admin") throw new ClientIdentityError("permission_denied");
  const { error } = await supabase.from("client_company_profiles").upsert(
    {
      organization_id: acct.organization_id,
      client_id: acct.client_id,
      ...patch,
      updated_by: userId,
    },
    { onConflict: "client_id" },
  );
  if (error) throw new ClientIdentityError("internal_error", error.message);
}

export async function submitOnboardingItem(
  supabase: SB,
  userId: string,
  input: { itemId: string; status: "in_progress" | "submitted"; response: string },
): Promise<void> {
  const acct = await resolveClientAccount(supabase, userId);
  const { data: item, error: readErr } = await supabase
    .from("client_onboarding_items")
    .select("id, title, owner, status, requires_document")
    .eq("id", input.itemId)
    .eq("client_id", acct.client_id)
    .maybeSingle();
  if (readErr) throw new ClientIdentityError("internal_error");
  if (!item) throw new ClientIdentityError("client_not_found", "Item not found.");
  if (item.owner !== "client") throw new ClientIdentityError("permission_denied");

  if (input.status === "submitted" && item.requires_document) {
    const { count } = await supabase
      .from("client_documents")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_item_id", item.id)
      .not("storage_path", "is", null);
    if (!count) {
      throw new ClientIdentityError("invalid_input", "Attach the required file before submitting.");
    }
  }

  const { error } = await supabase
    .from("client_onboarding_items")
    .update({ status: input.status, client_response: input.response })
    .eq("id", item.id);
  if (error) throw new ClientIdentityError("internal_error", error.message);

  if (input.status === "submitted") {
    await recordWorkspaceEvent(supabase, {
      organization_id: acct.organization_id,
      client_id: acct.client_id,
      event_type: "onboarding_item_submitted",
      title: `You submitted "${item.title}"`,
      body: "NorthStar Labs will review this and let you know if anything else is needed.",
      onboarding_item_id: item.id,
    });
  }
}

export async function registerClientUpload(
  supabase: SB,
  userId: string,
  input: {
    documentId: string | null;
    onboardingItemId: string | null;
    title: string;
    storagePath: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  },
): Promise<{ id: string }> {
  const acct = await resolveClientAccount(supabase, userId);
  const prefix = `${acct.organization_id}/${acct.client_id}/`;
  if (!input.storagePath.startsWith(prefix)) {
    throw new ClientIdentityError("permission_denied", "Invalid upload location.");
  }

  const file = {
    storage_path: input.storagePath,
    file_name: input.fileName,
    file_size: input.fileSize,
    file_type: input.fileType,
    status: "uploaded" as const,
  };

  let documentId = input.documentId;
  if (documentId) {
    const { error } = await supabase
      .from("client_documents")
      .update(file)
      .eq("id", documentId)
      .eq("client_id", acct.client_id);
    if (error) throw new ClientIdentityError("permission_denied", error.message);
  } else {
    const { data, error } = await supabase
      .from("client_documents")
      .insert({
        organization_id: acct.organization_id,
        client_id: acct.client_id,
        onboarding_item_id: input.onboardingItemId,
        title: input.title,
        visibility: "client_uploaded",
        is_required: false,
        ...file,
      })
      .select("id")
      .single();
    if (error) throw new ClientIdentityError("permission_denied", error.message);
    documentId = data.id;
  }

  await recordWorkspaceEvent(supabase, {
    organization_id: acct.organization_id,
    client_id: acct.client_id,
    event_type: "document_uploaded",
    title: `You uploaded "${input.title}"`,
    body: "NorthStar Labs will review this file.",
    document_id: documentId,
    onboarding_item_id: input.onboardingItemId,
  });

  return { id: documentId };
}

export async function createDocumentDownloadUrl(
  supabase: SB,
  userId: string,
  documentId: string,
): Promise<string> {
  const acct = await resolveClientAccount(supabase, userId);
  const { data, error } = await supabase
    .from("client_documents")
    .select("storage_path, visibility")
    .eq("id", documentId)
    .eq("client_id", acct.client_id)
    .maybeSingle();
  if (error) throw new ClientIdentityError("internal_error");
  if (!data?.storage_path || data.visibility === "internal_only") {
    throw new ClientIdentityError("permission_denied");
  }
  return signStoragePath(data.storage_path);
}

export async function signStoragePath(path: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from("client-documents")
    .createSignedUrl(path, 300);
  if (error || !data) throw new ClientIdentityError("internal_error", error?.message);
  return data.signedUrl;
}

/* -------------------------------- events -------------------------------- */

export async function recordWorkspaceEvent(
  supabase: SB,
  input: {
    organization_id: string;
    client_id: string;
    event_type: EventType;
    title: string;
    body?: string;
    is_notice?: boolean;
    onboarding_item_id?: string | null;
    document_id?: string | null;
    invoice_id?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("client_workspace_events").insert({
    organization_id: input.organization_id,
    client_id: input.client_id,
    event_type: input.event_type,
    title: input.title,
    body: input.body ?? "",
    is_notice: input.is_notice ?? false,
    onboarding_item_id: input.onboarding_item_id ?? null,
    document_id: input.document_id ?? null,
    invoice_id: input.invoice_id ?? null,
  });
  if (error) console.error("[client_workspace_events] insert failed", error.message);
}

/* ------------------------------ operator side ---------------------------- */

export interface OperatorWorkspaceView {
  client: { id: string; name: string; status: string };
  company_profile: CompanyProfile;
  onboarding: OnboardingItem[];
  documents: ClientDocument[];
  events: WorkspaceEvent[];
  accounts: number;
}

export async function loadOperatorWorkspace(
  supabase: SB,
  organizationId: string,
  clientId: string,
  userId: string,
): Promise<OperatorWorkspaceView> {
  await requireOrgMember(supabase, organizationId, userId);
  const [clientRes, profileRes, itemsRes, docsRes, eventsRes, accountRes] = await Promise.all([
    supabase
      .from("revenue_clients")
      .select("id, name, status")
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.from("client_company_profiles").select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("client_onboarding_items")
      .select(ITEM_FIELDS)
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("client_documents")
      .select(DOC_FIELDS)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_workspace_events")
      .select("id, event_type, title, body, is_notice, occurred_at")
      .eq("client_id", clientId)
      .order("occurred_at", { ascending: false })
      .limit(30),
    supabase
      .from("client_accounts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "active"),
  ]);
  if (!clientRes.data) throw new ClientIdentityError("client_not_found");

  const documents = (docsRes.data ?? []).map((d) =>
    toDocument(d as Database["public"]["Tables"]["client_documents"]["Row"]),
  );

  return {
    client: clientRes.data,
    company_profile: toCompanyProfile(profileRes.data),
    onboarding: (itemsRes.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      item_type: row.item_type,
      owner: row.owner,
      instructions: row.instructions,
      is_required: row.is_required,
      requires_review: row.requires_review,
      requires_document: row.requires_document,
      due_at: row.due_at,
      status: row.status,
      client_response: row.client_response,
      revision_note: row.revision_note,
      blocked_reason: row.blocked_reason,
      sort_order: row.sort_order,
      submitted_at: row.submitted_at,
      completed_at: row.completed_at,
      reviewed_at: row.reviewed_at,
      documents: documents.filter((d) => d.onboarding_item_id === row.id),
    })),
    documents,
    events: (eventsRes.data ?? []).map((e) => ({
      id: e.id,
      event_type: e.event_type,
      title: e.title,
      body: e.body,
      is_notice: e.is_notice,
      occurred_at: e.occurred_at,
    })),
    accounts: accountRes.count ?? 0,
  };
}

export const DEFAULT_CHECKLIST: Array<{
  title: string;
  item_type: Database["public"]["Enums"]["client_onboarding_item_type"];
  instructions: string;
  requires_document: boolean;
  requires_review: boolean;
}> = [
  {
    title: "Confirm company information",
    item_type: "company_information",
    instructions: "Complete the company page so invoices, listings, and outreach use correct details.",
    requires_document: false,
    requires_review: true,
  },
  {
    title: "Confirm primary and billing contacts",
    item_type: "contact_information",
    instructions: "Tell us who we contact for day to day work and who handles billing.",
    requires_document: false,
    requires_review: true,
  },
  {
    title: "Confirm service area",
    item_type: "service_area",
    instructions: "List the cities, regions, or radius you serve.",
    requires_document: false,
    requires_review: true,
  },
  {
    title: "Confirm business hours",
    item_type: "business_hours",
    instructions: "Include after hours handling if it differs.",
    requires_document: false,
    requires_review: false,
  },
  {
    title: "Upload brand assets",
    item_type: "brand_assets",
    instructions: "Logo files, brand colors, and any existing marketing material.",
    requires_document: true,
    requires_review: true,
  },
  {
    title: "List existing software and tools",
    item_type: "existing_software",
    instructions: "CRM, scheduling, phone system, email platform, and anything else we should connect to.",
    requires_document: false,
    requires_review: true,
  },
  {
    title: "Provide required system access",
    item_type: "system_access",
    instructions:
      "We will request access one system at a time. Never send passwords here. Use the invite flow of each platform.",
    requires_document: false,
    requires_review: true,
  },
];

export async function seedChecklist(
  supabase: SB,
  organizationId: string,
  clientId: string,
  userId: string,
): Promise<{ created: number }> {
  await requireOrgMember(supabase, organizationId, userId);
  const { count } = await supabase
    .from("client_onboarding_items")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  if (count && count > 0) return { created: 0 };

  const rows = DEFAULT_CHECKLIST.map((item, index) => ({
    organization_id: organizationId,
    client_id: clientId,
    title: item.title,
    item_type: item.item_type,
    owner: "client" as const,
    instructions: item.instructions,
    requires_document: item.requires_document,
    requires_review: item.requires_review,
    sort_order: index,
    created_by: userId,
  }));
  const { error } = await supabase.from("client_onboarding_items").insert(rows);
  if (error) throw new ClientIdentityError("internal_error", error.message);

  await recordWorkspaceEvent(supabase, {
    organization_id: organizationId,
    client_id: clientId,
    event_type: "onboarding_item_assigned",
    title: "Your onboarding checklist is ready",
    body: "Open the onboarding page to see what is needed from you.",
    is_notice: true,
  });
  return { created: rows.length };
}

export async function upsertOnboardingItem(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: {
    id?: string;
    clientId: string;
    title: string;
    item_type: Database["public"]["Enums"]["client_onboarding_item_type"];
    owner: "client" | "northstar";
    instructions: string;
    is_required: boolean;
    requires_review: boolean;
    requires_document: boolean;
    due_at: string | null;
  },
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);
  const payload = {
    organization_id: organizationId,
    client_id: input.clientId,
    title: input.title,
    item_type: input.item_type,
    owner: input.owner,
    instructions: input.instructions,
    is_required: input.is_required,
    requires_review: input.requires_review,
    requires_document: input.requires_document,
    due_at: input.due_at,
  };
  if (input.id) {
    const { error } = await supabase
      .from("client_onboarding_items")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", organizationId);
    if (error) throw new ClientIdentityError("internal_error", error.message);
    return;
  }
  const { data: last } = await supabase
    .from("client_onboarding_items")
    .select("sort_order")
    .eq("client_id", input.clientId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("client_onboarding_items")
    .insert({ ...payload, sort_order: (last?.sort_order ?? -1) + 1, created_by: userId })
    .select("id")
    .single();
  if (error) throw new ClientIdentityError("internal_error", error.message);
  await recordWorkspaceEvent(supabase, {
    organization_id: organizationId,
    client_id: input.clientId,
    event_type: "onboarding_item_assigned",
    title: `New onboarding item: ${input.title}`,
    body: input.instructions,
    is_notice: input.owner === "client",
    onboarding_item_id: data.id,
  });
}

export async function reviewOnboardingItem(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: {
    itemId: string;
    decision: Extract<OnboardingStatus, "approved" | "needs_revision" | "blocked" | "not_applicable">;
    note: string;
  },
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);
  const { data: item } = await supabase
    .from("client_onboarding_items")
    .select("id, client_id, title")
    .eq("id", input.itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!item) throw new ClientIdentityError("client_not_found");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("client_onboarding_items")
    .update({
      status: input.decision,
      reviewed_at: now,
      reviewed_by: userId,
      revision_note: input.decision === "needs_revision" ? input.note : "",
      blocked_reason: input.decision === "blocked" ? input.note : "",
      completed_at: input.decision === "approved" ? now : null,
      completed_by: input.decision === "approved" ? userId : null,
    })
    .eq("id", item.id);
  if (error) throw new ClientIdentityError("internal_error", error.message);

  if (input.decision === "approved" || input.decision === "needs_revision") {
    await recordWorkspaceEvent(supabase, {
      organization_id: organizationId,
      client_id: item.client_id,
      event_type:
        input.decision === "approved" ? "onboarding_item_approved" : "onboarding_revision_requested",
      title:
        input.decision === "approved"
          ? `"${item.title}" was approved`
          : `"${item.title}" needs a revision`,
      body: input.decision === "needs_revision" ? input.note : "",
      is_notice: input.decision === "needs_revision",
      onboarding_item_id: item.id,
    });
  }
}

export async function requestDocument(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: {
    clientId: string;
    title: string;
    instructions: string;
    isRequired: boolean;
    onboardingItemId: string | null;
  },
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);
  const { data, error } = await supabase
    .from("client_documents")
    .insert({
      organization_id: organizationId,
      client_id: input.clientId,
      title: input.title,
      instructions: input.instructions,
      is_required: input.isRequired,
      onboarding_item_id: input.onboardingItemId,
      visibility: "client_visible",
      status: "requested",
      requested_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new ClientIdentityError("internal_error", error.message);
  await recordWorkspaceEvent(supabase, {
    organization_id: organizationId,
    client_id: input.clientId,
    event_type: "document_requested",
    title: `Document requested: ${input.title}`,
    body: input.instructions,
    is_notice: true,
    document_id: data.id,
  });
}

export async function reviewDocument(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: { documentId: string; decision: "approved" | "needs_revision" | "archived"; note: string },
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);
  const { data: doc } = await supabase
    .from("client_documents")
    .select("id, client_id, title")
    .eq("id", input.documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!doc) throw new ClientIdentityError("client_not_found");
  const { error } = await supabase
    .from("client_documents")
    .update({
      status: input.decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      revision_note: input.decision === "needs_revision" ? input.note : "",
    })
    .eq("id", doc.id);
  if (error) throw new ClientIdentityError("internal_error", error.message);
  if (input.decision === "approved") {
    await recordWorkspaceEvent(supabase, {
      organization_id: organizationId,
      client_id: doc.client_id,
      event_type: "document_approved",
      title: `"${doc.title}" was approved`,
      document_id: doc.id,
    });
  }
}

export async function setDocumentVisibility(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: { documentId: string; visibility: "internal_only" | "client_visible" },
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);
  const { data: doc } = await supabase
    .from("client_documents")
    .select("id, client_id, title")
    .eq("id", input.documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!doc) throw new ClientIdentityError("client_not_found");
  const { error } = await supabase
    .from("client_documents")
    .update({ visibility: input.visibility })
    .eq("id", doc.id);
  if (error) throw new ClientIdentityError("internal_error", error.message);
  if (input.visibility === "client_visible") {
    await recordWorkspaceEvent(supabase, {
      organization_id: organizationId,
      client_id: doc.client_id,
      event_type: "document_shared",
      title: `NorthStar Labs shared "${doc.title}" with you`,
      is_notice: true,
      document_id: doc.id,
    });
  }
}

export async function registerOperatorUpload(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: {
    clientId: string;
    title: string;
    storagePath: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    visibility: "internal_only" | "client_visible";
  },
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);
  const prefix = `${organizationId}/${input.clientId}/`;
  if (!input.storagePath.startsWith(prefix)) {
    throw new ClientIdentityError("invalid_input", "Invalid upload location.");
  }
  const { data, error } = await supabase
    .from("client_documents")
    .insert({
      organization_id: organizationId,
      client_id: input.clientId,
      title: input.title,
      visibility: input.visibility,
      status: "approved",
      is_required: false,
      storage_path: input.storagePath,
      file_name: input.fileName,
      file_size: input.fileSize,
      file_type: input.fileType,
      uploaded_by: userId,
      uploaded_at: new Date().toISOString(),
      requested_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new ClientIdentityError("internal_error", error.message);
  if (input.visibility === "client_visible") {
    await recordWorkspaceEvent(supabase, {
      organization_id: organizationId,
      client_id: input.clientId,
      event_type: "document_shared",
      title: `NorthStar Labs shared "${input.title}" with you`,
      is_notice: true,
      document_id: data.id,
    });
  }
}

export async function createOperatorDownloadUrl(
  supabase: SB,
  organizationId: string,
  userId: string,
  documentId: string,
): Promise<string> {
  await requireOrgMember(supabase, organizationId, userId);
  const { data } = await supabase
    .from("client_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data?.storage_path) throw new ClientIdentityError("client_not_found");
  return signStoragePath(data.storage_path);
}

export async function postClientNotice(
  supabase: SB,
  organizationId: string,
  userId: string,
  input: { clientId: string; title: string; body: string },
): Promise<void> {
  await requireOrgMember(supabase, organizationId, userId);
  await recordWorkspaceEvent(supabase, {
    organization_id: organizationId,
    client_id: input.clientId,
    event_type: "onboarding_item_assigned",
    title: input.title,
    body: input.body,
    is_notice: true,
  });
}