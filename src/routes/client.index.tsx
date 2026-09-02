import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClientWorkspace } from "@/components/client-shell";
import { roleLabel } from "@/lib/client-identity/types";
import {
  EmptyState,
  LoadingRows,
  Pill,
  WorkspaceError,
  formatDate,
  useClientWorkspace,
} from "@/components/client-workspace-ui";
import { formatMoney, onboardingProgress } from "@/lib/client-workspace/types";
import { getClientDeliveryFn } from "@/lib/delivery/delivery.functions";
import type { ClientDeliveryView } from "@/lib/delivery/client-delivery";
import { Overview } from "@/components/client-pages/overview";

export const Route = createFileRoute("/client/")({
  ssr: false,
  component: ClientHome,
  head: () => ({
    meta: [
      { title: "Your workspace  -  NorthStar Labs" },
      { name: "description", content: "Your NorthStar Labs engagement status and next step." },
      { property: "og:title", content: "Your workspace  -  NorthStar Labs" },
      { property: "og:description", content: "Your NorthStar Labs engagement status and next step." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ClientHome() {
  return (
    <ClientWorkspace>
      {(ctx) => (
        <Overview
          companyName={ctx.company.name}
          role={roleLabel(ctx.account.role)}
          email={ctx.account.email}
        />
      )}
    </ClientWorkspace>
  );
}
