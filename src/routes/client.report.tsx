import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClientWorkspace } from "@/components/client-shell";
import {
  EmptyState,
  LoadingRows,
  Pill,
  WorkspaceError,
  formatDate,
} from "@/components/client-workspace-ui";
import { formatMoney } from "@/lib/client-workspace/types";
import { getClientExecutiveReportFn } from "@/lib/reporting/reporting.functions";
import {
  REPORT_COPY,
  formatMetricPeriod,
  formatMetricValue,
  type ClientExecutiveReportView,
} from "@/lib/reporting/types";
import { getDeliverableUrlFn } from "@/lib/delivery/delivery.functions";
import { ReportBody } from "@/components/client-pages/report";

export const Route = createFileRoute("/client/report")({
  ssr: false,
  component: ClientReportPage,
  head: () => ({
    meta: [
      { title: "Executive report - NorthStar Labs" },
      {
        name: "description",
        content: "Measurable outcomes, engagement status, and deliverables from NorthStar Labs.",
      },
      { property: "og:title", content: "Executive report - NorthStar Labs" },
      {
        property: "og:description",
        content: "Measurable outcomes, engagement status, and deliverables from NorthStar Labs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ClientReportPage() {
  return <ClientWorkspace>{() => <ReportBody />}</ClientWorkspace>;
}
