import { createFileRoute } from "@tanstack/react-router";
import { ClientWorkspace } from "@/components/client-shell";
import {
  EmptyState,
  LoadingRows,
  PageHeading,
  Pill,
  WorkspaceError,
  formatDate,
  useClientWorkspace,
} from "@/components/client-workspace-ui";
import { formatMoney } from "@/lib/client-workspace/types";
import { BillingBody } from "@/components/client-pages/billing";

export const Route = createFileRoute("/client/billing")({
  ssr: false,
  component: BillingPage,
  head: () => ({
    meta: [
      { title: "Billing  -  NorthStar Labs" },
      { name: "description", content: "Your NorthStar Labs invoices, payments, and receipts." },
      { property: "og:title", content: "Billing  -  NorthStar Labs" },
      { property: "og:description", content: "Your NorthStar Labs invoices, payments, and receipts." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function BillingPage() {
  return <ClientWorkspace>{() => <BillingBody />}</ClientWorkspace>;
}
