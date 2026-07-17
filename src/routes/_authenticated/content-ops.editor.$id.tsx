import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page-header";
import { EditorShell } from "@/components/content-ops/editor-shell";
import { useOrg } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/content-ops/editor/$id")({
  component: ContentEditorRoute,
  head: () => ({
    meta: [
      { title: "Content editor - Northstar" },
      {
        name: "description",
        content:
          "Edit a content item and its platform variants with side-by-side previews, validation, and approvals.",
      },
    ],
  }),
});

function ContentEditorRoute() {
  const { id } = Route.useParams();
  const { activeOrgId } = useOrg();
  if (!activeOrgId) {
    return (
      <>
        <PageHeader eyebrow="Content Operations" title="Select an organization" />
        <PageBody>
          <div className="text-[13px] text-foreground/60">Pick an organization to continue.</div>
        </PageBody>
      </>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Content Operations"
        title="Editor"
        description="One content item, many platform variants. Approval required before publish."
      />
      <PageBody>
        <EditorShell organizationId={activeOrgId} parentContentItemId={id} />
      </PageBody>
    </>
  );
}
