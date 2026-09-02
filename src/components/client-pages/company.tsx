import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClientWorkspace } from "@/components/client-shell";
import {
  LoadingRows,
  PageHeading,
  WORKSPACE_QUERY_KEY,
  WorkspaceError,
  useClientWorkspace,
  useReadOnlyPreview,
} from "@/components/client-workspace-ui";
import { saveClientCompanyProfileFn } from "@/lib/client-workspace/workspace.functions";
import type { CompanyProfile } from "@/lib/client-workspace/types";

type Draft = Omit<CompanyProfile, "updated_at">;

const FIELDS: Array<{ key: keyof Draft; label: string; multiline?: boolean }> = [
  { key: "legal_business_name", label: "Legal business name" },
  { key: "operating_name", label: "Operating name" },
  { key: "primary_phone", label: "Main phone" },
  { key: "primary_email", label: "Main email" },
  { key: "website_url", label: "Website" },
  { key: "address_line1", label: "Address line 1" },
  { key: "address_line2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "region", label: "State or region" },
  { key: "postal_code", label: "Postal code" },
  { key: "country", label: "Country" },
  { key: "service_area", label: "Service area", multiline: true },
  { key: "business_hours", label: "Business hours", multiline: true },
  { key: "primary_contact_name", label: "Primary contact name" },
  { key: "primary_contact_email", label: "Primary contact email" },
  { key: "primary_contact_phone", label: "Primary contact phone" },
  { key: "billing_contact_name", label: "Billing contact name" },
  { key: "billing_contact_email", label: "Billing contact email" },
  { key: "billing_contact_phone", label: "Billing contact phone" },
];

export function CompanyBody() {
  const { data, isLoading, isError } = useClientWorkspace();
  if (isLoading) return <LoadingRows />;
  if (isError || !data) {
    return <WorkspaceError message="We could not load your company information. Refresh to try again." />;
  }
  return (
    <CompanyForm
      initial={data.company_profile}
      canEdit={data.can_edit_company}
      key={data.company_profile.updated_at ?? "new"}
    />
  );
}

function CompanyForm({ initial, canEdit: canEditProp }: { initial: CompanyProfile; canEdit: boolean }) {
  const readOnly = useReadOnlyPreview();
  const canEdit = canEditProp && !readOnly;
  const { updated_at: _updatedAt, ...rest } = initial;
  const [draft, setDraft] = useState<Draft>(rest);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveClientCompanyProfileFn);
  const queryClient = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: draft });
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY });
      toast.success("Company information saved.");
    } catch {
      toast.error("We could not save that. Check the email fields and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <PageHeading
        label="Company information"
        title="Your company details"
        lead={
          canEdit
            ? "NorthStar Labs uses this for invoices, listings, and outreach. Keep it current."
            : "Only a client admin on your account can change these details."
        }
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className={field.multiline ? "sm:col-span-2" : undefined}>
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
              {field.label}
            </span>
            {field.multiline ? (
              <textarea
                rows={3}
                disabled={!canEdit}
                value={draft[field.key]}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                className="mt-2 w-full border border-foreground/20 bg-transparent p-3 text-[13.5px] text-foreground outline-none focus:border-foreground/50 disabled:opacity-60"
              />
            ) : (
              <input
                type="text"
                disabled={!canEdit}
                value={draft[field.key]}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                className="mt-2 w-full border border-foreground/20 bg-transparent p-3 text-[13.5px] text-foreground outline-none focus:border-foreground/50 disabled:opacity-60"
              />
            )}
          </label>
        ))}

        <label>
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
            Preferred contact method
          </span>
          <select
            disabled={!canEdit}
            value={draft.preferred_communication_method}
            onChange={(e) =>
              setDraft({
                ...draft,
                preferred_communication_method:
                  e.target.value as Draft["preferred_communication_method"],
              })
            }
            className="mt-2 w-full border border-foreground/20 bg-background p-3 text-[13.5px] text-foreground outline-none focus:border-foreground/50 disabled:opacity-60"
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="sms">Text message</option>
          </select>
        </label>
      </div>

      {canEdit ? (
        <button
          type="submit"
          disabled={busy}
          className="bg-foreground px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving" : "Save company information"}
        </button>
      ) : null}
    </form>
  );
}