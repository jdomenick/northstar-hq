import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, ArrowUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operator")({
  component: OperatorPage,
  head: () => ({
    meta: [
      { title: "SAM — Northstar" },
      { name: "description", content: "SAM, the intelligence at the center of Northstar." },
    ],
  }),
});

const suggestions = [
  "What deserves my attention today?",
  "Which projects are currently at risk?",
  "What decisions are waiting on me?",
  "Where am I falling behind on commitments?",
  "Summarize activity across my ventures.",
  "What should I prioritize this week?",
];

function OperatorPage() {
  const [input, setInput] = useState("");

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32 pt-20 md:pt-28">
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
          <Sparkles className="h-3 w-3" strokeWidth={2} />
          SAM
        </div>
        <h1 className="mt-6 font-display text-[40px] leading-[1.05] text-foreground md:text-[52px]">
          What do you want to understand?
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-[1.7] text-muted-foreground">
          SAM sees every venture, project, decision, document, and conversation you've
          connected. Ask in plain English.
        </p>

        <div className="mt-16 rounded-xl border border-dashed border-border/70 bg-card/30 p-6">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70">
            SAM is not active yet
          </div>
          <p className="mt-3 text-[15px] leading-[1.7] text-muted-foreground">
            SAM intelligence will be activated in Phase 3. When enabled, SAM will read
            across your ventures, projects, decisions, commitments, and documents to
            surface honest, sourced briefings — not generated filler.
          </p>
        </div>

        <div className="mt-20">
          <div className="mb-4 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground/70">
            Suggested
          </div>
          <ul className="space-y-1 -mx-3">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  onClick={() => setInput(s)}
                  className="group flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left text-[14px] text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                >
                  <span>{s}</span>
                  <ArrowUp className="h-3.5 w-3.5 rotate-45 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-6 pt-10">
        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl bg-card/70 p-2 shadow-[0_1px_0_0_oklch(1_0_0/6%)_inset,0_20px_40px_-20px_oklch(0_0_0/60%)] backdrop-blur">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            placeholder="Ask SAM anything…"
            aria-label="Ask SAM"
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[14.5px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <button
            aria-label="Send message"
            title="SAM is not active yet"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background hover:opacity-90 disabled:opacity-30"
            disabled
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}