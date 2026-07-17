import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageBody, PageHeader } from "@/components/page-header";
import { projects, ventures } from "@/lib/northstar-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
  head: () => ({
    meta: [
      { title: "Projects — Northstar" },
      { name: "description", content: "Every project across every venture, in one executive view." },
    ],
  }),
});

const STATUSES = ["All", "On track", "At risk", "Blocked", "Shipped"] as const;

function ProjectsPage() {
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("All");
  const [venture, setVenture] = useState<string>("All");

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) => (filter === "All" || p.status === filter) && (venture === "All" || p.venture === venture),
      ),
    [filter, venture],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description="Executive-level clarity. Every project, its owner, its next step, and its risk — nothing more."
      />
      <PageBody>
        <div className="mb-8 flex flex-wrap items-center gap-4 -mx-2">
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px]",
                  filter === s
                    ? "bg-secondary/70 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 pr-2">
            <label className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
              Venture
            </label>
            <select
              value={venture}
              onChange={(e) => setVenture(e.target.value)}
              className="rounded-md bg-secondary/40 px-2.5 py-1.5 text-[12.5px] text-foreground outline-none hover:bg-secondary/60"
            >
              <option value="All">All</option>
              {ventures.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-16 rounded-2xl px-6 py-20 text-center">
            <div className="mx-auto max-w-sm">
              <div className="mx-auto h-10 w-10 rounded-full bg-secondary/50" />
              <h3 className="mt-6 font-display text-2xl text-foreground">Nothing here yet</h3>
              <p className="mt-2 text-[13.5px] text-muted-foreground">
                No projects match these filters. Try widening the venture or status filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                <tr className="border-b border-border">
                  <th className="px-2 py-3 font-medium">Project</th>
                  <th className="hidden px-2 py-3 font-medium md:table-cell">Venture</th>
                  <th className="hidden px-2 py-3 font-medium lg:table-cell">Owner</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="hidden px-2 py-3 font-medium sm:table-cell">Progress</th>
                  <th className="hidden px-2 py-3 text-right font-medium md:table-cell">Due</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className={cn(
                      "group text-[13.5px] hover:bg-secondary/30",
                      i !== filtered.length - 1 && "border-b border-border/60",
                    )}
                  >
                    <td className="px-2 py-5">
                      <div className="text-foreground">{p.name}</div>
                      <div className="mt-1 text-[12px] text-muted-foreground">{p.nextStep}</div>
                    </td>
                    <td className="hidden px-2 py-5 text-muted-foreground md:table-cell">{p.venture}</td>
                    <td className="hidden px-2 py-5 text-muted-foreground lg:table-cell">{p.owner}</td>
                    <td className="px-2 py-5">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="hidden px-2 py-5 sm:table-cell">
                      <div className="flex items-center gap-3">
                        <div className="h-[3px] w-24 overflow-hidden rounded-full bg-secondary/70">
                          <div
                            className="h-full bg-foreground/70 transition-[width] duration-500"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-[11.5px] tabular-nums text-muted-foreground">
                          {p.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-2 py-5 text-right tabular-nums text-muted-foreground md:table-cell">
                      {p.due}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    "On track": "text-[oklch(0.72_0.14_155)]",
    "At risk": "text-[oklch(0.78_0.14_75)]",
    Blocked: "text-[oklch(0.62_0.19_25)]",
    Shipped: "text-muted-foreground",
  };
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px]">
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", map[status])} />
      <span className="text-foreground">{status}</span>
    </span>
  );
}