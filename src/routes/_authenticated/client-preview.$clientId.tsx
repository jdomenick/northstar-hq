import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useOrg } from "@/lib/org-context";
import { ClientPreviewProvider } from "@/lib/client-preview/context";
import { getClientPreviewContextFn } from "@/lib/client-preview/preview.functions";
import { Overview } from "@/components/client-pages/overview";
import { OnboardingBody } from "@/components/client-pages/onboarding";
import { DocumentsBody } from "@/components/client-pages/documents";
import { Delivery } from "@/components/client-pages/delivery";
import { ReportBody } from "@/components/client-pages/report";
import { BillingBody } from "@/components/client-pages/billing";
import { CompanyBody } from "@/components/client-pages/company";
import { ProfileForm } from "@/components/client-pages/profile";
import { roleLabel } from "@/lib/client-identity/types";

export const Route = createFileRoute("/_authenticated/client-preview/$clientId")({
  ssr: false,
  component: ClientPreviewPage,
  head: () => ({
    meta: [
      { title: "View as client | NorthStar Command" },
      {
        name: "description",
        content: "Read-only internal preview of the client workspace for a single client.",
      },
      { property: "og:title", content: "View as client | NorthStar Command" },
      {
        property: "og:description",
        content: "Read-only internal preview of the client workspace for a single client.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const TABS = [
  "Overview",
  "Onboarding",
  "Documents",
  "Delivery",
  "Executive report",
  "Billing",
  "Company",
  "Profile",
] as const;
type Tab = (typeof TABS)[number];

function ClientPreviewPage() {
  const { clientId } = Route.useParams();
  const { activeOrgId } = useOrg();
  const loadCtx = useServerFn(getClientPreviewContextFn);
  const [tab, setTab] = useState<Tab>("Overview");

  const ctxQ = useQuery({
    queryKey: ["client-preview-context", activeOrgId, clientId],
    queryFn: () => loadCtx({ data: { organizationId: activeOrgId!, clientId } }),
    enabled: Boolean(activeOrgId),
    retry: false,
  });

  if (!activeOrgId) {
    return <Shell>Select an organization to preview a client workspace.</Shell>;
  }
  if (ctxQ.isLoading) return <Shell>Loading preview…</Shell>;
  if (ctxQ.isError || !ctxQ.data) {
    return (
      <Shell>
        This preview is not available. It requires an organization admin or owner, and the client
        must belong to the active organization.
      </Shell>
    );
  }

  const { company, account } = ctxQ.data;

  return (
    <ClientPreviewProvider
      value={{ organizationId: activeOrgId, clientId, companyName: company.name }}
    >
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-30 border-b border-amber-500/40 bg-amber-500/10 px-5 py-2.5 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-foreground">
              Internal preview, read-only. Viewing as {company.name}.
            </div>
            <Link
              to="/clients/$clientId"
              params={{ clientId }}
              className="text-[11px] uppercase tracking-[0.18em] underline underline-offset-4 text-foreground/70 hover:text-foreground"
            >
              Exit preview
            </Link>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-5 py-6">
          <nav className="flex flex-wrap gap-4 border-b border-foreground/12 pb-4 text-[11px] uppercase tracking-[0.18em]">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  t === tab ? "text-foreground" : "text-foreground/55 hover:text-foreground"
                }
              >
                {t}
              </button>
            ))}
          </nav>

          <main className="py-8">
            {tab === "Overview" && (
              <Overview
                companyName={company.name}
                role={roleLabel(account?.role ?? "client_admin")}
                email={account?.email ?? "No client login invited yet"}
              />
            )}
            {tab === "Onboarding" && <OnboardingBody />}
            {tab === "Documents" && <DocumentsBody />}
            {tab === "Delivery" && <Delivery />}
            {tab === "Executive report" && <ReportBody />}
            {tab === "Billing" && <BillingBody />}
            {tab === "Company" && <CompanyBody />}
            {tab === "Profile" &&
              (account ? (
                <ProfileForm
                  initial={{
                    first_name: account.first_name,
                    last_name: account.last_name,
                    phone: account.phone ?? "",
                    preferred_contact_method: account.preferred_contact_method,
                  }}
                  email={account.email}
                />
              ) : (
                <p className="text-[13px] text-foreground/60">
                  No client login has been invited yet, so there is no profile to preview.
                </p>
              ))}
          </main>
        </div>
      </div>
    </ClientPreviewProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 text-[13px] text-foreground/70">
      {children}
    </div>
  );
}
