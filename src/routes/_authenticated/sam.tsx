import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
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

export const Route = createFileRoute("/_authenticated/sam")({
  component: SamPage,
  head: () => ({
    meta: [
      { title: "SAM - Northstar" },
      {
        name: "description",
        content: "SAM. Northstar's executive intelligence system.",
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
  const { activeOrgId, activeOrg, activeVenture } = useOrg();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  }, [messages.length, pending]);

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

  const contextLine = [activeOrg?.name, activeVenture?.name].filter(Boolean).join(" - ");

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
                SAM - Executive Intelligence - Read only
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
            {pending && (
              <div className="mt-10 border-t border-foreground/15 pt-6">
                <SectionLabel>SAM is reading the record</SectionLabel>
                <div className="mt-3 flex items-center gap-2 text-[13px] italic text-foreground/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  Assembling evidence and drafting the response.
                </div>
              </div>
            )}
          </div>
        </div>

        <Composer
          value={input}
          setValue={setInput}
          onSubmit={handleSubmit}
          disabled={pending || !activeOrgId}
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
        SAM reads your organization&apos;s live record. Every answer cites the projects,
        decisions, and commitments it relies on. SAM analyzes and advises;
        it does not take actions on your behalf.
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
          {resp.executive_summary}
        </p>
      )}

      <div className="mt-5 whitespace-pre-wrap text-[14.5px] leading-[1.8] text-foreground/85">
        {msg.content}
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
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
  disabled,
  textareaRef,
}: {
  value: string;
  setValue: (v: string) => void;
  onSubmit: (v: string) => void;
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
          <span>Return sends - Shift + Return for a new line</span>
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