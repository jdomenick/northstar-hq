// Truthful source-state chips for Command Center surfaces.
// A metric is only ever shown as live when its source actually returned it.

import { cn } from "@/lib/utils";
import type { ModuleSource, SourceStatus } from "@/lib/module-reporting/types";

const LABELS: Record<SourceStatus, string> = {
  ok: "Live",
  not_connected: "Not Connected",
  unavailable: "Unavailable",
};

export function StatusChip({
  status,
  className,
  title,
}: {
  status: SourceStatus;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "rounded-[3px] border px-1 py-px text-[8.5px] font-medium uppercase tracking-[0.16em]",
        status === "ok" && "border-success/50 text-success",
        status === "not_connected" && "border-border/70 text-muted-foreground",
        status === "unavailable" && "border-destructive/50 text-destructive",
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}

export function SourceNote({ source }: { source: ModuleSource<unknown> }) {
  if (source.status === "ok" || !source.reason) return null;
  return (
    <p className="mt-1.5 text-[9.5px] leading-snug text-muted-foreground">{source.reason}</p>
  );
}
