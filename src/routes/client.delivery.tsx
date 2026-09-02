import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ClientWorkspace } from "@/components/client-shell";
import {
  EmptyState,
  LoadingRows,
  PageHeading,
  Pill,
  WorkspaceError,
  formatDate,
} from "@/components/client-workspace-ui";
import {
  decideDeliverableFn,
  getClientDeliveryFn,
  getDeliverableUrlFn,
} from "@/lib/delivery/delivery.functions";
import {
  DELIVERABLE_STATUS_LABEL,
  DELIVERY_HEALTH_LABEL,
  DELIVERY_STAGES,
  MILESTONE_STATUS_LABEL,
  type ClientDeliverable,
  type ClientDeliveryView,
  type ClientMilestone,
  type DeliveryHealth,
} from "@/lib/delivery/client-delivery";

export const DELIVERY_QUERY_KEY = ["client-delivery"] as const;
import { Delivery } from "@/components/client-pages/delivery";

export const Route = createFileRoute("/client/delivery")({
  ssr: false,
  component: DeliveryPage,
  head: () => ({
    meta: [
      { title: "Delivery status  -  NorthStar Labs" },
      {
        name: "description",
        content: "Track your NorthStar Labs implementation, milestones, and deliverables.",
      },
      { property: "og:title", content: "Delivery status  -  NorthStar Labs" },
      {
        property: "og:description",
        content: "Track your NorthStar Labs implementation, milestones, and deliverables.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function DeliveryPage() {
  return <ClientWorkspace>{() => <Delivery />}</ClientWorkspace>;
}
