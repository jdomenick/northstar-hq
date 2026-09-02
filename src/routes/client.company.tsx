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
} from "@/components/client-workspace-ui";
import { saveClientCompanyProfileFn } from "@/lib/client-workspace/workspace.functions";
import type { CompanyProfile } from "@/lib/client-workspace/types";
import { CompanyBody } from "@/components/client-pages/company";

export const Route = createFileRoute("/client/company")({
  ssr: false,
  component: CompanyPage,
  head: () => ({
    meta: [
      { title: "Company information  -  NorthStar Labs" },
      { name: "description", content: "The company details NorthStar Labs uses to run your engagement." },
      { property: "og:title", content: "Company information  -  NorthStar Labs" },
      {
        property: "og:description",
        content: "The company details NorthStar Labs uses to run your engagement.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CompanyPage() {
  return <ClientWorkspace>{() => <CompanyBody />}</ClientWorkspace>;
}
