import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  X,
  MoreHorizontal,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  askSam,
  listConversations,
  loadConversation,
  renameConversation,
  archiveConversation,
} from "@/lib/sam/sam.functions";
import { submitResponseFeedback } from "@/lib/sam/learning/learning.functions";
import { useOrg } from "@/lib/org-context";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/constants";
import { toast } from "sonner";
import { SectionLabel } from "@/components/editorial";

type ActionReceipt = {
  status: "success" | "blocked" | "failed" | "ambiguous" | "none";
  kind: string;
  explanation: string;
  ids: Record<string, string>;
  hrefs: Record<string, string>;
  blockers: string[];
  detection: { confidence: number; reason: string };
};

function ActionReceiptCard({ receipt }: { receipt: ActionReceipt }) {
  if (receipt.status === "none") return null;
  const tone =
    receipt.status === "success"
      ? "border-[oklch(0.72_0.14_155)] bg-[oklch(0.72_0.14_155)]/10"
      : receipt.status === "ambiguous"
        ? "border-[oklch(0.78_0.14_85)] bg-[oklch(0.78_0.14_85)]/10"
        : "border-[oklch(0.55_0.18_27)] bg-[oklch(0.55_0.18_27)]/10";
  const missionId = receipt.ids.missionId;
  return (
    <div className={cn("mt-6 rounded-md border-l-2 px-4 py-3", tone)}>
      <div className="text-[10.5px] uppercase tracking-[0.22em] text-foreground/70">
        SAM action - {receipt.kind.replace(/_/g, " ")} - {receipt.status}
      </div>
      <div className="mt-1.5 text-[13.5px] text-foreground">{receipt.explanation}</div>
      {receipt.blockers.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12px] text-foreground/70">
          {receipt.blockers.map((b, i) => <li key={i}>- {b}</li>)}
        </ul>
      )}
      {missionId && (
        <Link
          to="/sam/missions/$id"
          params={{ id: missionId }}
          className="mt-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
        >
          Open mission <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/sam/")({
  component: SamPage,
  head: () => ({
    meta: [
      { title: "SAM - NorthStar Labs" },
      {
        name: "description",
        content: "SAM. NorthStar Labs' executive intelligence system.",
      },
    ],
  }),
});

type ConvSummary = {
  id: string;
  title: string;
  updated_at: string;
  venture_id: string | null;
};

type SamMessageMetadata = {
  intent?: string;
  confidence?: {
    band: string;
    score: number;
    reasons: string[];
    signals: Record<string, number>;
  };
  citations?: Array<{
    kind: string;
    entity_type: string;
    entity_id: string;
    title: string | null;
    relevance: string | null;
  }>;
  hrefs?: Record<string, string | null>;
  action_receipt?: ActionReceipt;
  response?: {
    executive_summary: string | null;
    observations: string[];
    risks: string[];
    opportunities: string[];
    recommendations: string[];
    missing_information: string[];
    assumptions: string[];
    next_question: string | null;
    unsupported_action: {
      requested_action: string;
      reason: string;
      suggested_manual_path: string | null;
    } | null;
  };
};

type Msg = {
  id: string;
  role: string;
  content: string;
  status: string;
  metadata: SamMessageMetadata | null;
  created_at: string;
};

function SamPage() {
  const { activeOrgId, activeMembership, memberships } = useOrg();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [images, setImages] = useState<
    Array<{ id: string; prompt: string; dataUrl: string; createdAt: string }>
  >([]);
  const [imagePending, setImagePending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const askFn = useServerFn(askSam);
  const listFn = useServerFn(listConversations);
  const loadFn = useServerFn(loadConversation);
  const renameFn = useServerFn(renameConversation);
  const archiveFn = useServerFn(archiveConversation);

  const conversationsQ = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["sam.conversations", activeOrgId],
    queryFn: async () =>
      (await listFn({ data: { organizationId: activeOrgId! } })) as ConvSummary[],
  });

  const activeQ = useQuery({
    enabled: !!activeOrgId && !!activeId,
    queryKey: ["sam.conversation", activeId],
    queryFn: async () =>
      loadFn({
        data: { organizationId: activeOrgId!, conversationId: activeId! },
      }),
  });

  const messages: Msg[] = useMemo(
    () => (activeQ.data?.messages ?? []) as Msg[],
    [activeQ.data],
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, pending, images.length, imagePending]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeId]);

  async function handleSubmit(text: string) {
    if (!activeOrgId || !text.trim() || pending) return;
    setPending(true);
    setInput("");
    try {
      const res = await askFn({
        data: {
          conversationId: activeId,
          organizationId: activeOrgId,
          message: text,
        },
      });
      if (!res.ok) {
        toast.error(res.error.message);
      } else if (!activeId) {
        setActiveId(res.conversationId);
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["sam.conversations", activeOrgId] }),
        qc.invalidateQueries({
          queryKey: ["sam.conversation", res.conversationId ?? activeId],
        }),
      ]);
      if (!activeId && res.conversationId) setActiveId(res.conversationId);
    } catch (e) {
      toast.error((e as Error).message || "SAM failed to respond.");
    } finally {
      setPending(false);
      textareaRef.current?.focus();
    }
  }

  async function handleGenerateImage(text: string) {
    const prompt = text.trim();
    if (!prompt || imagePending) return;
    setImagePending(true);
    setInput("");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        toast.error(err || "Image generation failed.");
        return;
      }
      const j = (await res.json()) as { image: string };
      setImages((prev) => [
        ...prev,
        {
          id: `img-${Date.now()}`,
          prompt,
          dataUrl: j.image,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      toast.error((e as Error).message || "Image generation failed.");
    } finally {
      setImagePending(false);
      textareaRef.current?.focus();
    }
  }

  const activeOrgName =
    activeMembership?.organizations?.name ??
    memberships.find((m) => m.organization_id === activeOrgId)?.organizations?.name ??
    null;
  const contextLine = activeOrgName ?? "";

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] paper-grain">
      {/* Editorial ledger of prior memoranda */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-foreground/10 lg:flex">
        <ConversationList
          conversations={(conversationsQ.data ?? []) as ConvSummary[]}
          activeId={activeId}
          onSelect={(id) => setActiveId(id)}
          onNew={() => {
            setActiveId(null);
            setInput("");
          }}
          onRename={async (id, title) => {
            await renameFn({
              data: { conversationId: id, organizationId: activeOrgId!, title },
            });
            qc.invalidateQueries({ queryKey: ["sam.conversations", activeOrgId] });
          }}
          onArchive={async (id) => {
            await archiveFn({
              data: { conversationId: id, organizationId: activeOrgId! },
            });
            if (id === activeId) setActiveId(null);
            qc.invalidateQueries({ queryKey: ["sam.conversations", activeOrgId] });
          }}
        />
      </aside>

      {/* Main memorandum */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Editorial masthead */}
        <header className="border-b border-foreground/15 px-6 pt-8 md:px-12 md:pt-10">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/70">
                SAM - Executive Intelligence
              </div>
              <button
                className="lg:hidden text-[10.5px] uppercase tracking-[0.24em] text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => setSidebarOpen(true)}
              >
                History
              </button>
            </div>
            <div className="mt-4 border-t border-foreground/80 pt-4">
              <h1 className="font-display text-[30px] leading-[1.05] tracking-tight text-foreground md:text-[42px]">
                {activeQ.data?.conversation?.title ?? "New memorandum"}
              </h1>
              {contextLine && (
                <div className="mt-3 text-[11.5px] uppercase tracking-[0.22em] text-foreground/60">
                  {contextLine}
                </div>
              )}
            </div>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 pb-10 pt-10 md:px-12"
        >
          <div className="mx-auto max-w-3xl">
            {messages.length === 0 && !pending && (
              <EmptyState onPick={(s) => setInput(s)} />
            )}
            {messages.length > 0 && (
              <div>
                {messages.map((m, i) => (
                  <MessageView key={m.id} msg={m} index={i} />
                ))}
              </div>
            )}
            {images.length > 0 && (
              <div className="mt-8 space-y-8">
                {images.map((img) => (
                  <figure
                    key={img.id}
                    className="border-t border-foreground/80 pt-6"
                  >
                    <div className="flex items-baseline justify-between gap-4 pb-3">
                      <SectionLabel>SAM - Generated image</SectionLabel>
                    </div>
                    <img
                      src={img.dataUrl}
                      alt={img.prompt}
                      className="w-full border border-foreground/10"
                    />
                    <figcaption className="mt-3 text-[13px] italic leading-[1.7] text-foreground/70">
                      {img.prompt}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {pending && (
              <div className="mt-10 border-t border-foreground/15 pt-6">
                <SectionLabel>SAM is reading the record</SectionLabel>
                <div className="mt-3 flex items-center gap-2 text-[13px] italic text-foreground/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  Assembling evidence and drafting the response.
                </div>
              </div>
            )}
            {imagePending && (
              <div className="mt-10 border-t border-foreground/15 pt-6">
                <SectionLabel>SAM is composing the image</SectionLabel>
                <div className="mt-3 flex items-center gap-2 text-[13px] italic text-foreground/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  Rendering visual output.
                </div>
              </div>
            )}
          </div>
        </div>

        <Composer
          value={input}
          setValue={setInput}
          onSubmit={handleSubmit}
          onGenerateImage={handleGenerateImage}
          disabled={pending || imagePending || !activeOrgId}
          textareaRef={textareaRef}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-[300px] border-l border-foreground/15 bg-background">
            <div className="flex items-center justify-between border-b border-foreground/15 px-4 py-3">
              <SectionLabel>Memoranda</SectionLabel>
              <button
                aria-label="Close history"
                onClick={() => setSidebarOpen(false)}
                className="text-foreground/60 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ConversationList
              conversations={(conversationsQ.data ?? []) as ConvSummary[]}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setSidebarOpen(false);
              }}
              onNew={() => {
                setActiveId(null);
                setSidebarOpen(false);
              }}
              onRename={async (id, title) => {
                await renameFn({
                  data: {
                    conversationId: id,
                    organizationId: activeOrgId!,
                    title,
                  },
                });
                qc.invalidateQueries({
                  queryKey: ["sam.conversations", activeOrgId],
                });
              }}
              onArchive={async (id) => {
                await archiveFn({
                  data: { conversationId: id, organizationId: activeOrgId! },
                });
                if (id === activeId) setActiveId(null);
                qc.invalidateQueries({
                  queryKey: ["sam.conversations", activeOrgId],
                });
              }}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onArchive,
}: {
  conversations: ConvSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => Promise<void> | void;
  onArchive: (id: string) => Promise<void> | void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-4">
        <SectionLabel>Memoranda</SectionLabel>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.24em] text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
          aria-label="New memorandum"
        >
          <Plus className="h-3 w-3" strokeWidth={1.5} /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="px-4 py-6 text-[12.5px] italic text-foreground/55">
            No memoranda yet. Start one below.
          </div>
        )}
        <ul className="divide-y divide-foreground/10">
          {conversations.map((c) => (
            <li
              key={c.id}
              className={cn(
                "group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-4 py-3 text-[13px]",
                c.id === activeId
                  ? "bg-foreground/[0.04] text-foreground"
                  : "text-foreground/75 hover:bg-foreground/[0.02] hover:text-foreground",
              )}
            >
              <button
                className="min-w-0 truncate text-left"
                onClick={() => onSelect(c.id)}
              >
                {c.title || "Untitled"}
              </button>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <button
                  aria-label="Rename"
                  className="p-1 text-foreground/50 hover:text-foreground"
                  onClick={async () => {
                    const t = window.prompt("Rename memorandum", c.title);
                    if (t && t.trim()) await onRename(c.id, t.trim());
                  }}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <button
                  aria-label="Archive"
                  className="p-1 text-foreground/50 hover:text-foreground"
                  onClick={async () => {
                    if (window.confirm("Archive this memorandum?")) {
                      await onArchive(c.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const openings = [
    "What deserves my attention today?",
    "Which projects are currently at risk?",
    "Which commitments are overdue?",
    "What decisions are waiting on me?",
    "Summarize activity across my ventures.",
  ];
  return (
    <div className="pt-6">
      <SectionLabel>Opening the ledger</SectionLabel>
      <h2 className="mt-4 font-display text-[36px] leading-[1.05] text-foreground md:text-[48px]">
        What do you want to understand?
      </h2>
      <p className="mt-5 max-w-xl text-[14.5px] leading-[1.75] text-foreground/70">
        SAM reads your organization&apos;s live record. It executes work within
        the authority you grant it, requests approval when required, and reports
        blockers truthfully. Every answer cites the projects, decisions, and
        commitments it relies on.
      </p>
      <div className="mt-10 border-t border-foreground/80">
        <div className="border-b border-foreground/10 py-3">
          <SectionLabel>Suggested openings</SectionLabel>
        </div>
        <ul className="divide-y divide-foreground/10">
          {openings.map((s) => (
            <li key={s}>
              <button
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 text-left"
                onClick={() => onPick(s)}
              >
                <span className="text-[15px] italic leading-snug text-foreground/85 group-hover:text-foreground">
                  {s}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MessageView({ msg, index }: { msg: Msg; index: number }) {
  const isUser = msg.role === "user";
  const { activeOrgId } = useOrg();
  const feedbackFn = useServerFn(submitResponseFeedback);

  if (isUser) {
    return (
      <section className={cn("py-6", index > 0 && "border-t border-foreground/10")}>
        <SectionLabel>Directive</SectionLabel>
        <p className="mt-2 text-[14.5px] leading-[1.75] text-foreground/85">
          {msg.content}
        </p>
        {msg.status === "failed" && (
          <div className="mt-2 text-[11.5px] uppercase tracking-[0.2em] text-[oklch(0.5_0.18_27)]">
            Response failed - try again.
          </div>
        )}
      </section>
    );
  }

  const meta = msg.metadata ?? {};
  const resp = meta.response;

  return (
    <section className={cn("py-8", index > 0 && "border-t border-foreground/80")}>
      <div className="flex items-baseline justify-between gap-4 pb-2">
        <SectionLabel>SAM - Response</SectionLabel>
        {meta.confidence && (
          <span className="text-[10.5px] uppercase tracking-[0.22em] text-foreground/55">
            Confidence - {meta.confidence.band.replace("_", " ")}
          </span>
        )}
      </div>

      {resp?.executive_summary && (
        <p className="mt-4 font-display text-[22px] leading-[1.3] text-foreground md:text-[26px]">
          {sanitizeText(resp.executive_summary)}
        </p>
      )}

      <div className="mt-5 whitespace-pre-wrap text-[14.5px] leading-[1.8] text-foreground/85">
        <CleanProse text={msg.content} />
      </div>

      {resp?.unsupported_action && (
        <div className="mt-6 border-l-2 border-[oklch(0.62_0.14_65)] bg-foreground/[0.02] px-4 py-3">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-foreground/75">
            Unsupported action
          </div>
          <div className="mt-1.5 text-[13.5px] text-foreground/75">
            {resp.unsupported_action.reason}
          </div>
          {resp.unsupported_action.suggested_manual_path && (
            <div className="mt-2 text-[13.5px] text-foreground">
              {resp.unsupported_action.suggested_manual_path}
            </div>
          )}
        </div>
      )}

      <ResponseSection title="Observations" items={resp?.observations} />
      <ResponseSection title="Risks" items={resp?.risks} />
      <ResponseSection title="Opportunities" items={resp?.opportunities} />
      <ResponseSection title="Recommendations" items={resp?.recommendations} />
      <ResponseSection title="Missing information" items={resp?.missing_information} />
      <ResponseSection title="Assumptions" items={resp?.assumptions} />

      {resp?.next_question && (
        <div className="mt-6 border-l border-foreground pl-4 md:pl-5">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-foreground/55">
            SAM asks
          </div>
          <p className="mt-1.5 font-display text-[18px] italic leading-[1.35] text-foreground md:text-[20px]">
            {resp.next_question}
          </p>
        </div>
      )}

      {(meta.citations?.length ?? 0) > 0 && (
        <SourcesDrawer citations={meta.citations!} hrefs={meta.hrefs ?? {}} />
      )}

      {meta.action_receipt && (
        <ActionReceiptCard receipt={meta.action_receipt as ActionReceipt} />
      )}

      {meta.confidence?.reasons && meta.confidence.reasons.length > 0 && (
        <ConfidenceDrawer confidence={meta.confidence} />
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-foreground/10 pt-4">
        <button
          className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.22em] text-foreground/60 hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(msg.content);
            toast.success("Copied");
          }}
        >
          <Copy className="h-3 w-3" strokeWidth={1.5} /> Copy
        </button>
        {([
          ["helpful", "Helpful"],
          ["not_helpful", "Not helpful"],
          ["partially_helpful", "Partial"],
          ["incorrect", "Incorrect"],
          ["missing_context", "Missing context"],
        ] as const).map(([kind, label]) => (
          <button
            key={kind}
            className="text-[10.5px] uppercase tracking-[0.22em] text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
            onClick={async () => {
              if (!activeOrgId) return;
              try {
                await feedbackFn({ data: { organizationId: activeOrgId, messageId: msg.id, feedback_type: kind } });
                toast.success("Feedback recorded");
              } catch (e) {
                toast.error((e as Error).message || "Feedback failed");
              }
            }}
          >{label}</button>
        ))}
      </div>
    </section>
  );
}

function ResponseSection({
  title,
  items,
}: {
  title: string;
  items: string[] | undefined;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-6">
      <SectionLabel>{title}</SectionLabel>
      <ul className="mt-3 space-y-2 text-[14px] leading-[1.7] text-foreground/85">
        {items.map((s, i) => (
          <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
            <span><CleanProse text={s} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Strip wrapping quotes, unescape JSON escapes, drop stray bullet marks and
// bracketed noise. Executive answers should read like prose, not JSON.
function sanitizeText(input: string): string {
  if (!input) return "";
  let t = String(input).trim();
  // Unescape common JSON escapes
  t = t
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
  // Strip fully wrapping matched quotes / backticks, repeatedly
  for (let i = 0; i < 3; i++) {
    if (
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'")) ||
      (t.startsWith("`") && t.endsWith("`")) ||
      (t.startsWith("\u201C") && t.endsWith("\u201D"))
    ) {
      t = t.slice(1, -1).trim();
    } else break;
  }
  // Strip leading list markers left over from JSON stringification
  t = t.replace(/^[-*\u2022]\s+/, "");
  // Strip trailing dangling commas
  t = t.replace(/[\s,]+$/g, "");
  return t;
}

// Some model outputs land as raw JSON in the answer field (fallback path,
// or when the model over-structures). Render them as clean prose instead of
// showing curly braces and quoted keys in the UI.
function CleanProse({ text }: { text: string }) {
  const raw = (text ?? "").trim();
  const parsed = tryParseJson(raw);
  if (parsed === undefined) return <>{sanitizeText(text)}</>;
  try {
    const blocks = flattenJson(parsed);
    if (blocks.length === 0) return <>{sanitizeText(text)}</>;
    return (
      <div className="space-y-4">
        {blocks.map((b, i) =>
          b.kind === "paragraph" ? (
            <p key={i}>
              {b.label ? (
                <span className="mr-2 text-[10.5px] uppercase tracking-[0.22em] text-foreground/55">
                  {b.label}
                </span>
              ) : null}
              {sanitizeText(b.value)}
            </p>
          ) : (
            <div key={i}>
              {b.label ? (
                <div className="mb-2 text-[10.5px] uppercase tracking-[0.22em] text-foreground/55">
                  {b.label}
                </div>
              ) : null}
              <ul className="space-y-2">
                {b.items.map((item, j) => (
                  <li key={j} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
                    <span>{sanitizeText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
    );
  } catch {
    return <>{sanitizeText(text)}</>;
  }
}

function tryParseJson(text: string): unknown | undefined {
  if (!text) return undefined;
  const candidates: string[] = [];
  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    candidates.push(text);
  }
  // Fenced code block ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());
  // First balanced-looking object/array substring
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* try next */ }
  }
  return undefined;
}

type ProseBlock =
  | { kind: "paragraph"; label: string | null; value: string }
  | { kind: "list"; label: string | null; items: string[] };

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function flattenJson(input: unknown): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  if (Array.isArray(input)) {
    const items = input.map(stringifyValue).filter(Boolean);
    if (items.length) blocks.push({ kind: "list", label: null, items });
    return blocks;
  }
  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const label = humanizeKey(key);
      if (Array.isArray(value)) {
        const items = value.map(stringifyValue).filter(Boolean);
        if (items.length) blocks.push({ kind: "list", label, items });
      } else if (value && typeof value === "object") {
        const nested = flattenJson(value);
        if (nested.length) {
          blocks.push({ kind: "paragraph", label, value: "" });
          blocks.push(...nested);
        }
      } else {
        const s = stringifyValue(value);
        if (s) blocks.push({ kind: "paragraph", label, value: s });
      }
    }
    return blocks;
  }
  const s = stringifyValue(input);
  if (s) blocks.push({ kind: "paragraph", label: null, value: s });
  return blocks;
}

function SourcesDrawer({
  citations,
  hrefs,
}: {
  citations: NonNullable<SamMessageMetadata["citations"]>;
  hrefs: Record<string, string | null>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 border-t border-foreground/10">
      <button
        className="flex w-full items-center justify-between py-3 text-[10.5px] uppercase tracking-[0.22em] text-foreground/70 hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Sources - {citations.length}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} /> : <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />}
      </button>
      {open && (
        <ul className="divide-y divide-foreground/10 border-t border-foreground/10">
          {citations.map((c, i) => {
            const href = hrefs[`${c.entity_type}:${c.entity_id}`];
            const label = `${c.entity_type.replace("_", " ")} - ${c.kind}`;
            return (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 py-3 text-[13px]">
                {href ? (
                  <Link to={href as never} className="truncate text-foreground hover:underline">
                    {c.title ?? c.entity_id}
                  </Link>
                ) : (
                  <span className="truncate text-foreground/70">
                    {c.title ?? c.entity_id}
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-[0.22em] text-foreground/55">
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ConfidenceDrawer({
  confidence,
}: {
  confidence: NonNullable<SamMessageMetadata["confidence"]>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 border-t border-foreground/10">
      <button
        className="flex w-full items-center justify-between py-3 text-[10.5px] uppercase tracking-[0.22em] text-foreground/70 hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          Confidence - {confidence.band.replace("_", " ")}{" "}
          <span className="text-foreground/55">
            ({Math.round(confidence.score * 100)}%)
          </span>
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} /> : <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />}
      </button>
      {open && (
        <div className="border-t border-foreground/10 py-3 text-[12.5px] text-foreground/70">
          <ul className="mb-3 list-disc space-y-1 pl-4">
            {confidence.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11.5px] text-foreground/70">
            {Object.entries(confidence.signals).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-foreground/10 py-1">
                <dt className="uppercase tracking-[0.16em] text-foreground/55">{k}</dt>
                <dd className="tabular-nums">{Math.round(Number(v) * 100)}%</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function Composer({
  value,
  setValue,
  onSubmit,
  onGenerateImage,
  disabled,
  textareaRef,
}: {
  value: string;
  setValue: (v: string) => void;
  onSubmit: (v: string) => void;
  onGenerateImage: (v: string) => void;
  disabled: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const overLimit = value.length > LIMITS.sam.maxMessageChars;
  return (
    <div className="sticky bottom-0 border-t border-foreground/15 bg-background px-6 pb-5 pt-4 md:px-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-3 border-b border-foreground/80 pb-3 focus-within:border-foreground">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(value);
              }
            }}
            rows={1}
            placeholder="Ask SAM, issue a directive, or examine the operation."
            aria-label="Ask SAM"
            className="min-h-[36px] flex-1 resize-none bg-transparent py-2 font-display text-[19px] leading-[1.35] text-foreground placeholder:font-display placeholder:text-[19px] placeholder:italic placeholder:text-foreground/40 focus:outline-none md:text-[22px] md:placeholder:text-[22px]"
            disabled={disabled}
            maxLength={LIMITS.sam.maxMessageChars + 200}
          />
          <button
            type="button"
            onClick={() => onGenerateImage(value)}
            disabled={disabled || !value.trim() || overLimit}
            aria-label="Generate image"
            title="Generate image from prompt"
            className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center border border-foreground/40 text-foreground/80 transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:border-foreground/20 disabled:text-foreground/25"
          >
            <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => onSubmit(value)}
            disabled={disabled || !value.trim() || overLimit}
            aria-label="Send message"
            className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center border border-foreground text-foreground transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:border-foreground/25 disabled:text-foreground/25 disabled:hover:bg-transparent"
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10.5px] uppercase tracking-[0.22em] text-foreground/50">
          <span>Return sends - Image button renders visual output</span>
          {overLimit && (
            <span className="text-[oklch(0.5_0.18_27)]">
              Over {LIMITS.sam.maxMessageChars} characters
            </span>
          )}
        </div>
      </div>
    </div>
  );
}