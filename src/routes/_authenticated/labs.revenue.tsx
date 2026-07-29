import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, TrendingUp, TrendingDown, DollarSign, Users, FileText, Share2, ArrowRight, Clock, ShieldAlert } from "lucide-react";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useRevenueClients, usePipeline, useCashflow, useProposals, useReferrals,
  useCreateClient, useCreatePipelineDeal, useCreateCashflowEntry, useCreateProposal, useCreateReferral,
  summarizeRevenue, formatMoney,
  type PipelineDeal,
} from "@/lib/mission-control/hooks";
import {
  LIFECYCLE_STAGES, STAGE_LABELS, STAGE_OWNER, OPERATOR_LABELS, allowedNextStages,
  type PipelineStage,
} from "@/lib/mission-control/labels";
import {
  useAdvanceStage, useDealTimeline, useDealTasks,
} from "@/lib/mission-control/revenue-machine";
import { ClientUsersPanel } from "@/components/client-users-panel";

export const Route = createFileRoute("/_authenticated/labs/revenue")({
  component: RevenuePage,
});

const NEW_DEAL_STAGES: PipelineStage[] = ["prospect", "researched", "contacted", "engaged"];

function RevenuePage() {
  const { activeOrgId } = useOrg();
  const clients = useRevenueClients(activeOrgId);
  const pipeline = usePipeline(activeOrgId);
  const cash = useCashflow(activeOrgId, 90);
  const proposals = useProposals(activeOrgId);
  const referrals = useReferrals(activeOrgId);

  const rev = summarizeRevenue(clients.data ?? [], pipeline.data ?? [], cash.data ?? [], proposals.data ?? []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-foreground/15 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/60">Revenue</div>
          <h1 className="mt-2 font-display text-[36px] leading-[1.02] tracking-tight md:text-[52px]">The revenue floor</h1>
          <p className="mt-3 max-w-2xl text-[14px] text-foreground/70">MRR, pipeline, proposals, cashflow, and referrals in one view. All numbers reflect what you enter here.</p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-10 md:py-10 space-y-8">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile icon={DollarSign} label="MRR" value={formatMoney(rev.mrrCents, { compact: true })} sub={`${rev.activeClients} active clients`} />
          <StatTile icon={TrendingUp} label="Pipeline" value={formatMoney(rev.pipelineValueCents, { compact: true })} sub={`${formatMoney(rev.weightedForecastCents, { compact: true })} weighted`} />
          <StatTile icon={FileText} label="Open proposals" value={String(rev.openProposals)} sub={formatMoney(rev.proposalValueCents, { compact: true })} />
          <StatTile icon={rev.netCash30Cents < 0 ? TrendingDown : TrendingUp} label="Net cash · 30d" value={formatMoney(rev.netCash30Cents, { compact: true })} tone={rev.netCash30Cents < 0 ? "warn" : "ok"} sub={`${formatMoney(rev.inflow30Cents, { compact: true })} in, ${formatMoney(rev.outflow30Cents, { compact: true })} out`} />
        </section>

        <Tabs defaultValue="pipeline" className="w-full">
          <TabsList className="flex-wrap">
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="proposals">Proposals</TabsTrigger>
            <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="mt-6"><PipelineBoard orgId={activeOrgId} deals={pipeline.data ?? []} /></TabsContent>
          <TabsContent value="clients" className="mt-6"><ClientList orgId={activeOrgId} clients={clients.data ?? []} /></TabsContent>
          <TabsContent value="proposals" className="mt-6"><ProposalList orgId={activeOrgId} proposals={proposals.data ?? []} /></TabsContent>
          <TabsContent value="cashflow" className="mt-6"><CashflowList orgId={activeOrgId} entries={cash.data ?? []} /></TabsContent>
          <TabsContent value="referrals" className="mt-6"><ReferralList orgId={activeOrgId} referrals={referrals.data ?? []} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, tone }: { icon: typeof DollarSign; label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border border-border/70 bg-card p-4">
      <div className="flex items-center gap-1.5 text-foreground/55">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-[0.22em]">{label}</span>
      </div>
      <div className={cn("mt-2 font-display text-[26px] leading-none tabular-nums", tone === "warn" && "text-[oklch(0.5_0.18_27)]")}>{value}</div>
      {sub && <div className="mt-2 text-[11.5px] text-foreground/60">{sub}</div>}
    </div>
  );
}

function SectionCard({ title, action, children, empty }: { title: string; action?: React.ReactNode; children: React.ReactNode; empty?: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-card">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="font-display text-[18px] leading-none">{title}</div>
        {action}
      </div>
      <div className="p-4">
        {children ?? (empty && <div className="py-6 text-center text-[13px] italic text-foreground/55">{empty}</div>)}
      </div>
    </div>
  );
}

function PipelineBoard({ orgId, deals }: { orgId: string | null; deals: ReturnType<typeof usePipeline>["data"] extends infer T ? NonNullable<T> : never }) {
  const create = useCreatePipelineDeal(orgId);
  const [open, setOpen] = useState(false);
  const [activeDeal, setActiveDeal] = useState<PipelineDeal | null>(null);
  return (
    <SectionCard title="Revenue Machine"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />Deal</Button></DialogTrigger>
          <NewDealDialog onClose={() => setOpen(false)} onSubmit={(v) => create.mutate(v, { onSuccess: () => { toast.success("Deal added"); setOpen(false); }, onError: (e) => toast.error((e as Error).message) })} />
        </Dialog>
      }
    >
      {deals.length === 0 ? (
        <div className="py-8 text-center text-[13px] italic text-foreground/55">No deals yet. Add your first opportunity to enter the Prospect stage.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {LIFECYCLE_STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            if (stageDeals.length === 0) return null;
            const total = stageDeals.reduce((s, d) => s + (d.value_cents ?? 0), 0);
            const owner = STAGE_OWNER[stage];
            return (
              <div key={stage} className="rounded-md border border-border/70 bg-background p-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/55">{STAGE_LABELS[stage]}</div>
                  <div className="text-[10.5px] tabular-nums text-foreground/60">{stageDeals.length}</div>
                </div>
                <div className="mt-0.5 text-[9.5px] uppercase tracking-[0.18em] text-foreground/40">{OPERATOR_LABELS[owner]}</div>
                <div className="mt-1 font-display text-[16px] tabular-nums">{formatMoney(total, { compact: true })}</div>
                <ul className="mt-2 space-y-2">
                  {stageDeals.map((d) => (
                    <li key={d.id} className="rounded border border-border/60 bg-card p-2 cursor-pointer hover:border-foreground/30"
                        onClick={() => setActiveDeal(d)}>
                      <div className="text-[12.5px] leading-tight">{d.name}</div>
                      <div className="mt-1 flex items-center justify-between text-[10.5px] text-foreground/60">
                        <span className="tabular-nums">{formatMoney(d.value_cents ?? 0, { compact: true })}</span>
                        <span>{d.probability}%</span>
                      </div>
                      {d.next_action && <div className="mt-1 text-[10.5px] italic text-foreground/60 truncate">→ {d.next_action}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      <DealDrawer orgId={orgId} deal={activeDeal} onClose={() => setActiveDeal(null)} />
    </SectionCard>
  );
}

function DealDrawer({ orgId, deal, onClose }: { orgId: string | null; deal: PipelineDeal | null; onClose: () => void }) {
  const timeline = useDealTimeline(deal?.id ?? null);
  const tasks = useDealTasks(deal?.id ?? null);
  const advance = useAdvanceStage(orgId);
  const [target, setTarget] = useState<PipelineStage | "">("");
  const [reason, setReason] = useState("");
  const stage = (deal?.stage as PipelineStage | undefined) ?? "prospect";
  const allowed = deal ? allowedNextStages(stage) : [];
  const blockingTasks = (tasks.data ?? []).filter((t) => t.blocks_stage_advance && t.status !== "done" && t.status !== "cancelled");
  return (
    <Dialog open={!!deal} onOpenChange={(o) => { if (!o) { onClose(); setTarget(""); setReason(""); } }}>
      <DialogContent className="max-w-2xl">
        {deal && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span>{deal.name}</span>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.18em]">{STAGE_LABELS[stage]}</Badge>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.18em]">{OPERATOR_LABELS[STAGE_OWNER[stage]]}</Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              <div className="rounded-md border border-border/70 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-foreground/55"><ArrowRight className="h-3 w-3" /> Advance stage</div>
                {allowed.length === 0 ? (
                  <div className="text-[12.5px] italic text-foreground/55">This deal is at a terminal stage.</div>
                ) : (
                  <div className="space-y-2">
                    {blockingTasks.length > 0 && (
                      <div className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11.5px] text-amber-800">
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <div>Blocked by {blockingTasks.length} required task{blockingTasks.length === 1 ? "" : "s"}: {blockingTasks.map((t) => t.title).join(", ")}</div>
                      </div>
                    )}
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Select value={target} onValueChange={(v) => setTarget(v as PipelineStage)}>
                        <SelectTrigger><SelectValue placeholder="Select next stage" /></SelectTrigger>
                        <SelectContent>
                          {allowed.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" disabled={!target || advance.isPending}
                        onClick={() => target && advance.mutate({ dealId: deal.id, toStage: target as PipelineStage, reason: reason.trim() || undefined }, {
                          onSuccess: (r) => { toast.success(`Moved to ${STAGE_LABELS[r.to]}`); setTarget(""); setReason(""); },
                          onError: (e) => toast.error((e as Error).message),
                        })}
                      >Advance</Button>
                    </div>
                    <Input placeholder="Reason or note (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-foreground/55">Playbook tasks</div>
                {(tasks.data ?? []).length === 0 ? (
                  <div className="text-[12.5px] italic text-foreground/55">No tasks queued for this deal yet.</div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {(tasks.data ?? []).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
                        <div className="min-w-0">
                          <div className="truncate">{t.title}</div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/50">{OPERATOR_LABELS[t.kind]} · {t.deal_stage ? STAGE_LABELS[t.deal_stage] : ""}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {t.blocks_stage_advance && <Badge variant="outline" className="text-[9px] uppercase tracking-[0.16em]">Blocks</Badge>}
                          <Badge variant="secondary" className="text-[9px] uppercase tracking-[0.16em]">{t.status.replace("_", " ")}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-foreground/55"><Clock className="h-3 w-3" /> Timeline</div>
                {(timeline.data ?? []).length === 0 ? (
                  <div className="text-[12.5px] italic text-foreground/55">No stage transitions logged yet.</div>
                ) : (
                  <ol className="space-y-1.5 text-[12px]">
                    {(timeline.data ?? []).map((e) => (
                      <li key={e.id} className="flex items-baseline gap-2">
                        <span className="tabular-nums text-foreground/45">{new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        <span>{e.from_stage ? `${STAGE_LABELS[e.from_stage]} → ` : ""}<span className="font-medium">{STAGE_LABELS[e.to_stage]}</span></span>
                        {e.reason && <span className="italic text-foreground/60 truncate">— {e.reason}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClientList({ orgId, clients }: { orgId: string | null; clients: ReturnType<typeof useRevenueClients>["data"] extends infer T ? NonNullable<T> : never }) {
  const create = useCreateClient(orgId);
  const [open, setOpen] = useState(false);
  return (
    <SectionCard title="Active clients"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />Client</Button></DialogTrigger>
          <NewClientDialog onClose={() => setOpen(false)} onSubmit={(v) => create.mutate(v, { onSuccess: () => { toast.success("Client added"); setOpen(false); }, onError: (e) => toast.error((e as Error).message) })} />
        </Dialog>
      }
    >
      {clients.length === 0 ? (
        <div className="py-8 text-center text-[13px] italic text-foreground/55"><Users className="mx-auto mb-2 h-5 w-5 opacity-40" />No clients on the books yet.</div>
      ) : (
        <ul className="divide-y divide-border/60">
          {clients.map((c) => (
            <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[14px]">{c.name}</div>
                {c.notes && <div className="mt-0.5 text-[11.5px] text-foreground/60 truncate">{c.notes}</div>}
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">{c.status}</Badge>
              <div className="flex items-center gap-3">
                <div className="font-display text-[16px] tabular-nums">{formatMoney(c.mrr_cents ?? 0, { compact: true })}<span className="text-[10px] text-foreground/50">/mo</span></div>
                {orgId && <ClientAccessDialog orgId={orgId} clientId={c.id} clientName={c.name} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ProposalList({ orgId, proposals }: { orgId: string | null; proposals: ReturnType<typeof useProposals>["data"] extends infer T ? NonNullable<T> : never }) {
  return <ProposalListInner orgId={orgId} proposals={proposals} />;
}

function ClientAccessDialog({ orgId, clientId, clientName }: { orgId: string; clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-[11px] uppercase tracking-[0.14em]">Access</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Client access , {clientName}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          {open && <ClientUsersPanel organizationId={orgId} clientId={clientId} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProposalListInner({ orgId, proposals }: { orgId: string | null; proposals: ReturnType<typeof useProposals>["data"] extends infer T ? NonNullable<T> : never }) {
  const create = useCreateProposal(orgId);
  const [open, setOpen] = useState(false);
  return (
    <SectionCard title="Proposals"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />Proposal</Button></DialogTrigger>
          <NewProposalDialog onClose={() => setOpen(false)} onSubmit={(v) => create.mutate(v, { onSuccess: () => { toast.success("Proposal added"); setOpen(false); }, onError: (e) => toast.error((e as Error).message) })} />
        </Dialog>
      }
    >
      {proposals.length === 0 ? (
        <div className="py-8 text-center text-[13px] italic text-foreground/55">No proposals yet.</div>
      ) : (
        <ul className="divide-y divide-border/60">
          {proposals.map((p) => (
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[14px]">{p.client_name}</div>
                {p.notes && <div className="mt-0.5 text-[11.5px] text-foreground/60 truncate">{p.notes}</div>}
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">{p.status}</Badge>
              <div className="font-display text-[16px] tabular-nums">{formatMoney(p.amount_cents ?? 0, { compact: true })}</div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function CashflowList({ orgId, entries }: { orgId: string | null; entries: ReturnType<typeof useCashflow>["data"] extends infer T ? NonNullable<T> : never }) {
  const create = useCreateCashflowEntry(orgId);
  const [open, setOpen] = useState(false);
  return (
    <SectionCard title="Cashflow · last 90 days"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />Entry</Button></DialogTrigger>
          <NewCashflowDialog onClose={() => setOpen(false)} onSubmit={(v) => create.mutate(v, { onSuccess: () => { toast.success("Entry logged"); setOpen(false); }, onError: (e) => toast.error((e as Error).message) })} />
        </Dialog>
      }
    >
      {entries.length === 0 ? (
        <div className="py-8 text-center text-[13px] italic text-foreground/55">No entries yet. Log inflows and outflows to see net cash.</div>
      ) : (
        <ul className="divide-y divide-border/60">
          {entries.map((e) => (
            <li key={e.id} className="grid grid-cols-[6rem_minmax(0,1fr)_auto_auto] items-center gap-3 py-2.5">
              <span className="text-[11px] tabular-nums text-foreground/55">{e.occurred_on}</span>
              <span className="text-[13.5px] truncate">{e.category}{e.note && <span className="text-foreground/50"> — {e.note}</span>}</span>
              <Badge variant="outline" className="text-[10px] uppercase">{e.direction}</Badge>
              <span className={cn("font-display text-[15px] tabular-nums", e.direction === "outflow" && "text-[oklch(0.5_0.18_27)]")}>{e.direction === "outflow" ? "-" : "+"}{formatMoney(e.amount_cents ?? 0, { compact: true })}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ReferralList({ orgId, referrals }: { orgId: string | null; referrals: ReturnType<typeof useReferrals>["data"] extends infer T ? NonNullable<T> : never }) {
  const create = useCreateReferral(orgId);
  const [open, setOpen] = useState(false);
  return (
    <SectionCard title="Referrals"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />Referral</Button></DialogTrigger>
          <NewReferralDialog onClose={() => setOpen(false)} onSubmit={(v) => create.mutate(v, { onSuccess: () => { toast.success("Referral logged"); setOpen(false); }, onError: (e) => toast.error((e as Error).message) })} />
        </Dialog>
      }
    >
      {referrals.length === 0 ? (
        <div className="py-8 text-center text-[13px] italic text-foreground/55"><Share2 className="mx-auto mb-2 h-5 w-5 opacity-40" />No referrals tracked yet.</div>
      ) : (
        <ul className="divide-y divide-border/60">
          {referrals.map((r) => (
            <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[14px]">{r.referrer_name} → {r.referred_name}</div>
                {r.notes && <div className="mt-0.5 text-[11.5px] text-foreground/60 truncate">{r.notes}</div>}
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">{r.status}</Badge>
              <div className="font-display text-[15px] tabular-nums">{r.value_cents ? formatMoney(r.value_cents, { compact: true }) : ""}</div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ───── Dialogs
function NewDealDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (v: { name: string; contact?: string; stage?: PipelineStage; value_cents?: number; probability?: number; expected_close?: string; next_action?: string; source?: string }) => void }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [stage, setStage] = useState<PipelineStage>("prospect");
  const [value, setValue] = useState("");
  const [prob, setProb] = useState("25");
  const [nextAction, setNextAction] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New pipeline deal</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <Input placeholder="Deal name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Contact (optional)" value={contact} onChange={(e) => setContact(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Select value={stage} onValueChange={(v) => setStage(v as PipelineStage)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{NEW_DEAL_STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" placeholder="Value ($)" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="Probability %" value={prob} onChange={(e) => setProb(e.target.value)} min={0} max={100} />
          <Input placeholder="Next action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!name.trim()} onClick={() => onSubmit({
          name: name.trim(), contact: contact.trim() || undefined, stage,
          value_cents: Math.round(Number(value || 0) * 100), probability: Math.max(0, Math.min(100, Number(prob || 0))),
          next_action: nextAction.trim() || undefined,
        })}>Add deal</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewClientDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (v: { name: string; mrr_cents?: number; status?: "active" | "paused" | "churned" | "onboarding"; notes?: string; started_at?: string }) => void }) {
  const [name, setName] = useState("");
  const [mrr, setMrr] = useState("");
  const [status, setStatus] = useState<"active" | "paused" | "churned" | "onboarding">("active");
  const [notes, setNotes] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add client</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <Input placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="MRR ($/mo)" value={mrr} onChange={(e) => setMrr(e.target.value)} />
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="onboarding">Onboarding</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="churned">Churned</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!name.trim()} onClick={() => onSubmit({ name: name.trim(), mrr_cents: Math.round(Number(mrr || 0) * 100), status, notes: notes.trim() || undefined })}>Add client</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewProposalDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (v: { client_name: string; amount_cents: number; status?: "draft" | "sent" | "accepted" | "declined" | "expired"; notes?: string }) => void }) {
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"draft" | "sent" | "accepted" | "declined" | "expired">("draft");
  const [notes, setNotes] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New proposal</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <Input placeholder="Client name" value={client} onChange={(e) => setClient(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="Amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!client.trim() || !amount} onClick={() => onSubmit({ client_name: client.trim(), amount_cents: Math.round(Number(amount) * 100), status, notes: notes.trim() || undefined })}>Add proposal</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewCashflowDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (v: { occurred_on: string; direction: "inflow" | "outflow"; category: string; amount_cents: number; note?: string }) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [direction, setDirection] = useState<"inflow" | "outflow">("inflow");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Log cashflow entry</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inflow">Inflow</SelectItem>
              <SelectItem value="outflow">Outflow</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="Category (e.g. Client retainer, Software)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <Input type="number" placeholder="Amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Textarea placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!category.trim() || !amount} onClick={() => onSubmit({ occurred_on: date, direction, category: category.trim(), amount_cents: Math.round(Number(amount) * 100), note: note.trim() || undefined })}>Log entry</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewReferralDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (v: { referrer_name: string; referred_name: string; status?: "new" | "introduced" | "in_progress" | "won" | "lost"; value_cents?: number; notes?: string }) => void }) {
  const [referrer, setReferrer] = useState("");
  const [referred, setReferred] = useState("");
  const [status, setStatus] = useState<"new" | "introduced" | "in_progress" | "won" | "lost">("new");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Log referral</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <Input placeholder="Referrer" value={referrer} onChange={(e) => setReferrer(e.target.value)} />
        <Input placeholder="Referred prospect" value={referred} onChange={(e) => setReferred(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="introduced">Introduced</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Value ($, optional)" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!referrer.trim() || !referred.trim()} onClick={() => onSubmit({ referrer_name: referrer.trim(), referred_name: referred.trim(), status, value_cents: value ? Math.round(Number(value) * 100) : undefined, notes: notes.trim() || undefined })}>Log referral</Button>
      </DialogFooter>
    </DialogContent>
  );
}