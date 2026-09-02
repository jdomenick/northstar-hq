import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClientWorkspace } from "@/components/client-shell";
import {
  DownloadLink,
  EmptyState,
  LoadingRows,
  PageHeading,
  Pill,
  UploadButton,
  WORKSPACE_QUERY_KEY,
  WorkspaceError,
  formatDate,
  useClientWorkspace,
} from "@/components/client-workspace-ui";
import { submitOnboardingItemFn } from "@/lib/client-workspace/workspace.functions";
import {
  ONBOARDING_STATUS_LABEL,
  onboardingProgress,
  type OnboardingItem,
  type OnboardingStatus,
} from "@/lib/client-workspace/types";
import { OnboardingBody } from "@/components/client-pages/onboarding";

export const Route = createFileRoute("/client/onboarding")({
  ssr: false,
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "Onboarding  -  NorthStar Labs" },
      { name: "description", content: "Everything NorthStar Labs needs from you to start work." },
      { property: "og:title", content: "Onboarding  -  NorthStar Labs" },
      { property: "og:description", content: "Everything NorthStar Labs needs from you to start work." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function OnboardingPage() {
  return (
    <ClientWorkspace>
      {() => <OnboardingBody />}
    </ClientWorkspace>
  );
}
