import { createFileRoute } from "@tanstack/react-router";
import { ClientWorkspace } from "@/components/client-shell";
import {
  DownloadLink,
  EmptyState,
  LoadingRows,
  PageHeading,
  Pill,
  UploadButton,
  WorkspaceError,
  formatDate,
  useClientWorkspace,
} from "@/components/client-workspace-ui";
import { DOCUMENT_STATUS_LABEL, type ClientDocument } from "@/lib/client-workspace/types";
import { DocumentsBody } from "@/components/client-pages/documents";

export const Route = createFileRoute("/client/documents")({
  ssr: false,
  component: DocumentsPage,
  head: () => ({
    meta: [
      { title: "Documents  -  NorthStar Labs" },
      { name: "description", content: "Files requested by NorthStar Labs and files shared with you." },
      { property: "og:title", content: "Documents  -  NorthStar Labs" },
      {
        property: "og:description",
        content: "Files requested by NorthStar Labs and files shared with you.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function DocumentsPage() {
  return <ClientWorkspace>{() => <DocumentsBody />}</ClientWorkspace>;
}
