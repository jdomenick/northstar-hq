import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, Send, CheckCircle2, RotateCcw, Copy, Download, MessageSquare, Archive, Eye, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/mission-control/hooks";
import { LifecycleRail, NextStepBanner, deriveLifecycle } from "@/components/client-lifecycle";
import {
  getProposal, updateProposalDraft, submitForReview, approveProposal, returnProposalToDraft,
  sendProposal, markSuperseded, listComments, addComment, reissueProposalLink,
} from "@/lib/proposals/proposals.functions";
import { SECTIONS } from "@/lib/proposals/content";

export const Route = createFileRoute("/_authenticated/labs/proposals/$id")({
  component: ProposalDetail,
  head: () => ({ meta: [{ title: "Proposal | NorthStar Labs" }] }),
});

function ProposalDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const getFn = useServerFn(getProposal);
  const updateFn = useServerFn(updateProposalDraft);
  const submitFn = useServerFn(submitForReview);
  const approveFn = useServerFn(approveProposal);
  const returnFn = useServerFn(returnProposalToDraft);
  const sendFn = useServerFn(sendProposal);
  const supersedeFn = useServerFn(markSuperseded);
  const commentsFn = useServerFn(listComments);
  const addCommentFn = useServerFn(addComment);
  const reissueFn = useServerFn(reissueProposalLink);

  const q = useQuery({
    queryKey: ["nsl-proposal", id],
    queryFn: () => getFn({ data: { proposalId: id } }),
  });
  const commentsQ = useQuery({
    queryKey: ["nsl-proposal-comments", id],
    queryFn: () => commentsFn({ data: { proposalId: id } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["nsl-proposal", id] });
    qc.invalidateQueries({ queryKey: ["nsl-proposals"] });
  };

  const [publicLink, setPublicLink] = useState<string | null>(null);

  const copyLink = (url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
  };

  const doSend = useMutation({
    mutationFn: () => sendFn({ data: { proposalId: id } }),
    onSuccess: (res) => {
      const url = `${window.location.origin}/proposal/${res.token}`;
      setPublicLink(url);
      copyLink(url);
      toast.success("Sent. Public link copied to clipboard.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Send failed"),
  });

  const doReissue = useMutation({
    mutationFn: () => reissueFn({ data: { proposalId: id } }),
    onSuccess: (res) => {
      const url = `${window.location.origin}/proposal/${res.token}`;
      setPublicLink(url);
      copyLink(url);
      toast.success("New client link copied. The previous link no longer works.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not issue a link"),
  });

  const proposal = q.data?.proposal;
  const client = q.data?.client;
  const activity = q.data?.activity ?? [];
  const versions = q.data?.versions ?? [];
  const signature = q.data?.signature;

  if (q.isLoading) return <div className="p-10 text-sm text-foreground/60">Loading…</div>;
  if (!proposal) return <div className="p-10 text-sm text-foreground/60">Proposal not found.</div>;

  const editable = ["draft", "internal_review", "approved", "ready_to_send"].includes(proposal.status) && !proposal.locked_at;
  const lifecycle = deriveLifecycle({
    proposalStatus: proposal.status,
    recurringFeeCents: Number(proposal.recurring_fee_cents ?? 0),
  });

  const primaryAction = (() => {
    if (proposal.status === "draft") {
      return (
        <Button size="sm" onClick={() => submitFn({ data: { proposalId: id } }).then(() => { toast.success("Submitted for review"); invalidate(); }).catch((e) => toast.error(e.message))}>
          Submit for review <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      );
    }
    if (proposal.status === "internal_review") {
      return (
        <Button size="sm" onClick={() => approveFn({ data: { proposalId: id } }).then(() => { toast.success("Approved"); invalidate(); }).catch((e) => toast.error(e.message))}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
        </Button>
      );
    }
    if (proposal.status === "approved" || proposal.status === "ready_to_send") {
      return (
        <Button size="sm" onClick={() => doSend.mutate()} disabled={doSend.isPending}>
          <Send className="mr-2 h-4 w-4" /> Send to client
        </Button>
      );
    }
    if (proposal.status === "sent" || proposal.status === "viewed") {
      return (
        <Button size="sm" onClick={() => (publicLink ? (copyLink(publicLink), toast.success("Client link copied.")) : doReissue.mutate())} disabled={doReissue.isPending}>
          <Copy className="mr-2 h-4 w-4" /> {publicLink ? "Copy client link" : "Issue new client link"}
        </Button>
      );
    }
    if (proposal.status === "accepted") {
      return (
        <Button size="sm" onClick={() => nav({ to: "/labs/billing" })}>
          Go to billing <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      );
    }
    return null;
  })();

  return (
    <div className="min-h-screen">
      <header className="border-b border-foreground/15 px-4 py-5 md:px-10">
        <div className="mx-auto max-w-6xl">
          <Link to="/labs/proposals" className="inline-flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> All proposals
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/60">{proposal.proposal_number}</div>
              <h1 className="mt-1 font-display text-[28px] leading-tight md:text-[36px]">{proposal.title}</h1>
              <p className="mt-1 text-sm text-foreground/70">{client?.name} · v{proposal.version} · <Badge variant="outline">{proposal.status.replace(/_/g, " ")}</Badge></p>
            </div>
            <div className="flex flex-wrap gap-2">
              {primaryAction}
              {proposal.status === "internal_review" && (
                <ReturnButton id={id} returnFn={returnFn} onDone={invalidate} />
              )}
              {publicLink && (
                <a href={publicLink} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline"><Eye className="mr-2 h-4 w-4" /> Preview client view</Button>
                </a>
              )}
              {publicLink && (
                <a href={`/api/public/proposals/pdf?token=${encodeURIComponent(publicLink.split("/proposal/")[1] ?? "")}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline"><Download className="mr-2 h-4 w-4" /> PDF</Button>
                </a>
              )}
              {["sent", "viewed", "approved", "ready_to_send", "declined"].includes(proposal.status) && (
                <Button size="sm" variant="ghost" onClick={() => {
                  if (!confirm("Supersede this proposal? Public access will be revoked.")) return;
                  supersedeFn({ data: { proposalId: id } }).then(() => { toast.success("Superseded"); invalidate(); }).catch((e) => toast.error(e.message));
                }}><Archive className="mr-2 h-4 w-4" /> Supersede</Button>
              )}
            </div>
          </div>
          <LifecycleRail state={lifecycle} className="mt-4" />
          <NextStepBanner state={lifecycle} className="mt-3" />
          {publicLink && (
            <div className="mt-3 rounded border border-primary/30 bg-primary/5 p-3 text-xs">
              <div className="mb-1 font-medium">Secure client link (copied):</div>
              <div className="break-all text-foreground/70">{publicLink}</div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-10">
        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="activity">Activity ({activity.length})</TabsTrigger>
            <TabsTrigger value="versions">Versions ({versions.length})</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            {signature && <TabsTrigger value="acceptance">Acceptance</TabsTrigger>}
          </TabsList>

          <TabsContent value="content" className="mt-6 space-y-6">
            <EditableSections proposal={proposal} editable={editable} updateFn={updateFn} onSaved={invalidate} />
            <InvestmentBlock proposal={proposal} editable={editable} updateFn={updateFn} onSaved={invalidate} />
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <ol className="divide-y divide-foreground/10 rounded border border-foreground/10">
              {activity.map((a) => (
                <li key={a.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.action.replace(/_/g, " ")}</span>
                    <span className="text-xs text-foreground/60">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  {a.notes && <div className="mt-1 text-xs text-foreground/70">{a.notes}</div>}
                </li>
              ))}
              {activity.length === 0 && <li className="p-6 text-center text-sm text-foreground/60">No activity yet.</li>}
            </ol>
          </TabsContent>

          <TabsContent value="versions" className="mt-6">
            <ol className="divide-y divide-foreground/10 rounded border border-foreground/10">
              {versions.map((v) => (
                <li key={v.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">v{v.version}</span>
                    <span className="text-xs text-foreground/60">{new Date(v.created_at).toLocaleString()}</span>
                  </div>
                  {v.change_summary && <div className="mt-1 text-xs text-foreground/70">{v.change_summary}</div>}
                </li>
              ))}
              {versions.length === 0 && <li className="p-6 text-center text-sm text-foreground/60">No versions yet.</li>}
            </ol>
          </TabsContent>

          <TabsContent value="comments" className="mt-6 space-y-3">
            <CommentForm id={id} addFn={addCommentFn} onDone={() => qc.invalidateQueries({ queryKey: ["nsl-proposal-comments", id] })} />
            <ol className="divide-y divide-foreground/10 rounded border border-foreground/10">
              {(commentsQ.data ?? []).map((c) => (
                <li key={c.id} className="p-3 text-sm">
                  <div className="mb-1 text-xs text-foreground/60">{new Date(c.created_at).toLocaleString()}</div>
                  <div className="whitespace-pre-wrap">{c.comment}</div>
                </li>
              ))}
              {commentsQ.data && commentsQ.data.length === 0 && <li className="p-6 text-center text-sm text-foreground/60">No comments yet.</li>}
            </ol>
          </TabsContent>

          {signature && (
            <TabsContent value="acceptance" className="mt-6">
              <div className="rounded border border-foreground/10 p-4 text-sm">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground/60">Electronic Acceptance Evidence</div>
                <dl className="grid grid-cols-2 gap-3">
                  <Field label="Signer">{signature.signer_name}</Field>
                  <Field label="Email">{signature.signer_email}</Field>
                  <Field label="Signed at">{new Date(signature.signed_at).toLocaleString()}</Field>
                  <Field label="Version at signing">v{signature.proposal_version}</Field>
                  <Field label="IP">{signature.ip_address ?? "—"}</Field>
                  <Field label="User agent">{signature.user_agent ?? "—"}</Field>
                </dl>
                <div className="mt-3 rounded bg-muted/50 p-3 text-xs">{signature.acknowledgement}</div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-medium uppercase tracking-wider text-foreground/60">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function EditableSections({ proposal, editable, updateFn, onSaved }: {
  proposal: any; editable: boolean; updateFn: (i: any) => Promise<any>; onSaved: () => void;
}) {
  const [local, setLocal] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = { title: proposal.title };
    for (const s of SECTIONS) o[s.key] = (proposal as any)[s.key] ?? "";
    return o;
  });
  useEffect(() => {
    const o: Record<string, string> = { title: proposal.title };
    for (const s of SECTIONS) o[s.key] = (proposal as any)[s.key] ?? "";
    setLocal(o);
  }, [proposal.id, proposal.version]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, string> = {};
      if (local.title !== proposal.title) patch.title = local.title;
      for (const s of SECTIONS) if (local[s.key] !== ((proposal as any)[s.key] ?? "")) patch[s.key] = local[s.key];
      if (Object.keys(patch).length === 0) return { ok: true, versioned: false };
      return updateFn({ data: { proposalId: proposal.id, patch } });
    },
    onSuccess: (res) => { toast.success(res.versioned ? "Saved. New version created." : "Saved."); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/60">Title</label>
        <Input value={local.title} disabled={!editable} onChange={(e) => setLocal({ ...local, title: e.target.value })} />
      </div>
      {SECTIONS.map((s) => (
        <div key={s.key}>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/60">{s.label}</label>
          <Textarea rows={s.key === "terms" ? 8 : 5} value={local[s.key] ?? ""} disabled={!editable} onChange={(e) => setLocal({ ...local, [s.key]: e.target.value })} />
        </div>
      ))}
      {editable && (
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save draft</Button>
        </div>
      )}
    </div>
  );
}

function InvestmentBlock({ proposal, editable, updateFn, onSaved }: { proposal: any; editable: boolean; updateFn: any; onSaved: () => void }) {
  const [t, setT] = useState<number>(Number(proposal.total_value_cents ?? 0) / 100);
  const [s, setS] = useState<number>(Number(proposal.setup_fee_cents ?? 0) / 100);
  const [r, setR] = useState<number>(Number(proposal.recurring_fee_cents ?? 0) / 100);
  const save = useMutation({
    mutationFn: () => updateFn({ data: { proposalId: proposal.id, patch: {
      total_value_cents: Math.round(t * 100),
      setup_fee_cents: Math.round(s * 100),
      recurring_fee_cents: Math.round(r * 100),
    } } }),
    onSuccess: () => { toast.success("Investment updated"); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });
  return (
    <div className="rounded border border-foreground/10 p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-foreground/60">Investment</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Money label="Total value (USD)" value={t} onChange={setT} disabled={!editable} />
        <Money label="Setup fee (USD)" value={s} onChange={setS} disabled={!editable} />
        <Money label="Recurring monthly (USD)" value={r} onChange={setR} disabled={!editable} />
      </div>
      {editable && <div className="mt-3 flex justify-end"><Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>Save investment</Button></div>}
    </div>
  );
}

function Money({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-foreground/60">{label}</label>
      <Input type="number" min={0} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

function ReturnButton({ id, returnFn, onDone }: { id: string; returnFn: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><RotateCcw className="mr-2 h-4 w-4" /> Return to draft</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Return proposal to draft</DialogTitle></DialogHeader>
        <Textarea rows={4} placeholder="Reason for returning" value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => returnFn({ data: { proposalId: id, reason } }).then(() => { toast.success("Returned to draft"); setOpen(false); onDone(); }).catch((e: Error) => toast.error(e.message))} disabled={reason.trim().length < 3}>Return</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyLinkButton({ onCopy }: { onCopy: () => void }) {
  return <Button size="sm" variant="outline" onClick={onCopy}><Copy className="mr-2 h-4 w-4" /> Copy public link</Button>;
}

function CommentForm({ id, addFn, onDone }: { id: string; addFn: any; onDone: () => void }) {
  const [txt, setTxt] = useState("");
  return (
    <div className="rounded border border-foreground/10 p-3">
      <Textarea rows={3} placeholder="Internal comment (never shown to the client)" value={txt} onChange={(e) => setTxt(e.target.value)} />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={() => addFn({ data: { proposalId: id, comment: txt } }).then(() => { setTxt(""); onDone(); }).catch((e: Error) => toast.error(e.message))} disabled={txt.trim().length === 0}>
          <MessageSquare className="mr-2 h-4 w-4" /> Post comment
        </Button>
      </div>
    </div>
  );
}