import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useOrg } from "@/lib/org-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getOperatorClientWorkspaceFn,
  getOperatorDocumentUrlFn,
  postClientNoticeFn,
  registerOperatorUploadFn,
  requestClientDocumentFn,
  reviewClientDocumentFn,
  reviewOnboardingItemFn,
  seedClientChecklistFn,
  setClientDocumentVisibilityFn,
  upsertOnboardingItemFn,
} from "@/lib/client-workspace/workspace.functions";
import {
  DOCUMENT_STATUS_LABEL,
  ONBOARDING_STATUS_LABEL,
  type ClientDocument,
  type OnboardingItem,
} from "@/lib/client-workspace/types";
import { OperatorDeliveryAdmin } from "@/components/operator-delivery-admin";
import { OperatorExecutiveReport } from "@/components/operator-executive-report";

export const Route = createFileRoute("/_authenticated/labs/clients/$clientId/workspace")({
  component: OperatorWorkspacePage,
});

function OperatorWorkspacePage() {
  const { clientId } = Route.useParams();
  const { activeOrgId } = useOrg();
  const load = useServerFn(getOperatorClientWorkspaceFn);
  const queryClient = useQueryClient();
  const queryKey = ["operator-client-workspace", activeOrgId, clientId];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    enabled: Boolean(activeOrgId),
    queryFn: () => load({ data: { organizationId: activeOrgId as string, clientId } }),
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  if (!activeOrgId) return <div className="p-6 text-[13px] text-foreground/60">Select an organization.</div>;
  if (isLoading) return <div className="p-6 text-[13px] text-foreground/60">Loading client workspace…</div>;
  if (isError || !data) {
    return (
      <div className="p-6 text-[13px] text-destructive">
        We could not load this client workspace. Confirm the client exists in this organization.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 p-6">
      <header>
        <Link to="/labs/revenue" className="text-[11px] uppercase tracking-[0.18em] text-foreground/55 hover:text-foreground">
          Back to revenue
        </Link>
        <h1 className="mt-3 font-display text-[30px] leading-tight">{data.client.name}</h1>
        <p className="mt-2 text-[13px] text-foreground/65">
          Client workspace administration. {data.accounts} active client login
          {data.accounts === 1 ? "" : "s"}. Status: {data.client.status}.
        </p>
      </header>

      <OnboardingAdmin
        orgId={activeOrgId}
        clientId={clientId}
        items={data.onboarding}
        onChanged={refresh}
      />

      <DocumentAdmin
        orgId={activeOrgId}
        clientId={clientId}
        documents={data.documents}
        onChanged={refresh}
      />

      <NoticeAdmin orgId={activeOrgId} clientId={clientId} onChanged={refresh} />

      <OperatorDeliveryAdmin orgId={activeOrgId} clientId={clientId} />

      <OperatorExecutiveReport orgId={activeOrgId} clientId={clientId} />

      <section>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-foreground/55">Client-visible activity</h2>
        {data.events.length === 0 ? (
          <p className="mt-3 text-[13px] italic text-foreground/55">No client-visible activity yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {data.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-[13px]">{e.title}</span>
                <span className="text-[11px] text-foreground/50">
                  {new Date(e.occurred_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OnboardingAdmin({
  orgId,
  clientId,
  items,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  items: OnboardingItem[];
  onChanged: () => void;
}) {
  const seed = useServerFn(seedClientChecklistFn);
  const upsert = useServerFn(upsertOnboardingItemFn);
  const review = useServerFn(reviewOnboardingItemFn);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [requiresDoc, setRequiresDoc] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-foreground/55">Onboarding checklist</h2>
        {items.length === 0 ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(() => seed({ data: { organizationId: orgId, clientId } }), "Checklist assigned")
            }
          >
            Assign standard checklist
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-[13px] italic text-foreground/55">
          No items assigned. The client sees an empty onboarding page until you assign work.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {items.map((item) => (
            <li key={item.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px]">{item.title}</div>
                  <div className="mt-1 text-[11.5px] text-foreground/55">
                    {item.owner === "client" ? "Client owns" : "NorthStar owns"}
                    {item.requires_document ? " · file required" : ""}
                    {item.submitted_at
                      ? ` · submitted ${new Date(item.submitted_at).toLocaleDateString()}`
                      : ""}
                  </div>
                  {item.client_response ? (
                    <p className="mt-2 whitespace-pre-wrap text-[12.5px] text-foreground/75">
                      {item.client_response}
                    </p>
                  ) : null}
                </div>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {ONBOARDING_STATUS_LABEL[item.status]}
                </Badge>
              </div>
              {item.status === "submitted" ? (
                <ReviewRow
                  busy={busy}
                  onApprove={() =>
                    void run(
                      () =>
                        review({
                          data: { organizationId: orgId, itemId: item.id, decision: "approved", note: "" },
                        }),
                      "Item approved",
                    )
                  }
                  onRevise={(note) =>
                    void run(
                      () =>
                        review({
                          data: {
                            organizationId: orgId,
                            itemId: item.id,
                            decision: "needs_revision",
                            note,
                          },
                        }),
                      "Revision requested",
                    )
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border border-border/60 p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/55">Add an item</div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item title" />
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Instructions the client will read"
          rows={2}
        />
        <label className="flex items-center gap-2 text-[12px] text-foreground/70">
          <input
            type="checkbox"
            checked={requiresDoc}
            onChange={(e) => setRequiresDoc(e.target.checked)}
          />
          Requires a file upload
        </label>
        <Button
          size="sm"
          disabled={busy || title.trim().length === 0}
          onClick={() =>
            void run(async () => {
              await upsert({
                data: {
                  organizationId: orgId,
                  clientId,
                  title: title.trim(),
                  item_type: requiresDoc ? "required_document" : "other",
                  owner: "client",
                  instructions: instructions.trim(),
                  is_required: true,
                  requires_review: true,
                  requires_document: requiresDoc,
                  due_at: null,
                },
              });
              setTitle("");
              setInstructions("");
              setRequiresDoc(false);
            }, "Item added")
          }
        >
          Add item
        </Button>
      </div>
    </section>
  );
}

function ReviewRow({
  busy,
  onApprove,
  onRevise,
}: {
  busy: boolean;
  onApprove: () => void;
  onRevise: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={busy} onClick={onApprove}>
        Approve
      </Button>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Revision note"
        className="h-8 max-w-xs text-[12px]"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy || note.trim().length === 0}
        onClick={() => onRevise(note.trim())}
      >
        Request revision
      </Button>
    </div>
  );
}

function DocumentAdmin({
  orgId,
  clientId,
  documents,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  documents: ClientDocument[];
  onChanged: () => void;
}) {
  const request = useServerFn(requestClientDocumentFn);
  const review = useServerFn(reviewClientDocumentFn);
  const setVisibility = useServerFn(setClientDocumentVisibilityFn);
  const registerUpload = useServerFn(registerOperatorUploadFn);
  const getUrl = useServerFn(getOperatorDocumentUrlFn);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function shareFile(file: File) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
    const path = `${orgId}/${clientId}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from("client-documents").upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (upload.error) {
      toast.error("Upload failed.");
      return;
    }
    await run(
      () =>
        registerUpload({
          data: {
            organizationId: orgId,
            clientId,
            title: file.name.slice(0, 200),
            storagePath: path,
            fileName: file.name.slice(0, 255),
            fileSize: file.size,
            fileType: file.type || "application/octet-stream",
            visibility: "client_visible",
          },
        }),
      "File shared with client",
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-foreground/55">Documents</h2>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void shareFile(file);
            }}
          />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            Share a file
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <p className="text-[13px] italic text-foreground/55">No documents on this engagement yet.</p>
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[13.5px]">{doc.title}</div>
                <div className="mt-1 text-[11.5px] text-foreground/55">
                  {doc.file_name ?? "No file"} · {doc.visibility.replaceAll("_", " ")}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {DOCUMENT_STATUS_LABEL[doc.status]}
                </Badge>
                {doc.storage_path ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        const { url } = await getUrl({
                          data: { organizationId: orgId, documentId: doc.id },
                        });
                        window.open(url, "_blank", "noopener,noreferrer");
                      } catch {
                        toast.error("File unavailable.");
                      }
                    }}
                  >
                    Open
                  </Button>
                ) : null}
                {doc.status === "uploaded" ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          review({
                            data: {
                              organizationId: orgId,
                              documentId: doc.id,
                              decision: "approved",
                              note: "",
                            },
                          }),
                        "Document approved",
                      )
                    }
                  >
                    Approve
                  </Button>
                ) : null}
                {doc.visibility !== "client_uploaded" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          setVisibility({
                            data: {
                              organizationId: orgId,
                              documentId: doc.id,
                              visibility:
                                doc.visibility === "internal_only" ? "client_visible" : "internal_only",
                            },
                          }),
                        "Visibility updated",
                      )
                    }
                  >
                    {doc.visibility === "internal_only" ? "Share with client" : "Make internal"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border border-border/60 p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/55">Request a document</div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="What the client should send"
          rows={2}
        />
        <Button
          size="sm"
          disabled={busy || title.trim().length === 0}
          onClick={() =>
            void run(async () => {
              await request({
                data: {
                  organizationId: orgId,
                  clientId,
                  title: title.trim(),
                  instructions: instructions.trim(),
                  isRequired: true,
                  onboardingItemId: null,
                },
              });
              setTitle("");
              setInstructions("");
            }, "Document requested")
          }
        >
          Request document
        </Button>
      </div>
    </section>
  );
}

function NoticeAdmin({
  orgId,
  clientId,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  onChanged: () => void;
}) {
  const post = useServerFn(postClientNoticeFn);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <section className="space-y-2 border border-border/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/55">Post a client notice</div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice headline" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details" rows={2} />
      <Button
        size="sm"
        disabled={busy || title.trim().length === 0}
        onClick={async () => {
          setBusy(true);
          try {
            await post({
              data: { organizationId: orgId, clientId, title: title.trim(), body: body.trim() },
            });
            setTitle("");
            setBody("");
            onChanged();
            toast.success("Notice posted");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Action failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Post notice
      </Button>
    </section>
  );
}