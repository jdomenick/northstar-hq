import { useMemo, useState } from "react";
import { formatInVentureTimezone, utcToWallTime } from "@/lib/content-ops/timezone";
import { SectionLabel, StatusLine } from "@/components/editorial";
import { getPlatformConfig } from "@/lib/content-ops/platform-registry";

type CalendarMode = "month" | "week" | "agenda";

interface CalendarItem {
  id: string;
  platform: string;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  title: string | null;
  hook: string | null;
  approval_status: string;
  content_version: number;
  approved_content_version: number | null;
  jobs: Array<{ id: string; status: string; error_code: string | null }>;
}

export function CalendarView(props: {
  timezone: string;
  emergencyPause: boolean;
  publishingEnabled: boolean;
  items: CalendarItem[];
  onItemClick?: (id: string) => void;
}) {
  const [mode, setMode] = useState<CalendarMode>("agenda");
  const [cursor, setCursor] = useState<Date>(() => new Date());

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of props.items) {
      const when = item.scheduled_for ?? item.published_at;
      if (!when) continue;
      const w = utcToWallTime(new Date(when), props.timezone);
      const key = `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [props.items, props.timezone]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <div className="flex items-center gap-4">
          <SectionLabel>Editorial calendar</SectionLabel>
          <StatusLine tone="muted">Timezone {props.timezone}</StatusLine>
          {props.emergencyPause && (
            <StatusLine tone="critical">Emergency pause engaged</StatusLine>
          )}
          {!props.publishingEnabled && (
            <StatusLine tone="muted">Publishing disabled at venture</StatusLine>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs uppercase tracking-wider">
          {(["month", "week", "agenda"] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rule-ink ${mode === m ? "bg-ink text-paper" : "text-ink/70 hover:text-ink"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wider">
        <button
          className="rule-ink px-2 py-1 text-ink/70 hover:text-ink"
          onClick={() => setCursor(shiftCursor(cursor, mode, -1))}
        >
          &larr; Prev
        </button>
        <span className="text-ink/80">{labelForCursor(cursor, mode, props.timezone)}</span>
        <button
          className="rule-ink px-2 py-1 text-ink/70 hover:text-ink"
          onClick={() => setCursor(shiftCursor(cursor, mode, 1))}
        >
          Next &rarr;
        </button>
        <button
          className="rule-ink px-2 py-1 text-ink/60 hover:text-ink"
          onClick={() => setCursor(new Date())}
        >
          Today
        </button>
      </div>

      {mode === "agenda" && <AgendaList byDay={byDay} tz={props.timezone} onItemClick={props.onItemClick} />}
      {mode === "week" && <WeekGrid cursor={cursor} tz={props.timezone} byDay={byDay} onItemClick={props.onItemClick} />}
      {mode === "month" && <MonthGrid cursor={cursor} tz={props.timezone} byDay={byDay} onItemClick={props.onItemClick} />}
    </div>
  );
}

function keyForDate(d: Date, tz: string): string {
  const w = utcToWallTime(d, tz);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

function shiftCursor(d: Date, mode: CalendarMode, dir: number): Date {
  const n = new Date(d);
  if (mode === "month") n.setUTCMonth(n.getUTCMonth() + dir);
  else if (mode === "week") n.setUTCDate(n.getUTCDate() + 7 * dir);
  else n.setUTCDate(n.getUTCDate() + 3 * dir);
  return n;
}

function labelForCursor(d: Date, mode: CalendarMode, tz: string): string {
  const w = utcToWallTime(d, tz);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (mode === "month") return `${months[w.month - 1]} ${w.year}`;
  if (mode === "week") return `Week of ${months[w.month - 1]} ${w.day}, ${w.year}`;
  return "Upcoming agenda";
}

function AgendaList({
  byDay, tz, onItemClick,
}: { byDay: Map<string, CalendarItem[]>; tz: string; onItemClick?: (id: string) => void }) {
  const sorted = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (sorted.length === 0) {
    return <p className="text-sm text-ink/60 italic">Nothing scheduled in this window.</p>;
  }
  return (
    <div className="divide-y divide-ink/10">
      {sorted.map(([day, items]) => (
        <div key={day} className="py-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-ink/60">{day}</div>
          <div className="space-y-2">
            {items.map((it) => (
              <ItemLine key={it.id} item={it} tz={tz} onClick={onItemClick} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemLine({ item, tz, onClick }: { item: CalendarItem; tz: string; onClick?: (id: string) => void }) {
  const cfg = getPlatformConfig(item.platform);
  const when = item.scheduled_for ?? item.published_at;
  const timeLabel = when ? formatInVentureTimezone(new Date(when), tz) : "unscheduled";
  const jobStatus = item.jobs[0]?.status ?? null;
  const jobErr = item.jobs[0]?.error_code ?? null;
  return (
    <button
      onClick={() => onClick?.(item.id)}
      className="flex w-full items-start gap-4 rule-ink px-3 py-2 text-left hover:bg-ink/5"
    >
      <div className="w-40 shrink-0 text-xs uppercase tracking-wider text-ink/70">{timeLabel}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">{item.title ?? item.hook ?? "(untitled)"}</div>
        <div className="mt-1 text-xs text-ink/60">
          {cfg.displayName} · {item.status}
          {item.approval_status !== "approved" && ` · ${item.approval_status}`}
          {jobStatus && ` · job ${jobStatus}`}
          {jobErr && ` (${jobErr})`}
        </div>
      </div>
    </button>
  );
}

function MonthGrid({
  cursor, tz, byDay, onItemClick,
}: { cursor: Date; tz: string; byDay: Map<string, CalendarItem[]>; onItemClick?: (id: string) => void }) {
  const w = utcToWallTime(cursor, tz);
  const first = new Date(Date.UTC(w.year, w.month - 1, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(w.year, w.month, 0)).getUTCDate();
  const cells: Array<{ key: string; day: number | null }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ key: `blank-${i}`, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${w.year}-${String(w.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key, day: d });
  }
  return (
    <div className="grid grid-cols-7 gap-px bg-ink/10 text-xs">
      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
        <div key={d} className="bg-paper px-2 py-1 uppercase tracking-wider text-ink/60">{d}</div>
      ))}
      {cells.map((c) => (
        <div key={c.key} className="min-h-24 bg-paper p-2">
          {c.day && (
            <>
              <div className="text-ink/50">{c.day}</div>
              <div className="mt-1 space-y-1">
                {(byDay.get(c.key) ?? []).slice(0, 3).map((it) => (
                  <button
                    key={it.id}
                    onClick={() => onItemClick?.(it.id)}
                    className="block w-full truncate text-left text-[11px] text-ink hover:underline"
                  >
                    {formatInVentureTimezone(new Date(it.scheduled_for ?? it.published_at ?? ""), tz).split(" ").slice(-2).join(" ")} {it.title ?? it.hook ?? "(untitled)"}
                  </button>
                ))}
                {(byDay.get(c.key)?.length ?? 0) > 3 && (
                  <div className="text-[10px] text-ink/50">+{(byDay.get(c.key)!.length - 3)} more</div>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function WeekGrid({
  cursor, tz, byDay, onItemClick,
}: { cursor: Date; tz: string; byDay: Map<string, CalendarItem[]>; onItemClick?: (id: string) => void }) {
  const start = new Date(cursor);
  const dow = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - dow);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d);
  }
  return (
    <div className="grid grid-cols-7 gap-px bg-ink/10 text-xs">
      {days.map((d) => {
        const k = keyForDate(d, tz);
        const items = byDay.get(k) ?? [];
        return (
          <div key={k} className="min-h-40 bg-paper p-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-ink/50">{k}</div>
            <div className="space-y-1">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => onItemClick?.(it.id)}
                  className="block w-full text-left rule-ink px-1.5 py-1 text-[11px] text-ink hover:bg-ink/5"
                >
                  <div className="truncate">{it.title ?? it.hook ?? "(untitled)"}</div>
                  <div className="text-ink/50">{it.platform} · {it.status}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
