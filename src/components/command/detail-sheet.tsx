// Shared drill-down sheet for Command Center surfaces.
// Presentation only: every caller passes already-resolved rows.

import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Delta, Sparkline } from "@/components/command/dash-ui";

export type DetailRow = { label: string; value: string };

export type DetailPayload = {
  title: string;
  subtitle?: string;
  value?: string;
  delta?: number;
  series?: number[];
  rows?: DetailRow[];
  note?: string;
  link?: { to: string; label: string };
};

export function DetailSheet({
  detail,
  onOpenChange,
}: {
  detail: DetailPayload | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(detail)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        {detail && (
          <>
            <SheetHeader className="space-y-1">
              <SheetTitle className="flex items-center gap-2 text-[14px]">
                <span className="min-w-0 truncate">{detail.title}</span>
              </SheetTitle>
              {detail.subtitle && (
                <SheetDescription className="text-[11px] uppercase tracking-[0.16em]">
                  {detail.subtitle}
                </SheetDescription>
              )}
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {(detail.value || typeof detail.delta === "number") && (
                <div className="flex items-end gap-2">
                  {detail.value && (
                    <div className="font-display text-[26px] leading-none tabular-nums text-foreground">
                      {detail.value}
                    </div>
                  )}
                  {typeof detail.delta === "number" && <Delta value={detail.delta} />}
                </div>
              )}

              {detail.series && detail.series.length > 1 && (
                <div className="rounded-[7px] border border-border/70 bg-card/60 p-3">
                  <div className="mb-1.5 text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
                    Trailing trend
                  </div>
                  <Sparkline data={detail.series} className="h-16" />
                </div>
              )}

              {detail.rows && detail.rows.length > 0 && (
                <ul className="divide-y divide-border/40 rounded-[7px] border border-border/70 bg-card/60">
                  {detail.rows.map((r) => (
                    <li
                      key={r.label}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-[11.5px]"
                    >
                      <span className="min-w-0 truncate text-muted-foreground">{r.label}</span>
                      <span className="shrink-0 tabular-nums text-foreground">{r.value}</span>
                    </li>
                  ))}
                </ul>
              )}

              {detail.note && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">{detail.note}</p>
              )}

              {detail.link && (
                <Link
                  to={detail.link.to}
                  onClick={() => onOpenChange(false)}
                  className="inline-flex h-8 items-center rounded-[6px] border border-border/70 bg-card/60 px-3 text-[11.5px] text-foreground hover:border-primary/50"
                >
                  {detail.link.label}
                </Link>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
