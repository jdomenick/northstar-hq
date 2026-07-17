// Editorial page primitives for the Paper & Ink experience system.
// Every signed-in route composes with PageHeader / PageBody / Section
// so a change here cascades through the whole product. Preserve the
// component API (eyebrow / title / description / actions on PageHeader,
// title / hint / action on Section) so existing routes keep working.

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
    <header className="animate-in fade-in duration-500 border-b border-foreground/15 px-6 pt-10 md:px-14 md:pt-14">
      <div className="mx-auto max-w-6xl">
        {eyebrow && (
          <div className="text-[10.5px] font-medium uppercase tracking-[0.28em] text-foreground/70">
            {eyebrow}
          </div>
        )}
        <div className="mt-5 flex flex-col gap-8 border-t border-foreground/80 pt-4 md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="min-w-0">
            <h1 className="font-display text-[40px] leading-[0.98] tracking-tight text-foreground md:text-[64px]">
              {title}
            </h1>
            {description && (
              <p className="mt-5 max-w-2xl text-[14.5px] leading-[1.75] text-foreground/70">
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
        <div className="pb-8" />
      </div>
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-10 md:px-14 md:pt-14 animate-in fade-in duration-500">
      {children}
    </div>
  );
}

// Section: heavy hairline masthead under the label, italic hint,
// right-aligned ledger action. Consistent across every screen.
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
    <section className="mb-14">
      <div className="flex items-baseline justify-between gap-4 border-b border-foreground/80 pb-2">
        <h2 className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-foreground/75">
          {title}
        </h2>
        {action && <div className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-foreground/55">{action}</div>}
      </div>
      {hint && (
        <p className="mt-3 text-[12.5px] italic text-foreground/60">{hint}</p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}