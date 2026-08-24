// Dense dashboard primitives for the Command Center.
// These are presentation-only and fully data driven so CAM, CCM, CRM,
// Operations and SAM Core can bind real sources later without UI changes.

import { useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
  id,
  collapsible = true,
  defaultOpen = true,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  id?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const canCollapse = collapsible && Boolean(title);
  const isOpen = canCollapse ? open : true;

  return (
    <section
      id={id}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[7px] border border-border/70 bg-card/60",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {canCollapse && (
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
                onClick={() => setOpen((v) => !v)}
                className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", !isOpen && "-rotate-90")}
                  strokeWidth={2}
                />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-[11.5px] font-medium tracking-[0.02em] text-foreground">
                  {title}
                </h2>
              </div>
              {subtitle && (
                <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {isOpen && (
        <div className={cn("min-w-0 flex-1 p-3", bodyClassName)}>{children}</div>
      )}
    </section>
  );
}



export function Delta({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums",
        up ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.2} />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function Sparkline({
  data,
  tone = "primary",
  className,
}: {
  data: number[];
  tone?: "primary" | "success" | "destructive";
  className?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const w = 100;
  const h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const stroke =
    tone === "success"
      ? "var(--color-success)"
      : tone === "destructive"
        ? "var(--color-destructive)"
        : "var(--color-primary)";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-7 w-full", className)}
    >
      <polyline
        points={`0,${h} ${pts.join(" ")} ${w},${h}`}
        fill={stroke}
        opacity={0.1}
        stroke="none"
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  series,
  tone = "default",
  hint,
  onSelect,
}: {
  label: string;
  value: string;
  delta?: number;
  series?: number[];
  tone?: "default" | "alert";
  hint?: string;
  onSelect?: () => void;
}) {
  const interactive = typeof onSelect === "function";
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      {...(interactive
        ? { type: "button" as const, onClick: onSelect, "aria-label": `${label} details` }
        : {})}
      className={cn(
        "flex min-w-0 flex-col justify-between overflow-hidden rounded-[7px] border border-border/70 bg-card/60 px-3 py-2.5 text-left",
        interactive &&
          "cursor-pointer transition-colors hover:border-primary/50 hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
      )}
    >
      <div className="flex w-full items-start justify-between gap-1.5">
        <div className="min-w-0 text-[9.5px] font-medium uppercase leading-[1.25] tracking-[0.1em] text-muted-foreground break-words">
          {label}
        </div>
      </div>

      <div className="mt-1.5 flex w-full flex-wrap items-end justify-between gap-x-2 gap-y-0.5">
        <div
          className={cn(
            "min-w-0 truncate font-display text-[17px] leading-none tabular-nums",
            tone === "alert" ? "text-destructive" : "text-foreground",
          )}
        >
          {value}
        </div>
        {typeof delta === "number" && <Delta value={delta} />}
      </div>
      {series ? (
        <div className="mt-1.5 w-full">
          <Sparkline data={series} tone={tone === "alert" ? "destructive" : "primary"} />
        </div>
      ) : hint ? (
        <div className="mt-1.5 w-full truncate text-[10px] text-muted-foreground">{hint}</div>
      ) : null}
    </Tag>
  );
}


export function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn" | "alert";
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-medium uppercase leading-[1.25] tracking-[0.08em] text-muted-foreground break-words">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 truncate font-display text-[15px] leading-none tabular-nums",
          tone === "ok" && "text-success",
          tone === "warn" && "text-warning",
          tone === "alert" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function StatusDot({ tone }: { tone: "ok" | "warn" | "alert" | "muted" }) {
  return (
    <span
      className={cn(
        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
        tone === "ok" && "bg-success",
        tone === "warn" && "bg-warning",
        tone === "alert" && "bg-destructive",
        tone === "muted" && "bg-muted-foreground/50",
      )}
    />
  );
}
