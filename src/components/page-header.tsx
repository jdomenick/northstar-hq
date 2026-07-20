// Command-console page primitives. Every signed-in route composes with
// PageHeader / PageBody / Section, so a change here cascades product-wide.
// Preserve the component API (eyebrow / title / description / actions on
// PageHeader, title / hint / action on Section) so existing routes keep working.

import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="animate-in fade-in duration-300 border-b border-border bg-card/55 px-4 pt-6 md:px-10 md:pt-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
          <div className="min-w-0">
            {eyebrow && (
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
                <span className="truncate">{eyebrow}</span>
              </div>
            )}
            <h1 className="mt-2 font-display text-[27px] font-semibold leading-[1.1] text-foreground md:text-[34px]">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-[13px] leading-[1.6] text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
        <div className="pb-5" />
      </div>
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:px-10 md:pt-8 animate-in fade-in duration-300">
      {children}
    </div>
  );
}

// Section: thin uppercase label with signal dot, subtle hint, right-aligned
// action. Consistent across every screen.
export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-1 w-1 shrink-0 rounded-full bg-primary/80" />
          <h2 className="truncate text-[10.5px] font-medium uppercase tracking-[0.22em] text-foreground/80">
            {title}
          </h2>
          {hint && (
            <span className="hidden truncate text-[11.5px] text-muted-foreground md:inline">
              <span className="mx-2 text-muted-foreground/40">·</span>
              {hint}
            </span>
          )}
        </div>
        {action && (
          <div className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {action}
          </div>
        )}
      </div>
      {hint && (
        <p className="mt-2 text-[12px] text-muted-foreground md:hidden">{hint}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}