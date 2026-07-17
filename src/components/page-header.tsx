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
    <div className="border-b border-border/60 px-4 py-8 md:px-10 md:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-4xl md:text-5xl leading-[1.05] text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-10 md:py-12">{children}</div>
  );
}

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
    <section className="mb-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h2>
          {hint && <p className="mt-1 text-[13px] text-muted-foreground/80">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}