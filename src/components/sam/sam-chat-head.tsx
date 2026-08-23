import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Minus, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrg } from "@/lib/org-context";
import { askSam, loadConversation } from "@/lib/sam/sam.functions";
import { useSamAttention } from "@/lib/sam/attention";
import { SAM_FULL_NAME, SAM_MARK_SRC, SAM_NAME } from "@/lib/sam/branding";

type PanelMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

const CONTEXT_LABELS: Array<[RegExp, string]> = [
  [/^\/command/, "Command Center"],
  [/^\/clients\/[^/]+/, "Client workspace"],
  [/^\/clients/, "Clients"],
  [/^\/sam\/missions/, "SAM missions"],
  [/^\/sam\/content/, "Content operations"],
  [/^\/sam\/integrations/, "Integrations"],
  [/^\/sam\/memory/, "SAM memory"],
  [/^\/sam\/control/, "SAM control"],
  [/^\/sam/, "SAM"],
  [/^\/labs\/ventures\/[^/]+/, "Venture"],
  [/^\/labs\/projects\/[^/]+/, "Project"],
  [/^\/labs\/decisions\/[^/]+/, "Decision"],
  [/^\/labs\/proposals/, "Proposals"],
  [/^\/labs\/billing/, "Billing"],
  [/^\/labs\/revenue/, "Revenue"],
  [/^\/labs\/assessments?/, "Assessments"],
  [/^\/labs\/mission-control/, "Mission Control"],
  [/^\/labs/, "NorthStar Labs"],
  [/^\/settings/, "Settings"],
];

function contextLabel(pathname: string): string {
  for (const [re, label] of CONTEXT_LABELS) {
    if (re.test(pathname)) return label;
  }
  return "NorthStar HQ";
}

/** Only routes that carry a venture id can pass a record to the SAM entrypoint. */
function ventureIdFromPath(pathname: string): string | null {
  const m = /^\/labs\/ventures\/([0-9a-f-]{36})/i.exec(pathname);
  return m ? m[1] : null;
}

export function SamChatHead() {
  const { activeOrgId } = useOrg();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const askFn = useServerFn(askSam);
  const loadFn = useServerFn(loadConversation);
  const attention = useSamAttention(activeOrgId);

  const ctx = useMemo(() => contextLabel(pathname), [pathname]);
  const ventureId = useMemo(() => ventureIdFromPath(pathname), [pathname]);

  const convQ = useQuery({
    enabled: open && !!activeOrgId && !!conversationId,
    queryKey: ["sam.conversation", conversationId],
    queryFn: async () =>
      loadFn({
        data: {
          organizationId: activeOrgId as string,
          conversationId: conversationId as string,
        },
      }),
  });

  const messages: PanelMessage[] = useMemo(
    () => ((convQ.data?.messages ?? []) as PanelMessage[]).filter((m) => m.role !== "system"),
    [convQ.data],
  );

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, pending, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // The chat head is only useful inside an organization context.
  if (!activeOrgId) return null;

  const glow = !open && (attention.data?.hasAttention ?? false);

  async function send() {
    const text = input.trim();
    if (!text || pending || !activeOrgId) return;
    setPending(true);
    setInput("");
    try {
      const res = await askFn({
        data: {
          conversationId,
          organizationId: activeOrgId,
          ventureId,
          message: text,
          title: `${ctx} - ${text.slice(0, 40)}`,
        },
      });
      if (!res.ok) {
        toast.error(res.error.message);
      }
      if (res.conversationId) setConversationId(res.conversationId);
      await qc.invalidateQueries({
        queryKey: ["sam.conversation", res.conversationId ?? conversationId],
      });
    } catch (e) {
      toast.error((e as Error).message || "SAM failed to respond.");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${SAM_NAME}, ${SAM_FULL_NAME}`}
          className={cn(
            "fixed bottom-5 right-5 z-40 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full",
            "border border-border/70 bg-background shadow-lg transition",
            "hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            "md:bottom-6 md:right-6",
            glow && "ring-2 ring-primary/70 shadow-[0_0_22px_-4px_var(--color-primary)]",
          )}
        >
          <img src={SAM_MARK_SRC} alt="" className="h-full w-full rounded-full object-cover" />
          {glow && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-background bg-primary" />
          )}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={`${SAM_NAME} messenger`}
          className={cn(
            "fixed z-40 flex flex-col overflow-hidden border border-border bg-background shadow-2xl",
            "inset-x-0 bottom-0 top-14 rounded-t-2xl",
            "md:inset-auto md:bottom-6 md:right-6 md:top-auto md:h-[560px] md:w-[400px] md:rounded-xl",
          )}
        >
          <header className="flex items-start gap-3 border-b border-border px-4 py-3">
            <img src={SAM_MARK_SRC} alt="" className="mt-0.5 h-8 w-8 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[15px] font-semibold text-foreground">
                  {SAM_NAME}
                </span>
                <span className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {SAM_FULL_NAME}
                </span>
              </div>
              <div className="truncate text-[11.5px] text-muted-foreground">Context: {ctx}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setConversationId(null);
                  setInput("");
                }}
                aria-label="New conversation"
                title="New conversation"
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Minimize"
                title="Minimize"
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConversationId(null);
                }}
                aria-label="Close"
                title="Close"
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {attention.data?.hasAttention && (
              <div className="rounded-md border-l-2 border-primary bg-primary/5 px-3 py-2 text-[12.5px] text-foreground/85">
                <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
                  Needs attention
                </div>
                <ul className="mt-1 space-y-0.5">
                  {attention.data.reasons.map((r) => (
                    <li key={r}>- {r}</li>
                  ))}
                </ul>
              </div>
            )}

            {messages.length === 0 && !pending && (
              <div className="pt-6 text-center text-[13px] leading-relaxed text-muted-foreground">
                Ask {SAM_NAME} about {ctx.toLowerCase()}. SAM answers from the systems and records
                already connected to this organization.
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap text-[13.5px] leading-[1.65]",
                    m.role === "user"
                      ? "rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-primary-foreground"
                      : "text-foreground",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {SAM_NAME} is thinking
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={`Tell ${SAM_NAME} what needs to happen`}
                className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-[13.5px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={pending || !input.trim()}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition disabled:opacity-40"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
