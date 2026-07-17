// Paper & Ink shared editorial primitives. Prefer composing pages from
// these over hand-rolling one-off layouts. Every primitive here uses
// design-system tokens (no hard-coded colors) and works on mobile.

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// A small-caps section label. Use for micro-headings inside a page.
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Heavy top rule with a small-caps label, mirroring the newspaper masthead.
export function HairlineSection({
  label,
  action,
  children,
  className,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-14", className)}>
      <div className="flex items-baseline justify-between gap-4 border-b border-foreground/80 pb-2">
        <SectionLabel>{label}</SectionLabel>
        {action && (
          <div className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-foreground/55">
            {action}
          </div>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function EditorialLede({
  eyebrow,
  children,
  aside,
}: {
  eyebrow?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:gap-16">
      <div>
        {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
        <div className="mt-4 font-display text-[36px] leading-[1.02] text-foreground md:text-[56px]">
          {children}
        </div>
      </div>
      {aside && (
        <div className="self-end border-l border-foreground/15 pl-8">{aside}</div>
      )}
    </div>
  );
}

export function PullQuote({
  attribution,
  children,
}: {
  attribution?: string;
  children: ReactNode;
}) {
  return (
    <blockquote className="border-l border-foreground pl-6 md:pl-10">
      <p className="font-display text-[26px] italic leading-[1.25] text-foreground md:text-[34px]">
        &ldquo;{children}&rdquo;
      </p>
      {attribution && (
        <div className="mt-4 text-[10.5px] uppercase tracking-[0.22em] text-foreground/55">
          {attribution}
        </div>
      )}
    </blockquote>
  );
}

// Ledger container: hairline-separated rows. Prefer this over tables when
// the data is naturally row-shaped (activity, commitments, integrations).
export function Ledger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-foreground/10", className)}>{children}</ul>
  );
}

export function LedgerRow({
  eyebrow,
  title,
  meta,
  status,
  action,
  onClick,
  as = "div",
  children,
  className,
  ...rest
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  onClick?: () => void;
  as?: "div" | "button";
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"div">, "onClick" | "children" | "title">) {
  const inner = (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-4 md:gap-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
            {eyebrow}
          </div>
        )}
        <div className={cn("text-[15px] leading-snug text-foreground", eyebrow && "mt-1.5")}>{title}</div>
        {meta && <div className="mt-1 text-[12px] text-foreground/60">{meta}</div>}
        {children && <div className="mt-2 text-[13px] text-foreground/70">{children}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-3 pt-0.5 text-[11.5px] uppercase tracking-[0.18em] text-foreground/55">
        {status}
        {action}
      </div>
    </div>
  );
  if (as === "button" || onClick) {
    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          className={cn("group w-full text-left hover:bg-foreground/[0.03] focus:outline-none focus-visible:bg-foreground/[0.04]", className)}
          {...(rest as ComponentPropsWithoutRef<"button">)}
        >
          {inner}
        </button>
      </li>
    );
  }
  return (
    <li className={cn("group", className)} {...rest}>
      {inner}
    </li>
  );
}

export function MetadataRow({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4", className)}>
      {items.map((it) => (
        <div key={it.label}>
          <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
            {it.label}
          </dt>
          <dd className="mt-1.5 text-[14px] text-foreground">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// A calm status word with an optional ink dot. Never rely on color alone;
// tone maps to an italic ledger word plus a filled/hollow mark.
export type StatusTone = "neutral" | "positive" | "attention" | "critical" | "muted";

export function StatusLine({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  const dot =
    tone === "critical"
      ? "bg-[oklch(0.5_0.18_27)]"
      : tone === "attention"
        ? "bg-[oklch(0.62_0.14_65)]"
        : tone === "positive"
          ? "bg-[oklch(0.5_0.12_155)]"
          : tone === "muted"
            ? "border border-foreground/40 bg-transparent"
            : "bg-foreground/70";
  return (
    <span className={cn("inline-flex items-center gap-2 text-[11.5px] uppercase tracking-[0.2em] text-foreground/70", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {children}
    </span>
  );
}

export function QuietPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-foreground/12 bg-card/60 p-6 md:p-8", className)}>
      {children}
    </div>
  );
}

export function InlineSAMNote({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
      <SectionLabel className="md:pt-1">SAM notes</SectionLabel>
      <blockquote className="border-l border-foreground pl-5 md:pl-6">
        <p className="font-display text-[22px] italic leading-[1.3] text-foreground md:text-[26px]">
          &ldquo;{title}&rdquo;
        </p>
        {children && (
          <p className="mt-3 text-[13.5px] leading-[1.7] text-foreground/70">{children}</p>
        )}
      </blockquote>
    </div>
  );
}

export function EmptyEditorialState({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-y border-foreground/15 px-2 py-14 text-center md:py-20">
      {eyebrow && <SectionLabel className="text-foreground/55">{eyebrow}</SectionLabel>}
      <h3 className="mx-auto mt-3 max-w-xl font-display text-[28px] leading-[1.15] text-foreground md:text-[36px]">
        {title}
      </h3>
      {description && (
        <p className="mx-auto mt-4 max-w-lg text-[14px] leading-[1.7] text-foreground/65">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

// Hairline-aligned skeleton row for lists. Never uses shimmer.
export function EditorialSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-foreground/10">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="py-5">
          <div className="h-3 w-24 bg-foreground/10" />
          <div className="mt-3 h-5 w-2/3 bg-foreground/10" />
          <div className="mt-2 h-3 w-1/3 bg-foreground/10" />
        </div>
      ))}
    </div>
  );
}

export function ErrorLine({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 border-l-2 border-[oklch(0.5_0.18_27)] bg-foreground/[0.02] px-4 py-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.5_0.18_27)]" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-foreground/70">
          Something interrupted this
        </div>
        <div className="mt-1 text-[13.5px] text-foreground/85">{message}</div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// Editorial action link. Right-aligned ledger typography, ink underline
// on hover. Prefer over ghost buttons when the action is navigational.
export function ActionLink({
  children,
  className,
  ...rest
}: ComponentPropsWithoutRef<"a">) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-foreground/70 underline-offset-4 hover:text-foreground hover:underline",
        className,
      )}
      {...rest}
    >
      {children}
    </a>
  );
}

// A numbered priority row. Editorial numerals, serif title, meta line.
export function NumberedPriority({
  index,
  eyebrow,
  title,
  meta,
  onClick,
  as = "button",
  href,
}: {
  index: number;
  eyebrow?: string;
  title: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
  as?: "button" | "a";
  href?: string;
}) {
  const body = (
    <div className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-5 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:gap-6">
      <span className="hidden font-display text-[22px] leading-none text-foreground/40 md:block">
        {String(index).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-foreground/55">
            {eyebrow}
          </div>
        )}
        <div className={cn("font-display text-[20px] leading-[1.2] text-foreground md:text-[24px]", eyebrow && "mt-1.5")}>
          {title}
        </div>
        {meta && <div className="mt-1.5 text-[12.5px] text-foreground/60">{meta}</div>}
      </div>
      <span className="mt-1 text-[11px] uppercase tracking-[0.2em] text-foreground/40 group-hover:text-foreground">
        Open
      </span>
    </div>
  );
  if (as === "a" && href) {
    return (
      <a href={href} className="block border-b border-foreground/10 last:border-b-0">
        {body}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full border-b border-foreground/10 text-left last:border-b-0 focus:outline-none focus-visible:bg-foreground/[0.04]"
    >
      {body}
    </button>
  );
}