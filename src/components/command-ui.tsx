// Shared presentation primitives for the Command Center and the unified
// Client Workspace. These render truthful states only: real values, an
// explicit unavailable/not-connected panel, or an empty state.

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { Source } from "@/lib/command/hooks";

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "muted";
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/50 p-4">
      <div className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-display text-[22px] leading-none",
          tone === "warn" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-2 text-[11.5px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function NotAvailable({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4">
      <div className="text-[9.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        Not connected
      </div>
      <p className="mt-2 text-[12.5px] leading-[1.6] text-muted-foreground">{reason}</p>
    </div>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] italic text-muted-foreground">{children}</p>;
}

/**
 * Renders children only when the source actually produced data. Otherwise it
 * states the truthful reason. Never substitutes placeholder numbers.
 */
export function SourceView<T>({
  source,
  empty,
  children,
}: {
  source: Source<T>;
  empty?: string;
  children: (data: T) => ReactNode;
}) {
  if (source.status !== "ok" || source.data === null) {
    return <NotAvailable reason={source.reason ?? "This source is not connected."} />;
  }
  if (Array.isArray(source.data) && source.data.length === 0) {
    return <EmptyLine>{empty ?? "No records yet."}</EmptyLine>;
  }
  return <>{children(source.data)}</>;
}

export function DrillLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {children}
    </Link>
  );
}

export function ListRow({
  title,
  meta,
  right,
  to,
}: {
  title: string;
  meta?: string;
  right?: ReactNode;
  to?: string;
}) {
  const body = (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] text-foreground">{title}</div>
        {meta ? <div className="mt-0.5 text-[11.5px] text-muted-foreground">{meta}</div> : null}
      </div>
      {right ? <div className="shrink-0 text-[11.5px] text-muted-foreground">{right}</div> : null}
    </div>
  );
  if (!to) return <li className="border-b border-border/50 last:border-0">{body}</li>;
  return (
    <li className="border-b border-border/50 last:border-0">
      <Link to={to} className="block hover:bg-muted/30">
        {body}
      </Link>
    </li>
  );
}

export function RowList({ children }: { children: ReactNode }) {
  return <ul className="rounded-lg border border-border/60 px-4">{children}</ul>;
}
