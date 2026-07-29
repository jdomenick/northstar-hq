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

function statusTone(status: OnboardingStatus) {
  if (status === "approved") return "ok" as const;
  if (status === "needs_revision" || status === "blocked") return "danger" as const;
  if (status === "submitted") return "warn" as const;
  return "neutral" as const;
}

function OnboardingPage() {
  return (
    <ClientWorkspace>
      {() => <OnboardingBody />}
    </ClientWorkspace>
  );
}

function OnboardingBody() {
  const { data, isLoading, isError } = useClientWorkspace();

  if (isLoading) return <LoadingRows />;
  if (isError || !data) {
    return <WorkspaceError message="We could not load your onboarding checklist. Refresh to try again." />;
  }

  const progress = onboardingProgress(data.onboarding);
  const clientItems = data.onboarding.filter((i) => i.owner === "client");
  const ourItems = data.onboarding.filter((i) => i.owner === "northstar");

  return (
    <div className="space-y-10">
      <PageHeading
        label="Onboarding"
        title={
          progress.outstanding === 0
            ? "Nothing is waiting on you"
            : `${progress.outstanding} item${progress.outstanding === 1 ? "" : "s"} need you`
        }
        lead={
          data.onboarding.length === 0
            ? "Your checklist has not been assigned yet. NorthStar Labs will add items here."
            : `${progress.done} of ${progress.total} items complete. Nothing is sent until you submit it.`
        }
      />

      {data.onboarding.length === 0 ? (
        <EmptyState
          title="No onboarding items yet"
          detail="When NorthStar Labs assigns onboarding steps, they appear here with clear instructions."
        />
      ) : (
        <section className="space-y-3">
          {clientItems.map((item) => (
            <ItemCard key={item.id} item={item} storagePrefix={data.storage_prefix} />
          ))}
        </section>
      )}

      {ourItems.length > 0 ? (
        <section>
          <h2 className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55">
            Handled by NorthStar Labs
          </h2>
          <ul className="mt-4 divide-y divide-foreground/10 border-y border-foreground/10">
            {ourItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                <span className="text-[13.5px] text-foreground/80">{item.title}</span>
                <Pill tone={statusTone(item.status)}>{ONBOARDING_STATUS_LABEL[item.status]}</Pill>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ItemCard({ item, storagePrefix }: { item: OnboardingItem; storagePrefix: string }) {
  const [response, setResponse] = useState(item.client_response);
  const [busy, setBusy] = useState(false);
  const submit = useServerFn(submitOnboardingItemFn);
  const queryClient = useQueryClient();

  const locked =
    item.status === "approved" || item.status === "not_applicable" || item.status === "blocked";
  const attached = item.documents.filter((d) => d.storage_path);

  async function send(status: "in_progress" | "submitted") {
    setBusy(true);
    try {
      await submit({ data: { itemId: item.id, status, response } });
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY });
      toast.success(status === "submitted" ? "Submitted for review." : "Saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We could not save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="border border-foreground/12 bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] text-foreground">
            {item.title}
            {item.is_required ? null : (
              <span className="ml-2 text-[11px] uppercase tracking-[0.16em] text-foreground/45">
                Optional
              </span>
            )}
          </h3>
          {item.instructions ? (
            <p className="mt-2 max-w-2xl text-[13px] leading-[1.7] text-foreground/70">
              {item.instructions}
            </p>
          ) : null}
        </div>
        <Pill tone={statusTone(item.status)}>{ONBOARDING_STATUS_LABEL[item.status]}</Pill>
      </div>

      {item.due_at ? (
        <div className="mt-3 text-[12px] text-foreground/55">Due {formatDate(item.due_at)}</div>
      ) : null}

      {item.status === "needs_revision" && item.revision_note ? (
        <p className="mt-4 border-l-2 border-destructive/60 pl-3 text-[13px] leading-[1.7] text-foreground/80">
          NorthStar Labs asked for a revision: {item.revision_note}
        </p>
      ) : null}
      {item.status === "blocked" && item.blocked_reason ? (
        <p className="mt-4 border-l-2 border-destructive/60 pl-3 text-[13px] leading-[1.7] text-foreground/80">
          Blocked: {item.blocked_reason}
        </p>
      ) : null}

      {locked ? (
        item.client_response ? (
          <p className="mt-4 whitespace-pre-wrap text-[13px] leading-[1.7] text-foreground/70">
            {item.client_response}
          </p>
        ) : null
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
              Your response
            </span>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={3}
              maxLength={4000}
              className="mt-2 w-full border border-foreground/20 bg-transparent p-3 text-[13.5px] text-foreground outline-none focus:border-foreground/50"
              placeholder="Add the details NorthStar Labs asked for."
            />
          </label>

          {item.requires_document ? (
            <div className="flex flex-wrap items-center gap-3">
              <UploadButton
                storagePrefix={storagePrefix}
                onboardingItemId={item.id}
                title={item.title}
                label={attached.length ? "Replace file" : "Attach file"}
              />
              {attached.length === 0 ? (
                <span className="text-[12px] text-foreground/55">A file is required for this item.</span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void send("submitted")}
              className="bg-foreground px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Working" : "Submit for review"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void send("in_progress")}
              className="text-[11px] uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground disabled:opacity-50"
            >
              Save without submitting
            </button>
          </div>
        </div>
      )}

      {attached.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-foreground/10 pt-3">
          {attached.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3">
              <DownloadLink documentId={doc.id}>{doc.file_name ?? doc.title}</DownloadLink>
              <span className="text-[11px] text-foreground/50">{formatDate(doc.uploaded_at)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}