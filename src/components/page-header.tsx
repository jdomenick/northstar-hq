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
    <div className="px-6 pb-10 pt-14 md:px-14 md:pb-14 md:pt-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-4 text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-[40px] leading-[1.02] text-foreground md:text-[56px]">
            {title}
          </h1>
          {description && (
            <p className="mt-5 max-w-xl text-[14.5px] leading-[1.7] text-muted-foreground">
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
    <div className="mx-auto max-w-6xl px-6 pb-24 md:px-14">{children}</div>
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
    <section className="mb-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
            {title}
          </h2>
          {hint && <p className="mt-2 text-[13px] text-muted-foreground/70">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}