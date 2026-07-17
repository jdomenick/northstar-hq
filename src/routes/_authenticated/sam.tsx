import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
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
      { title: "SAM  -  Northstar" },
      {
        name: "description",
        content: "SAM  -  Northstar's executive intelligence system.",
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
  const { activeOrgId } = useOrg();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)]">
      {/* Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex w-72 flex-col border-r border-border/60 bg-card/20",
        )}
      >
        <ConversationList
          conversations={(conversationsQ.data ?? []) as ConvSummary[]}
          activeId={activeId}
          onSelect={(id) => setActiveId(id)}
          onNew={() => setActiveId(null)}
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

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 lg:px-8">
          <div>
            <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
              <Sparkles className="h-3 w-3" strokeWidth={2} />
              SAM · read-only
            </div>
            <h1 className="mt-1 font-display text-[22px] leading-tight text-foreground">
              {activeQ.data?.conversation?.title ?? "New conversation"}
            </h1>
          </div>
          <button
            className="lg:hidden rounded-md border border-border/60 px-2 py-1 text-[12px] text-muted-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            History
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-6 lg:px-8"
        >
          {messages.length === 0 && !pending && (
            <EmptyState onPick={(s) => setInput(s)} />
          )}
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((m) => (
              <MessageView key={m.id} msg={m} />
            ))}
            {pending && (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                SAM is thinking…
              </div>
            )}
          </div>
        </div>

        <Composer
          value={input}
          setValue={setInput}
          onSubmit={handleSubmit}
          disabled={pending || !activeOrgId}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-[300px] border-l border-border bg-background p-3">
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
      <div className="flex items-center justify-between px-3 py-3">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70">
          Conversations
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-[12px] font-medium text-background hover:opacity-90"
          aria-label="New conversation"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && (
          <div className="px-3 py-6 text-[12px] text-muted-foreground">
            No conversations yet.
          </div>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex items-center gap-2 rounded-md px-2 py-2 text-[13px]",
              c.id === activeId
                ? "bg-secondary/60 text-foreground"
                : "text-muted-foreground hover:bg-secondary/30",
            )}
          >
            <button
              className="flex-1 truncate text-left"
              onClick={() => onSelect(c.id)}
            >
              {c.title || "Untitled"}
            </button>
            <button
              className="opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Rename"
              onClick={async () => {
                const t = window.prompt("Rename conversation", c.title);
                if (t && t.trim()) await onRename(c.id, t.trim());
              }}
            >
              <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
            </button>
            <button
              className="opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Archive"
              onClick={async () => {
                if (window.confirm("Archive this conversation?")) {
                  await onArchive(c.id);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive/80" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const suggestions = [
    "What deserves my attention today?",
    "Which projects are currently at risk?",
    "Which commitments are overdue?",
    "What decisions are waiting on me?",
    "Summarize activity across my ventures.",
  ];
  return (
    <div className="mx-auto max-w-2xl pt-16">
      <h2 className="font-display text-[32px] leading-tight text-foreground">
        What do you want to understand?
      </h2>
      <p className="mt-3 text-[14px] text-muted-foreground">
        SAM reads your organization's live data. Answers cite the records they
        rely on. SAM is read-only  -  it does not take actions on your behalf.
      </p>
      <div className="mt-8 space-y-1">
        {suggestions.map((s) => (
          <button
            key={s}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px] text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            onClick={() => onPick(s)}
          >
            <span>{s}</span>
            <ArrowUp className="h-3 w-3 rotate-45 opacity-50" />
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageView({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const { activeOrgId } = useOrg();
  const feedbackFn = useServerFn(submitResponseFeedback);
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] rounded-2xl bg-secondary/50 px-4 py-2.5 text-[14px] text-foreground">
          {msg.content}
          {msg.status === "failed" && (
            <div className="mt-1 text-[11px] text-destructive">
              Response failed  -  try again.
            </div>
          )}
        </div>
      </div>
    );
  }

  const meta = msg.metadata ?? {};
  const resp = meta.response;
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70">
        <Sparkles className="h-3 w-3" /> SAM
        {meta.confidence && (
          <span className="ml-2 rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-foreground">
            Confidence · {meta.confidence.band.replace("_", " ")}
          </span>
        )}
      </div>

      {resp?.executive_summary && (
        <p className="mb-3 text-[14px] font-medium text-foreground">
          {resp.executive_summary}
        </p>
      )}
      <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
        {msg.content}
      </div>

      {resp?.unsupported_action && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[13px]">
          <div className="font-medium text-amber-500">Unsupported action</div>
          <div className="mt-1 text-muted-foreground">
            {resp.unsupported_action.reason}
          </div>
          {resp.unsupported_action.suggested_manual_path && (
            <div className="mt-2 text-foreground">
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
        <div className="mt-3 rounded-md bg-secondary/30 p-3 text-[13px] text-foreground">
          <span className="text-muted-foreground">SAM asks: </span>
          {resp.next_question}
        </div>
      )}

      {(meta.citations?.length ?? 0) > 0 && (
        <SourcesDrawer citations={meta.citations!} hrefs={meta.hrefs ?? {}} />
      )}

      {meta.confidence?.reasons && meta.confidence.reasons.length > 0 && (
        <ConfidenceDrawer confidence={meta.confidence} />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(msg.content);
            toast.success("Copied");
          }}
        >
          <Copy className="h-3 w-3" /> Copy
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
            className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
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
    </div>
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
    <div className="mt-3">
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/70">
        {title}
      </div>
      <ul className="mt-1 space-y-1 text-[13.5px] text-foreground">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
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
    <div className="mt-3 rounded-md border border-border/50">
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Sources · {citations.length}</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <ul className="space-y-1 border-t border-border/50 px-3 py-2 text-[13px]">
          {citations.map((c, i) => {
            const href = hrefs[`${c.entity_type}:${c.entity_id}`];
            const label = `${c.entity_type.replace("_", " ")} · ${c.kind}`;
            return (
              <li key={i} className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  {label}
                </span>
                {href ? (
                  <Link to={href as never} className="truncate text-foreground hover:underline">
                    {c.title ?? c.entity_id}
                  </Link>
                ) : (
                  <span className="truncate text-muted-foreground">
                    {c.title ?? c.entity_id}
                  </span>
                )}
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
    <div className="mt-2 rounded-md border border-border/50">
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          Confidence · {confidence.band.replace("_", " ")}{" "}
          <span className="text-muted-foreground/70">
            ({Math.round(confidence.score * 100)}%)
          </span>
        </span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="border-t border-border/50 px-3 py-2 text-[12.5px] text-muted-foreground">
          <ul className="mb-2 space-y-1">
            {confidence.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11.5px] text-muted-foreground/80">
            {Object.entries(confidence.signals).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span>{Math.round(Number(v) * 100)}%</span>
              </div>
            ))}
          </div>
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
}: {
  value: string;
  setValue: (v: string) => void;
  onSubmit: (v: string) => void;
  disabled: boolean;
}) {
  const overLimit = value.length > LIMITS.sam.maxMessageChars;
  return (
    <div className="border-t border-border/60 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-5 pt-4 lg:px-8">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border/60 bg-card/60 p-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(value);
            }
          }}
          rows={1}
          placeholder="Ask SAM anything  -  Shift+Enter for a new line"
          aria-label="Ask SAM"
          className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[14.5px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          disabled={disabled}
          maxLength={LIMITS.sam.maxMessageChars + 200}
        />
        <button
          onClick={() => onSubmit(value)}
          disabled={disabled || !value.trim() || overLimit}
          aria-label="Send message"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background hover:opacity-90 disabled:opacity-30"
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </div>
      {overLimit && (
        <div className="mx-auto mt-2 max-w-3xl text-[11.5px] text-destructive">
          Message exceeds {LIMITS.sam.maxMessageChars} characters.
        </div>
      )}
    </div>
  );
}