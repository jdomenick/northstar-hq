import { createFileRoute } from "@tanstack/react-router";
import { FileText, BookOpen, Notebook, Layers } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/knowledge")({
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
              <button
                key={c.name}
                className="group rounded-xl bg-card/40 p-6 text-left hover:bg-card/70 hover:-translate-y-0.5"
              >
                <c.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                <div className="mt-6 font-display text-[32px] leading-none tabular-nums text-foreground">
                  {c.count}
                </div>
                <div className="mt-3 text-[13.5px] text-foreground">{c.name}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {c.hint}
                </div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Recent">
          <ul>
            {recent.map((r, i) => (
              <li
                key={i}
                className="group flex items-center gap-5 border-b border-border/60 py-4 text-[13.5px] hover:bg-secondary/30 last:border-0 -mx-2 px-2 rounded-md"
              >
                <FileText
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                  strokeWidth={2}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{r.title}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{r.venture}</div>
                </div>
                <div className="text-[12px] tabular-nums text-muted-foreground">{r.when}</div>
              </li>
            ))}
          </ul>
        </Section>
      </PageBody>
    </div>
  );
}