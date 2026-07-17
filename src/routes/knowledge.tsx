import { createFileRoute } from "@tanstack/react-router";
import { FileText, BookOpen, Notebook, Layers } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";

export const Route = createFileRoute("/knowledge")({
  component: KnowledgePage,
  head: () => ({
    meta: [
      { title: "Knowledge — Northstar" },
      { name: "description", content: "Playbooks, notes, and documents across every venture." },
    ],
  }),
});

const collections = [
  { icon: BookOpen, name: "Playbooks", count: 24, hint: "Operating rhythms, hiring loops, GTM plays." },
  { icon: Notebook, name: "Meeting notes", count: 187, hint: "Auto-captured, summarized, searchable." },
  { icon: FileText, name: "Documents", count: 96, hint: "Contracts, memos, strategy drafts." },
  { icon: Layers, name: "Frameworks", count: 12, hint: "Decision templates and mental models." },
];

const recent = [
  { title: "Q1 Operating Cadence — Healing Path", venture: "Healing Path", when: "2h ago" },
  { title: "MSA red-line notes — Mercy Health", venture: "Healing Path", when: "Yesterday" },
  { title: "Board deck v3", venture: "Light In The Tunnel", when: "3d ago" },
  { title: "Dispatch vendor evaluation matrix", venture: "Elite Fleet Rides", when: "5d ago" },
  { title: "Essay draft — The Founder as Operator", venture: "Personal Brand", when: "1w ago" },
];

function KnowledgePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Knowledge"
        title="Everything you've written, decided, or learned."
        description="Operator indexes it all. Ask a question in plain English and the answer arrives with citations."
      />
      <PageBody>
        <Section title="Collections">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {collections.map((c) => (
              <div
                key={c.name}
                className="rounded-lg border border-border bg-card/40 p-5 transition-colors hover:bg-card"
              >
                <c.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                <div className="mt-4 font-display text-2xl text-foreground">{c.count}</div>
                <div className="mt-1 text-[13px] text-foreground">{c.name}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">{c.hint}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Recent">
          <ul className="divide-y divide-border rounded-lg border border-border">
            {recent.map((r, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4 text-[13px]">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{r.title}</div>
                  <div className="text-[12px] text-muted-foreground">{r.venture}</div>
                </div>
                <div className="text-[12px] text-muted-foreground">{r.when}</div>
              </li>
            ))}
          </ul>
        </Section>
      </PageBody>
    </div>
  );
}