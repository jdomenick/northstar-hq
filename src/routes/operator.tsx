import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ArrowUp } from "lucide-react";

export const Route = createFileRoute("/operator")({
  component: OperatorPage,
  head: () => ({
    meta: [
      { title: "Operator — Northstar" },
      { name: "description", content: "The intelligence at the center of Northstar." },
    ],
  }),
});

const suggestions = [
  "Summarize what changed across my ventures this week.",
  "Which decisions am I avoiding?",
  "Where is Healing Path bottlenecked?",
  "Draft a response to the Mercy Health legal team.",
];

const briefing = [
  { title: "Cross-venture pattern", body: "Both Healing Path and Elite Fleet Rides are one enterprise contract away from step-changing revenue. Neither is legally ready. Consider prioritizing a single fractional GC across ventures." },
  { title: "You are the bottleneck on 3 items", body: "The Mercy MSA, the dispatch vendor choice, and the board chair acceptance have all been open more than 48 hours." },
  { title: "Quiet win", body: "Personal Brand newsletter grew 412 net subscribers this week — the highest since launch." },
];

function OperatorPage() {
  const [input, setInput] = useState("");

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 md:py-24">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <Sparkles className="h-3 w-3" strokeWidth={2} />
          Operator
        </div>
        <h1 className="mt-4 font-display text-4xl leading-tight text-foreground md:text-5xl">
          What do you want to understand?
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          Operator sees every venture, project, decision, document, and conversation you've
          connected. Ask in plain English.
        </p>

        <div className="mt-10 space-y-4">
          {briefing.map((b) => (
            <div key={b.title} className="rounded-lg border border-border bg-card/40 p-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {b.title}
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-foreground/90">{b.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Try</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background/90 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-border bg-card/60 p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            placeholder="Ask Operator anything…"
            className="flex-1 resize-none bg-transparent px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            disabled={!input.trim()}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}