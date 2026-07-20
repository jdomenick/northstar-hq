import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, Loader2, Plus, Pause, Play, Archive } from "lucide-react";
import { toast } from "sonner";
import {
  listDirectives,
  createDirective,
  updateDirective,
  type DirectiveRow,
} from "@/lib/sam/directives/directives.functions";
import { cn } from "@/lib/utils";

function statusBadge(row: DirectiveRow): { label: string; tone: string } {
  const now = Date.now();
  const expired = row.expires_at ? Date.parse(row.expires_at) <= now : false;
  if (expired) return { label: "expired", tone: "bg-foreground/10 text-foreground/60" };
  if (row.status === "paused") return { label: "paused", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  if (row.status === "archived") return { label: "archived", tone: "bg-foreground/10 text-foreground/60" };
  return { label: "active", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
}

export function DirectivesDrawer({
  open,
  onClose,
  organizationId,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string | null;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listDirectives);
  const createFn = useServerFn(createDirective);
  const updateFn = useServerFn(updateDirective);

  const [text, setText] = useState("");
  const [priority, setPriority] = useState<number>(100);

  const key = ["sam.directives", organizationId] as const;
  const q = useQuery({
    queryKey: key,
    enabled: open && !!organizationId,
    queryFn: async () => (organizationId ? listFn({ data: { organizationId } }) : []),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("no org");
      if (!text.trim()) throw new Error("Directive text is required.");
      return createFn({ data: { organizationId, text: text.trim(), priority } });
    },
    onSuccess: () => {
      setText("");
      setPriority(100);
      qc.invalidateQueries({ queryKey: key });
      toast.success("Directive added.");
    },
    onError: (e) => toast.error((e as Error).message || "Could not add directive."),
  });

  const update = useMutation({
    mutationFn: async (input: { directiveId: string; status?: DirectiveRow["status"]; priority?: number }) => {
      if (!organizationId) throw new Error("no org");
      return updateFn({
        data: {
          organizationId,
          directiveId: input.directiveId,
          status: input.status,
          priority: input.priority,
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error((e as Error).message || "Update failed."),
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const rows = q.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        aria-label="Close directives"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <aside className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-foreground/15 bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-foreground/15 px-5 py-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-foreground/60">
              SAM
            </div>
            <div className="mt-0.5 font-display text-lg leading-tight">
              Standing directives
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-foreground/10 px-5 py-4">
          <label className="text-[10.5px] uppercase tracking-[0.22em] text-foreground/60">
            New directive
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Prioritize revenue-generating work first."
            className="mt-2 h-20 w-full resize-none rounded-md border border-foreground/15 bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[12px] text-foreground/70">
              Priority
              <input
                type="number"
                min={0}
                max={1000}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) || 0)}
                className="w-20 rounded-md border border-foreground/15 bg-background px-2 py-1 text-[12px]"
              />
            </label>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || !text.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-50"
            >
              {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {q.isLoading && (
            <div className="flex items-center gap-2 px-5 py-6 text-[13px] text-foreground/60">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading directives...
            </div>
          )}
          {!q.isLoading && rows.length === 0 && (
            <div className="px-5 py-8 text-center text-[13px] text-foreground/60">
              No directives yet. Add one above, or say "Set standing directive: ..." in chat.
            </div>
          )}
          <ul className="divide-y divide-foreground/10">
            {rows.map((row) => {
              const badge = statusBadge(row);
              return (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]", badge.tone)}>
                          {badge.label}
                        </span>
                        <span className="text-[11px] text-foreground/60">priority {row.priority}</span>
                        {row.expires_at && (
                          <span className="text-[11px] text-foreground/60">
                            expires {new Date(row.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-[13.5px] leading-snug">
                        {row.text}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {row.status === "active" ? (
                        <button
                          className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
                          onClick={() => update.mutate({ directiveId: row.id, status: "paused" })}
                          title="Pause"
                        >
                          <Pause className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
                          onClick={() => update.mutate({ directiveId: row.id, status: "active" })}
                          title="Activate"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {row.status !== "archived" && (
                        <button
                          className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
                          onClick={() => update.mutate({ directiveId: row.id, status: "archived" })}
                          title="Archive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="border-t border-foreground/10 px-5 py-3 text-[11px] text-foreground/60">
          Directives are injected into every SAM response and work-planning cycle.
          Executives+ can add, pause, or archive them.
        </footer>
      </aside>
    </div>
  );
}