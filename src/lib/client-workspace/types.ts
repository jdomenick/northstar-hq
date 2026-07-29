// Browser-safe types and copy for the NorthStar Labs client workspace.
// Nothing here performs data access.

export const ONBOARDING_STATUSES = [
  "not_started",
  "in_progress",
  "submitted",
  "needs_revision",
  "approved",
  "blocked",
  "not_applicable",
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const ONBOARDING_ITEM_TYPES = [
  "company_information",
  "contact_information",
  "service_area",
  "business_hours",
  "brand_assets",
  "system_access",
  "existing_software",
  "required_document",
  "approval",
  "other",
] as const;
export type OnboardingItemType = (typeof ONBOARDING_ITEM_TYPES)[number];

export type OnboardingOwner = "client" | "northstar";

export type DocumentVisibility = "internal_only" | "client_visible" | "client_uploaded";
export type DocumentStatus = "requested" | "uploaded" | "needs_revision" | "approved" | "archived";

export interface OnboardingItem {
  id: string;
  title: string;
  item_type: OnboardingItemType;
  owner: OnboardingOwner;
  instructions: string;
  is_required: boolean;
  requires_review: boolean;
  requires_document: boolean;
  due_at: string | null;
  status: OnboardingStatus;
  client_response: string;
  revision_note: string;
  blocked_reason: string;
  sort_order: number;
  submitted_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  documents: ClientDocument[];
}

export interface ClientDocument {
  id: string;
  title: string;
  instructions: string;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  is_required: boolean;
  uploaded_by_client: boolean;
  storage_path: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  uploaded_at: string | null;
  reviewed_at: string | null;
  revision_note: string;
  onboarding_item_id: string | null;
  created_at: string;
}

export interface WorkspaceEvent {
  id: string;
  event_type: string;
  title: string;
  body: string;
  is_notice: boolean;
  occurred_at: string;
}

export interface CompanyProfile {
  legal_business_name: string;
  operating_name: string;
  primary_phone: string;
  primary_email: string;
  website_url: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  service_area: string;
  business_hours: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  billing_contact_name: string;
  billing_contact_email: string;
  billing_contact_phone: string;
  preferred_communication_method: "email" | "phone" | "sms";
  updated_at: string | null;
}

export const EMPTY_COMPANY_PROFILE: CompanyProfile = {
  legal_business_name: "",
  operating_name: "",
  primary_phone: "",
  primary_email: "",
  website_url: "",
  address_line1: "",
  address_line2: "",
  city: "",
  region: "",
  postal_code: "",
  country: "",
  service_area: "",
  business_hours: "",
  primary_contact_name: "",
  primary_contact_email: "",
  primary_contact_phone: "",
  billing_contact_name: "",
  billing_contact_email: "",
  billing_contact_phone: "",
  preferred_communication_method: "email",
  updated_at: null,
};

export interface ClientInvoiceView {
  id: string;
  label: string;
  status: string;
  amount_cents: number;
  amount_paid_cents: number;
  amount_remaining_cents: number;
  currency: string;
  due_at: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
}

export interface DeliveryView {
  name: string;
  status: string;
  progress_percentage: number;
  next_action: string | null;
}

export type WorkspaceStage =
  | "proposal"
  | "payment"
  | "onboarding"
  | "review"
  | "implementation"
  | "active"
  | "paused"
  | "closed";

export interface WorkspaceNextStep {
  headline: string;
  detail: string;
  action: "pay" | "onboarding" | "documents" | "wait" | "contact" | "none";
}

export interface ClientWorkspaceData {
  stage: WorkspaceStage;
  stage_label: string;
  next_step: WorkspaceNextStep;
  company_profile: CompanyProfile;
  can_edit_company: boolean;
  onboarding: OnboardingItem[];
  documents: ClientDocument[];
  invoices: ClientInvoiceView[];
  delivery: DeliveryView | null;
  events: WorkspaceEvent[];
  notices: WorkspaceEvent[];
  storage_prefix: string;
}

export const ONBOARDING_STATUS_LABEL: Record<OnboardingStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted for review",
  needs_revision: "Needs revision",
  approved: "Approved",
  blocked: "Blocked",
  not_applicable: "Not applicable",
};

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  requested: "Requested",
  uploaded: "Uploaded, awaiting review",
  needs_revision: "Needs revision",
  approved: "Approved",
  archived: "Archived",
};

export const STAGE_LABEL: Record<WorkspaceStage, string> = {
  proposal: "Proposal stage",
  payment: "Awaiting payment",
  onboarding: "Onboarding",
  review: "Under review by NorthStar Labs",
  implementation: "Implementation",
  active: "Active engagement",
  paused: "Paused",
  closed: "Closed",
};

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(cents / 100);
}

export function onboardingProgress(items: OnboardingItem[]): {
  total: number;
  done: number;
  outstanding: number;
} {
  const relevant = items.filter((i) => i.status !== "not_applicable");
  const done = relevant.filter((i) => i.status === "approved" || i.status === "submitted").length;
  const outstanding = relevant.filter(
    (i) =>
      i.owner === "client" &&
      (i.status === "not_started" || i.status === "in_progress" || i.status === "needs_revision"),
  ).length;
  return { total: relevant.length, done, outstanding };
}