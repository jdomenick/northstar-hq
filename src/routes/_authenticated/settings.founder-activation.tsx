import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageBody, PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/lib/org-context";
import {
  proposeFounderActivation,
  importFounderActivation,
  runFounderActivationReview,
  createInitialExecutiveBrief,
} from "@/lib/founder-activation/activation.functions";

export const Route = createFileRoute("/_authenticated/settings/founder-activation")({
  component: FounderActivationPage,
  head: () => ({
    meta: [
      { title: "Founder Activation - NorthStar Labs" },
      { name: "description", content: "Seed NorthStar Labs with real ventures, projects, goals, decisions, and commitments." },
    ],
  }),
});

type Priority = "low" | "normal" | "high" | "critical";
type Action = "create" | "skip" | "merge";

type RowState = {
  action: Action;
  mergeTargetId?: string;
  name?: string;
  title?: string;
  description?: string;
  objective?: string;
  definitionOfSuccess?: string;
  decision?: string;
  rationale?: string;
  priority?: Priority;
  status?: string;
  blocker?: string;
  dueDate?: string;
};

function useRowStates<T extends { key: string; existingMatches: Array<{ id: string; name: string }> }>(items: T[] | undefined) {
  const [state, setState] = useState<Record<string, RowState>>({});
  const rows = useMemo(() => {
    if (!items) return [];
    return items.map((it) => {
      const s = state[it.key] ?? { action: (it.existingMatches[0] ? "merge" : "create") as Action, mergeTargetId: it.existingMatches[0]?.id };
      return { item: it, state: s };
    });
  }, [items, state]);
  const update = (key: string, patch: Partial<RowState>) => setState((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { action: "create" as Action }), ...patch } }));
  return { rows, update, raw: state };
}

function ActionPicker({ hasMatch, value, matchId, onChange }: { hasMatch: boolean; value: Action; matchId?: string; onChange: (a: Action, mergeTargetId?: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Action, hasMatch ? matchId : undefined)}>
      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="create">Create separately</SelectItem>
        {hasMatch ? <SelectItem value="merge">Merge into existing</SelectItem> : null}
        <SelectItem value="skip">Skip</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="critical">Critical</SelectItem>
        <SelectItem value="high">High</SelectItem>
        <SelectItem value="normal">Normal</SelectItem>
        <SelectItem value="low">Low</SelectItem>
      </SelectContent>
    </Select>
  );
}

function MatchBadge({ matches }: { matches: Array<{ id: string; name: string }> }) {
  if (!matches.length) return <Badge variant="outline">No duplicate found</Badge>;
  return <Badge variant="secondary">Possible duplicate: {matches[0].name}</Badge>;
}

function FounderActivationPage() {
  const { activeOrgId } = useOrg();
  const propose = useServerFn(proposeFounderActivation);
  const importFn = useServerFn(importFounderActivation);
  const review = useServerFn(runFounderActivationReview);
  const brief = useServerFn(createInitialExecutiveBrief);

  const proposalQ = useQuery({
    enabled: !!activeOrgId,
    queryKey: ["founder-activation-proposal", activeOrgId],
    queryFn: () => propose({ data: { organizationId: activeOrgId! } }),
  });

  const ventures = useRowStates(proposalQ.data?.ventures);
  const projects = useRowStates(proposalQ.data?.projects);
  const goals = useRowStates(proposalQ.data?.goals);
  const decisions = useRowStates(proposalQ.data?.decisions);
  const commitments = useRowStates(proposalQ.data?.commitments);

  const [result, setResult] = useState<null | {
    outcomes: Array<{ key: string; kind: string; result: string; id?: string; duplicateOf?: string; error?: string }>;
    reviewPayload?: any;
    briefId?: string | null;
  }>(null);

  const importMut = useMutation({
    mutationFn: async () => {
      if (!activeOrgId) throw new Error("No active organization");
      const buildList = (items: any[] | undefined, states: Record<string, RowState>) =>
        (items ?? []).map((it) => {
          const s = states[it.key];
          const action: Action = s?.action ?? (it.existingMatches[0] ? "merge" : "create");
          return {
            ...s,
            key: it.key,
            action,
            mergeTargetId: action === "merge" ? (s?.mergeTargetId ?? it.existingMatches[0]?.id) : undefined,
          };
        });
      const importRes = await importFn({
        data: {
          organizationId: activeOrgId,
          ventures: buildList(proposalQ.data?.ventures, ventures.raw),
          projects: buildList(proposalQ.data?.projects, projects.raw),
          goals: buildList(proposalQ.data?.goals, goals.raw),
          decisions: buildList(proposalQ.data?.decisions, decisions.raw),
          commitments: buildList(proposalQ.data?.commitments, commitments.raw),
        },
      });
      const reviewRes = await review({ data: { organizationId: activeOrgId } });
      const briefRes = await brief({ data: { organizationId: activeOrgId, reviewPayload: reviewRes as any } });
      return { outcomes: importRes.outcomes, reviewPayload: reviewRes, briefId: briefRes.briefId };
    },
    onSuccess: (r) => setResult(r),
  });

  if (!activeOrgId) {
    return (
      <div>
        <PageHeader title="Founder Activation" description="Seed NorthStar Labs with real operating data." />
        <PageBody><p>Select an organization first.</p></PageBody>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Founder Activation"
        description="Review, edit, and import the real ventures, projects, goals, decisions, and commitments that give SAM context."
        actions={<Link to="/settings" className="rounded-md border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground">Back to settings</Link>}
      />
      <PageBody>
        <FounderActivationStatus organizationId={activeOrgId} />
        {proposalQ.isLoading ? <p className="text-[13.5px] text-muted-foreground">Loading proposals...</p> : null}
        {proposalQ.error ? <p className="text-destructive">Failed to load proposals: {(proposalQ.error as Error).message}</p> : null}
        {proposalQ.data ? (
          <Tabs defaultValue="ventures">
            <TabsList>
              <TabsTrigger value="ventures">Ventures ({ventures.rows.length})</TabsTrigger>
              <TabsTrigger value="projects">Projects ({projects.rows.length})</TabsTrigger>
              <TabsTrigger value="goals">Goals ({goals.rows.length})</TabsTrigger>
              <TabsTrigger value="decisions">Decisions ({decisions.rows.length})</TabsTrigger>
              <TabsTrigger value="commitments">Commitments ({commitments.rows.length})</TabsTrigger>
              <TabsTrigger value="review">Review & Import</TabsTrigger>
            </TabsList>

            <TabsContent value="ventures">
              <Section title="Ventures">
                {ventures.rows.map(({ item, state }) => (
                  <div key={item.key} className="grid gap-2 rounded-md border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Input defaultValue={item.name} onBlur={(e) => ventures.update(item.key, { name: e.target.value })} className="max-w-md font-medium" />
                      <MatchBadge matches={item.existingMatches} />
                      <ActionPicker hasMatch={!!item.existingMatches.length} value={state.action} matchId={item.existingMatches[0]?.id} onChange={(a, m) => ventures.update(item.key, { action: a, mergeTargetId: m })} />
                      <PriorityPicker value={(state.priority ?? item.priority) as Priority} onChange={(p) => ventures.update(item.key, { priority: p })} />
                    </div>
                    <Textarea defaultValue={item.description + "\n\nStrategic direction: " + item.strategicDirection} onBlur={(e) => ventures.update(item.key, { description: e.target.value })} rows={4} />
                  </div>
                ))}
              </Section>
            </TabsContent>

            <TabsContent value="projects">
              <Section title="Projects">
                {projects.rows.map(({ item, state }) => (
                  <div key={item.key} className="grid gap-2 rounded-md border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Input defaultValue={item.name} onBlur={(e) => projects.update(item.key, { name: e.target.value })} className="max-w-md font-medium" />
                      <MatchBadge matches={item.existingMatches} />
                      <ActionPicker hasMatch={!!item.existingMatches.length} value={state.action} matchId={item.existingMatches[0]?.id} onChange={(a, m) => projects.update(item.key, { action: a, mergeTargetId: m })} />
                      <PriorityPicker value={(state.priority ?? item.priority) as Priority} onChange={(p) => projects.update(item.key, { priority: p })} />
                      <Badge variant="outline">Status: {state.status ?? item.status}</Badge>
                      <Input type="date" defaultValue={state.dueDate ?? ""} onChange={(e) => projects.update(item.key, { dueDate: e.target.value })} className="h-8 w-40" />
                    </div>
                    <Textarea defaultValue={item.objective} onBlur={(e) => projects.update(item.key, { objective: e.target.value })} rows={3} />
                    {item.blocker ? <Input defaultValue={item.blocker} onBlur={(e) => projects.update(item.key, { blocker: e.target.value })} placeholder="Blocker" /> : null}
                  </div>
                ))}
              </Section>
            </TabsContent>

            <TabsContent value="goals">
              <Section title="Goals">
                {goals.rows.map(({ item, state }) => (
                  <div key={item.key} className="grid gap-2 rounded-md border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Input defaultValue={item.title} onBlur={(e) => goals.update(item.key, { title: e.target.value })} className="max-w-md font-medium" />
                      <MatchBadge matches={item.existingMatches} />
                      <ActionPicker hasMatch={!!item.existingMatches.length} value={state.action} matchId={item.existingMatches[0]?.id} onChange={(a, m) => goals.update(item.key, { action: a, mergeTargetId: m })} />
                      <PriorityPicker value={(state.priority ?? item.priority) as Priority} onChange={(p) => goals.update(item.key, { priority: p })} />
                      <Input type="date" defaultValue={state.dueDate ?? ""} onChange={(e) => goals.update(item.key, { dueDate: e.target.value })} className="h-8 w-40" />
                    </div>
                    <Textarea defaultValue={item.definitionOfSuccess} onBlur={(e) => goals.update(item.key, { definitionOfSuccess: e.target.value })} rows={3} />
                  </div>
                ))}
              </Section>
            </TabsContent>

            <TabsContent value="decisions">
              <Section title="Decisions">
                {decisions.rows.map(({ item, state }) => (
                  <div key={item.key} className="grid gap-2 rounded-md border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Input defaultValue={item.title} onBlur={(e) => decisions.update(item.key, { title: e.target.value })} className="max-w-md font-medium" />
                      <MatchBadge matches={item.existingMatches} />
                      <ActionPicker hasMatch={!!item.existingMatches.length} value={state.action} matchId={item.existingMatches[0]?.id} onChange={(a, m) => decisions.update(item.key, { action: a, mergeTargetId: m })} />
                    </div>
                    <Textarea defaultValue={item.decision} onBlur={(e) => decisions.update(item.key, { decision: e.target.value })} rows={3} />
                    <Textarea defaultValue={item.rationale ?? ""} onBlur={(e) => decisions.update(item.key, { rationale: e.target.value })} rows={2} placeholder="Rationale (optional)" />
                  </div>
                ))}
              </Section>
            </TabsContent>

            <TabsContent value="commitments">
              <Section title="Commitments">
                {commitments.rows.map(({ item, state }) => (
                  <div key={item.key} className="grid gap-2 rounded-md border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Input defaultValue={item.title} onBlur={(e) => commitments.update(item.key, { title: e.target.value })} className="max-w-md font-medium" />
                      <MatchBadge matches={item.existingMatches} />
                      <ActionPicker hasMatch={!!item.existingMatches.length} value={state.action} matchId={item.existingMatches[0]?.id} onChange={(a, m) => commitments.update(item.key, { action: a, mergeTargetId: m })} />
                      <Badge variant="outline">Status: {state.status ?? item.status}</Badge>
                      <Input type="date" defaultValue={state.dueDate ?? ""} onChange={(e) => commitments.update(item.key, { dueDate: e.target.value })} className="h-8 w-40" />
                    </div>
                    {item.blocker ? <Input defaultValue={item.blocker} onBlur={(e) => commitments.update(item.key, { blocker: e.target.value })} placeholder="Blocker" /> : null}
                  </div>
                ))}
              </Section>
            </TabsContent>

            <TabsContent value="review">
              <Section title="Review and import">
                <p className="text-sm text-muted-foreground">Import will create, merge, or skip each record based on your choices, then run the SAM Executive Review and write your first Executive Brief.</p>
                <div className="flex gap-2">
                  <Button disabled={importMut.isPending} onClick={() => importMut.mutate()}>{importMut.isPending ? "Importing..." : "Import selected records"}</Button>
                </div>
                {importMut.error ? <p className="text-destructive">Import failed: {(importMut.error as Error).message}</p> : null}
                {result ? <CompletionReport result={result} /> : null}
              </Section>
            </TabsContent>
          </Tabs>
        ) : null}
      </PageBody>
    </div>
  );
}

function CompletionReport({ result }: { result: { outcomes: any[]; reviewPayload?: any; briefId?: string | null } }) {
  const counts = result.outcomes.reduce<Record<string, Record<string, number>>>((acc, o) => {
    acc[o.kind] = acc[o.kind] ?? {};
    acc[o.kind][o.result] = (acc[o.kind][o.result] ?? 0) + 1;
    return acc;
  }, {});
  const p = result.reviewPayload ?? {};
  return (
    <div className="grid gap-4 rounded-md border p-4">
      <h3 className="text-lg font-semibold">Completion report</h3>
      <div className="grid gap-2 text-sm">
        {Object.entries(counts).map(([kind, results]) => (
          <div key={kind}><strong className="capitalize">{kind}s:</strong> {Object.entries(results).map(([k, v]) => `${v} ${k}`).join(", ")}</div>
        ))}
      </div>
      <div>
        <h4 className="font-semibold">SAM Executive Review</h4>
        <p className="text-sm"><strong>Top priorities:</strong></p>
        <ul className="list-disc pl-6 text-sm">{(p.topPriorities ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
        <p className="text-sm mt-2"><strong>Top risks:</strong></p>
        <ul className="list-disc pl-6 text-sm">{(p.topRisks ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
        <p className="text-sm mt-2"><strong>Blocked work:</strong></p>
        <ul className="list-disc pl-6 text-sm">{(p.blockedWork ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
        <p className="text-sm mt-2"><strong>7-day plan:</strong></p>
        <ul className="list-disc pl-6 text-sm">{(p.sevenDayPlan ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
        <p className="text-sm mt-2"><strong>SAM-executable:</strong> {p.samExecutable}</p>
        <p className="text-sm"><strong>Approval-required:</strong> {p.approvalRequired}</p>
        <p className="text-sm mt-2"><strong>Missing information:</strong></p>
        <ul className="list-disc pl-6 text-sm">{(p.missingInformation ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
      </div>
      <div className="text-sm"><strong>Executive Brief:</strong> {result.briefId ? `Created (id ${result.briefId})` : "Not created"}</div>
      <div className="text-sm"><strong>Exact next action:</strong> {p.samExecutable ?? "Review the imported records on the Ventures, Projects, and Goals pages."}</div>
    </div>
  );
}
