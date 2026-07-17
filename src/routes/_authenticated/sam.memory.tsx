import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/lib/org-context";
import { cn } from "@/lib/utils";
import { useVentures } from "@/lib/data-hooks";
import {
  listMemory,
  createMemory,
  updateMemory,
  confirmMemory,
  rejectMemory,
  disputeMemory,
  markMemoryOutdated,
  archiveMemory,
  restoreMemory,
  listMemoryConflicts,
  resolveMemoryConflict,
  listMemoryVersions,
} from "@/lib/sam/memory/memory.functions";
import type { SamMemoryItem, SamMemoryLayer, SamMemoryStatus, SamMemoryVersion } from "@/lib/data-hooks";

export const Route = createFileRoute("/_authenticated/sam/memory")({
  component: SamMemoryPage,
  head: () => ({
    meta: [
      { title: "SAM Memory — Northstar" },
      { name: "description", content: "Review, confirm, and manage SAM's structured executive memory." },
    ],
  }),
});

const LAYERS: Array<{ value: SamMemoryLayer | "all"; label: string }> = [
  { value: "all", label: "All layers" },
  { value: "founder", label: "Founder" },
  { value: "organization", label: "Organization" },
  { value: "venture", label: "Venture" },
  { value: "operational", label: "Operational" },
  { value: "historical", label: "Historical" },
  { value: "preference", label: "Preference" },
];

const STATUS_LABEL: Record<SamMemoryStatus, string> = {
  proposed: "Proposed",
  confirmed: "Confirmed",
  disputed: "Disputed",
  outdated: "Outdated",
  superseded: "Superseded",
  archived: "Archived",
};

function SamMemoryPage() {
  const { activeOrgId } = useOrg();
  const [tab, setTab] = useState<"all" | "proposals" | "conflicts" | "archive">("all");
  const [layer, setLayer] = useState<SamMemoryLayer | "all">("all");
  const [ventureId, setVentureId] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const venturesQ = useVentures(activeOrgId);
  const listFn = useServerFn(listMemory);
  const conflictsFn = useServerFn(listMemoryConflicts);

  const filterStatus = tab === "proposals" ? "proposed" : tab === "archive" ? "archived" : undefined;

  const memoryQ = useQuery({
    enabled: !!activeOrgId && tab !== "conflicts",
    queryKey: ["sam.memory", activeOrgId, tab, layer, ventureId, query],
    queryFn: async (): Promise<SamMemoryItem[]> =>
      (await listFn({
        data: {
          organizationId: activeOrgId!,
          layer: layer === "all" ? undefined : layer,
          status: filterStatus,
          ventureId: ventureId === "all" ? undefined : ventureId,
          query: query || undefined,
        },
      })) as SamMemoryItem[],
  });

  const conflictsQ = useQuery({
    enabled: !!activeOrgId && tab === "conflicts",
    queryKey: ["sam.memory.conflicts", activeOrgId],
    queryFn: async () => conflictsFn({ data: { organizationId: activeOrgId! } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sam.memory", activeOrgId] });
    qc.invalidateQueries({ queryKey: ["sam.memory.conflicts", activeOrgId] });
  };

  return (
    <div>
      <PageHeader
        eyebrow="SAM"
        title="Memory"
        description="Structured, source-backed knowledge SAM uses to reason. Every item is reviewable, editable, and versioned."
      />
      <PageBody>
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memory…"
            className="min-w-[220px] flex-1 rounded-md bg-secondary/40 px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
          <select
            value={layer}
            onChange={(e) => setLayer(e.target.value as SamMemoryLayer | "all")}
            className="rounded-md bg-secondary/40 px-2.5 py-2 text-[12.5px] outline-none hover:bg-secondary/60"
          >
            {LAYERS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <select
            value={ventureId}
            onChange={(e) => setVentureId(e.target.value)}
            className="rounded-md bg-secondary/40 px-2.5 py-2 text-[12.5px] outline-none hover:bg-secondary/60"
          >
            <option value="all">All ventures</option>
            {(venturesQ.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <button
            onClick={() => setCreateOpen(true)}
            className="ml-auto rounded-md bg-foreground px-3 py-2 text-[12.5px] font-medium text-background hover:opacity-90"
          >
            New memory
          </button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="mb-6 -mx-2 h-auto flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0">
            {(["all","proposals","conflicts","archive"] as const).map((v) => (
              <TabsTrigger key={v} value={v} className="relative rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[12.5px] text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none capitalize">
                {v}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="all">
            <MemoryList items={memoryQ.data ?? []} loading={memoryQ.isLoading} onChanged={invalidate} />
          </TabsContent>
          <TabsContent value="proposals">
            <MemoryList items={memoryQ.data ?? []} loading={memoryQ.isLoading} onChanged={invalidate} emphasize="proposed" />
          </TabsContent>
          <TabsContent value="conflicts">
            <ConflictList items={conflictsQ.data ?? []} loading={conflictsQ.isLoading} onChanged={invalidate} orgId={activeOrgId} />
          </TabsContent>
          <TabsContent value="archive">
            <MemoryList items={memoryQ.data ?? []} loading={memoryQ.isLoading} onChanged={invalidate} emphasize="archived" />
          </TabsContent>
        </Tabs>
      </PageBody>
      {createOpen && (
        <CreateMemoryDialog
          orgId={activeOrgId}
          ventures={venturesQ.data ?? []}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); invalidate(); }}
        />
      )}
    </div>
  );
}

function MemoryList({
  items,
  loading,
  onChanged,
  emphasize,
}: {
  items: SamMemoryItem[];
  loading: boolean;
  onChanged: () => void;
  emphasize?: SamMemoryStatus;
}) {
  const { activeOrgId } = useOrg();
  const [editItem, setEditItem] = useState<SamMemoryItem | null>(null);
  const [versionsItem, setVersionsItem] = useState<SamMemoryItem | null>(null);
  const confirmFn = useServerFn(confirmMemory);
  const rejectFn = useServerFn(rejectMemory);
  const disputeFn = useServerFn(disputeMemory);
  const outdatedFn = useServerFn(markMemoryOutdated);
  const archiveFn = useServerFn(archiveMemory);
  const restoreFn = useServerFn(restoreMemory);

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "confirm" | "reject" | "dispute" | "outdated" | "archive" | "restore" }) => {
      const data = { organizationId: activeOrgId!, id };
      if (action === "confirm") return confirmFn({ data });
      if (action === "reject") return rejectFn({ data });
      if (action === "dispute") return disputeFn({ data });
      if (action === "outdated") return outdatedFn({ data });
      if (action === "archive") return archiveFn({ data });
      return restoreFn({ data });
    },
    onSuccess: () => { toast.success("Memory updated"); onChanged(); },
    onError: (e) => toast.error((e as Error).message || "Update failed"),
  });

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-card/30" />;
  if (items.length === 0) return <p className="text-[13px] text-muted-foreground">No memory items match.</p>;

  return (
    <>
    <ul className="divide-y divide-border/60">
      {items.map((m) => (
        <li key={m.id} id={m.id} className="grid grid-cols-[1fr_auto] gap-4 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                emphasize === m.status && "bg-foreground text-background",
              )}>{m.layer}</span>
              <span className="rounded bg-secondary/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {STATUS_LABEL[m.status as SamMemoryStatus] ?? m.status}
              </span>
              {m.confidence_band && (
                <span className="rounded bg-secondary/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.confidence_band.replace("_", " ")}
                </span>
              )}
              {m.expires_at && new Date(m.expires_at).getTime() < Date.now() && (
                <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-destructive">expired</span>
              )}
            </div>
            <div className="mt-1 truncate text-[13.5px] text-foreground">{m.title}</div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{m.statement}</p>
            <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground/80">
              <span>{m.category}</span>
              {m.last_confirmed_at && <span>confirmed {m.last_confirmed_at.slice(0,10)}</span>}
              {m.source_type && <span>source: {m.source_type.replace(/_/g," ")}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1">
              <ActionBtn tone="muted" onClick={() => setEditItem(m)}>Edit</ActionBtn>
              <ActionBtn tone="muted" onClick={() => setVersionsItem(m)}>History</ActionBtn>
            </div>
            {m.status === "proposed" && (
              <>
                <ActionBtn onClick={() => act.mutate({ id: m.id, action: "confirm" })}>Confirm</ActionBtn>
                <ActionBtn onClick={() => act.mutate({ id: m.id, action: "reject" })} tone="muted">Reject</ActionBtn>
              </>
            )}
            {m.status === "confirmed" && (
              <>
                <ActionBtn onClick={() => act.mutate({ id: m.id, action: "dispute" })} tone="muted">Dispute</ActionBtn>
                <ActionBtn onClick={() => act.mutate({ id: m.id, action: "outdated" })} tone="muted">Mark outdated</ActionBtn>
                <ActionBtn onClick={() => act.mutate({ id: m.id, action: "archive" })} tone="muted">Archive</ActionBtn>
              </>
            )}
            {m.status === "archived" && (
              <ActionBtn onClick={() => act.mutate({ id: m.id, action: "restore" })}>Restore</ActionBtn>
            )}
            {(m.status === "disputed" || m.status === "outdated") && (
              <ActionBtn onClick={() => act.mutate({ id: m.id, action: "confirm" })}>Reconfirm</ActionBtn>
            )}
          </div>
        </li>
      ))}
    </ul>
    {editItem && (
      <MemoryEditorDialog
        item={editItem}
        orgId={activeOrgId}
        onClose={() => setEditItem(null)}
        onSaved={() => { setEditItem(null); onChanged(); }}
      />
    )}
    {versionsItem && (
      <VersionHistoryDrawer
        item={versionsItem}
        orgId={activeOrgId}
        onClose={() => setVersionsItem(null)}
      />
    )}
    </>
  );
}

function ActionBtn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone?: "muted" }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-[11.5px]",
        tone === "muted"
          ? "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          : "bg-foreground text-background hover:opacity-90",
      )}
    >{children}</button>
  );
}

function ConflictList({ items, loading, onChanged, orgId }: {
  items: import("@/lib/data-hooks").SamMemoryConflict[];
  loading: boolean;
  onChanged: () => void;
  orgId: string | null;
}) {
  const resolveFn = useServerFn(resolveMemoryConflict);
  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-card/30" />;
  if (items.length === 0) return <p className="text-[13px] text-muted-foreground">No open conflicts.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {items.map((c) => (
        <li key={c.id} className="grid grid-cols-[1fr_auto] gap-4 py-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/70">{c.status}</div>
            <div className="mt-1 text-[13.5px] text-foreground">{c.reason}</div>
            <div className="mt-1 text-[11.5px] text-muted-foreground">
              Items {c.memory_item_a_id.slice(0,8)} ↔ {c.memory_item_b_id.slice(0,8)}
            </div>
          </div>
          {c.status === "open" && (
            <div className="flex flex-col items-end gap-1">
              <ActionBtn onClick={async () => { await resolveFn({ data: { organizationId: orgId!, id: c.id, status: "resolved" } }); onChanged(); }}>Resolve</ActionBtn>
              <ActionBtn tone="muted" onClick={async () => { await resolveFn({ data: { organizationId: orgId!, id: c.id, status: "dismissed" } }); onChanged(); }}>Dismiss</ActionBtn>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function CreateMemoryDialog({
  orgId, ventures, onClose, onCreated,
}: {
  orgId: string | null;
  ventures: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const createFn = useServerFn(createMemory);
  const [layer, setLayer] = useState<SamMemoryLayer>("organization");
  const [category, setCategory] = useState("general");
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [ventureId, setVentureId] = useState<string>("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!orgId || !title.trim() || !statement.trim()) return;
    if (layer === "venture" && !ventureId) { toast.error("Pick a venture"); return; }
    setPending(true);
    try {
      await createFn({
        data: {
          organizationId: orgId,
          layer,
          category: category.trim() || "general",
          title: title.trim(),
          statement: statement.trim(),
          ventureId: layer === "venture" ? ventureId : null,
          source_type: "manual",
          status: "confirmed",
        },
      });
      toast.success("Memory created");
      onCreated();
    } catch (e) {
      toast.error((e as Error).message || "Create failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70">SAM · Memory</div>
          <h2 className="mt-0.5 font-display text-[20px] text-foreground">New memory</h2>
        </div>
        <div className="space-y-3 text-[13px]">
          <label className="block">
            <span className="text-muted-foreground">Layer</span>
            <select value={layer} onChange={(e) => setLayer(e.target.value as SamMemoryLayer)} className="mt-1 w-full rounded-md bg-secondary/40 px-2 py-2 outline-none">
              {LAYERS.filter((l) => l.value !== "all").map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </label>
          {layer === "venture" && (
            <label className="block">
              <span className="text-muted-foreground">Venture</span>
              <select value={ventureId} onChange={(e) => setVentureId(e.target.value)} className="mt-1 w-full rounded-md bg-secondary/40 px-2 py-2 outline-none">
                <option value="">Choose…</option>
                {ventures.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-muted-foreground">Category</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-md bg-secondary/40 px-2 py-2 outline-none" />
          </label>
          <label className="block">
            <span className="text-muted-foreground">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md bg-secondary/40 px-2 py-2 outline-none" />
          </label>
          <label className="block">
            <span className="text-muted-foreground">Statement</span>
            <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={4} className="mt-1 w-full resize-none rounded-md bg-secondary/40 px-2 py-2 outline-none" />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button>
          <button disabled={pending} onClick={submit} className="rounded-md bg-foreground px-3 py-1.5 text-[12.5px] font-medium text-background hover:opacity-90 disabled:opacity-60">
            {pending ? "Saving…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}