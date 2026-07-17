import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageBody, PageHeader } from "@/components/page-header";
import { projects, ventures } from "@/lib/northstar-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects")({
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
        <div className="mb-6 flex flex-wrap items-center gap-4 border-b border-border pb-4">
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] transition-colors",
                  filter === s
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Venture
            </label>
            <select
              value={venture}
              onChange={(e) => setVenture(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-ring"
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

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Venture</th>
                <th className="hidden px-5 py-3 font-medium lg:table-cell">Owner</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">Progress</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="text-[13px] transition-colors hover:bg-secondary/30">
                  <td className="px-5 py-4">
                    <div className="text-foreground">{p.name}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{p.nextStep}</div>
                  </td>
                  <td className="hidden px-5 py-4 text-muted-foreground md:table-cell">{p.venture}</td>
                  <td className="hidden px-5 py-4 text-muted-foreground lg:table-cell">{p.owner}</td>
                  <td className="px-5 py-4">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="hidden px-5 py-4 sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-foreground/80"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="hidden px-5 py-4 text-muted-foreground md:table-cell">{p.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    <span className="inline-flex items-center gap-2 text-[12px]">
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", map[status])} />
      <span className="text-foreground">{status}</span>
    </span>
  );
}