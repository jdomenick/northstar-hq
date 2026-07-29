import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, FileText, ArrowRight } from "lucide-react";
import { useOrg } from "@/lib/org-context";
import { useRevenueClients, usePipeline, useCreateClient, formatMoney } from "@/lib/mission-control/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { listProposals, getProposalMetrics, generateProposal } from "@/lib/proposals/proposals.functions";

export const Route = createFileRoute("/_authenticated/labs/proposals/")({
  component: ProposalsIndex,
  head: () => ({
    meta: [
      { title: "Proposals | NorthStar Labs" },
      { name: "description", content: "Draft, approve, send, and track NorthStar Labs engagement proposals." },
      { property: "og:title", content: "Proposals | NorthStar Labs" },
      { property: "og:description", content: "Draft, approve, send, and track NorthStar Labs engagement proposals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_TONE: Record<string, string> = {
  draft: "bg-foreground/10 text-foreground",
  internal_review: "bg-amber-500/10 text-amber-600",
  approved: "bg-primary/10 text-primary",
  ready_to_send: "bg-primary/10 text-primary",
  sent: "bg-sky-500/10 text-sky-600",
  viewed: "bg-sky-500/15 text-sky-700",
  accepted: "bg-emerald-500/10 text-emerald-600",
  declined: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
  superseded: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

function ProposalsIndex() {
  const { activeOrgId } = useOrg();
  const nav = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listProposals);
  const metricsFn = useServerFn(getProposalMetrics);
  const generateFn = useServerFn(generateProposal);

  const list = useQuery({
    queryKey: ["nsl-proposals", activeOrgId],
    queryFn: () => listFn({ data: { organizationId: activeOrgId! } }),
    enabled: !!activeOrgId,
  });
  const metrics = useQuery({
    queryKey: ["nsl-proposals-metrics", activeOrgId],
    queryFn: () => metricsFn({ data: { organizationId: activeOrgId! } }),
    enabled: !!activeOrgId,
  });

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [pipelineId, setPipelineId] = useState<string>("");
  const [newClientName, setNewClientName] = useState("");
  const clients = useRevenueClients(activeOrgId);
  const pipeline = usePipeline(activeOrgId);
  const createClient = useCreateClient(activeOrgId);
  const hasClients = (clients.data ?? []).length > 0;

  const addClient = async () => {
    const name = newClientName.trim();
    if (!name) return;
    try {
      const row = await createClient.mutateAsync({ name, status: "onboarding" });
      setNewClientName("");
      if (row?.id) setClientId(row.id);
      toast.success(`${name} added. You can generate their proposal now.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the client");
    }
  };

  const pipelineForClient = useMemo(() => {
    return (pipeline.data ?? []).filter((d) => !clientId || d.client_id === clientId);
  }, [pipeline.data, clientId]);

  const create = useMutation({
    mutationFn: async () => {
      if (!activeOrgId || !clientId) throw new Error("Select a client");
      return generateFn({ data: { organizationId: activeOrgId, clientId, pipelineId: pipelineId || undefined } });
    },
    onSuccess: (res) => {
      toast.success(`Draft created: ${res.proposalNumber}`);
      qc.invalidateQueries({ queryKey: ["nsl-proposals", activeOrgId] });
      setOpen(false);
      nav({ to: "/labs/proposals/$id", params: { id: res.proposalId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to generate"),
  });

  const m = metrics.data;

  return (
    <div className="min-h-screen">
      <header className="border-b border-foreground/15 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/60">NorthStar Labs</div>
            <h1 className="mt-2 font-display text-[32px] leading-[1.02] tracking-tight md:text-[44px]">Proposals</h1>
            <p className="mt-3 max-w-2xl text-[14px] text-foreground/70">Generate, approve, and send engagement proposals. Every action is auditable.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> New proposal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate a new proposal</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/60">Client</label>
                  {hasClients && (
                    <Select value={clientId} onValueChange={(v) => { setClientId(v); setPipelineId(""); }}>
                      <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                      <SelectContent>
                        {(clients.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <div className={hasClients ? "mt-2" : ""}>
                    {!hasClients && (
                      <p className="mb-2 text-xs text-foreground/60">
                        No clients yet. Add your first one here and the proposal will be created for them.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder={hasClients ? "Or add a new client" : "Client name"}
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addClient(); } }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => void addClient()}
                        disabled={!newClientName.trim() || createClient.isPending}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
                {clientId && pipelineForClient.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/60">Link a pipeline deal (optional)</label>
                    <Select value={pipelineId} onValueChange={setPipelineId}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        {pipelineForClient.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} · {formatMoney(d.value_cents ?? 0, { compact: true })}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={!clientId || create.isPending}>Generate draft</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-8 space-y-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Total" value={String(m?.total ?? 0)} />
          <Stat label="Draft" value={String(m?.draft ?? 0)} />
          <Stat label="In review" value={String(m?.internalReview ?? 0)} />
          <Stat label="Sent" value={String(m?.sent ?? 0)} sub={`${m?.viewed ?? 0} viewed`} />
          <Stat label="Accepted" value={String(m?.accepted ?? 0)} sub={formatMoney(m?.acceptedValueCents ?? 0, { compact: true })} />
        </section>

        <section className="rounded-lg border border-foreground/10">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-foreground/10 px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-foreground/60">
            <div>Proposal</div><div>Value</div><div>Status</div><div className="w-12" />
          </div>
          {list.isLoading && <div className="p-6 text-sm text-foreground/60">Loading…</div>}
          {list.data && list.data.length === 0 && (
            <div className="p-10 text-center text-sm text-foreground/60">
              <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No proposals yet. Generate one from an existing client.
            </div>
          )}
          {(list.data ?? []).map((p) => (
            <Link key={p.id} to="/labs/proposals/$id" params={{ id: p.id }} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-foreground/5 px-4 py-3 hover:bg-foreground/5">
              <div>
                <div className="text-sm font-medium">{p.title}</div>
                <div className="text-xs text-foreground/60">{p.proposal_number} · {p.client_name}</div>
              </div>
              <div className="text-sm tabular-nums">{formatMoney(Number(p.total_value_cents ?? 0), { compact: true })}</div>
              <Badge className={STATUS_TONE[p.status] ?? ""} variant="outline">{p.status.replace(/_/g, " ")}</Badge>
              <ArrowRight className="h-4 w-4 text-foreground/40" />
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-background p-4">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-foreground/60">{label}</div>
      <div className="mt-1 font-display text-2xl tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-foreground/60">{sub}</div>}
    </div>
  );
}