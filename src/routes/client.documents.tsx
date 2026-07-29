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

function DocumentsBody() {
  const { data, isLoading, isError } = useClientWorkspace();
  if (isLoading) return <LoadingRows />;
  if (isError || !data) {
    return <WorkspaceError message="We could not load your documents. Refresh to try again." />;
  }

  const requested = data.documents.filter((d) => d.status === "requested" || d.status === "needs_revision");
  const yours = data.documents.filter(
    (d) => d.visibility === "client_uploaded" && d.status !== "requested" && d.status !== "needs_revision",
  );
  const shared = data.documents.filter(
    (d) => d.visibility === "client_visible" && d.storage_path && d.status !== "needs_revision",
  );

  return (
    <div className="space-y-10">
      <PageHeading
        label="Documents"
        title="Your files"
        lead="Upload what NorthStar Labs requested and download anything shared with you. Never send passwords through file uploads."
      />

      <Section title="Requested from you">
        {requested.length === 0 ? (
          <EmptyState title="Nothing requested" detail="NorthStar Labs has not requested any files right now." />
        ) : (
          <ul className="space-y-3">
            {requested.map((doc) => (
              <li key={doc.id} className="border border-foreground/12 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] text-foreground">{doc.title}</div>
                    {doc.instructions ? (
                      <p className="mt-2 max-w-2xl text-[13px] leading-[1.7] text-foreground/70">
                        {doc.instructions}
                      </p>
                    ) : null}
                    {doc.status === "needs_revision" && doc.revision_note ? (
                      <p className="mt-3 border-l-2 border-destructive/60 pl-3 text-[13px] leading-[1.7] text-foreground/80">
                        Revision requested: {doc.revision_note}
                      </p>
                    ) : null}
                  </div>
                  <Pill tone={doc.status === "needs_revision" ? "danger" : "neutral"}>
                    {DOCUMENT_STATUS_LABEL[doc.status]}
                  </Pill>
                </div>
                <div className="mt-4">
                  <UploadButton
                    storagePrefix={data.storage_prefix}
                    documentId={doc.id}
                    onboardingItemId={doc.onboarding_item_id}
                    title={doc.title}
                    label={doc.storage_path ? "Replace file" : "Upload file"}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Uploaded by you"
        action={
          <UploadButton
            storagePrefix={data.storage_prefix}
            title="Additional document"
            label="Upload a document"
          />
        }
      >
        {yours.length === 0 ? (
          <EmptyState title="No uploads yet" detail="Anything you upload appears here with its review status." />
        ) : (
          <FileList docs={yours} />
        )}
      </Section>

      <Section title="Shared with you">
        {shared.length === 0 ? (
          <EmptyState
            title="Nothing shared yet"
            detail="Agreements, summaries, and deliverables NorthStar Labs shares will appear here."
          />
        ) : (
          <FileList docs={shared} />
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function FileList({ docs }: { docs: ClientDocument[] }) {
  return (
    <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
      {docs.map((doc) => (
        <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="truncate text-[13.5px] text-foreground">{doc.title}</div>
            <div className="mt-1 text-[11.5px] text-foreground/55">
              {doc.file_name ?? "No file"} · {formatDate(doc.uploaded_at ?? doc.created_at)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Pill tone={doc.status === "approved" ? "ok" : "neutral"}>
              {DOCUMENT_STATUS_LABEL[doc.status]}
            </Pill>
            {doc.storage_path ? <DownloadLink documentId={doc.id}>Download</DownloadLink> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}