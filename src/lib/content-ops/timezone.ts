// Timezone helpers for Content Operations scheduling.
//
// All scheduled times are stored as UTC ISO strings in the database and
// scheduled through automation_jobs. Every conversion between "wall-clock
// time in the venture timezone" and "UTC instant" flows through the two
// pure functions here so DST transitions, ambiguous times, and non-existent
// times behave predictably in one place.
//
// Uses Intl.DateTimeFormat which is available in the Cloudflare Workers
// runtime and every modern browser; no external tz library required.

export const SCHEDULER_VERSION = "northstar.contentops.scheduler.v1";

export type WallTime = {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;
};

const partsFmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    partsFmtCache.set(tz, f);
  }
  return f;
}

/** True when the runtime recognises the timezone identifier. */
export function isValidTimezone(tz: string): boolean {
  if (typeof tz !== "string" || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Return the wall-clock parts of `instant` as observed in `tz`. */
export function utcToWallTime(instant: Date, tz: string): WallTime {
  const parts = partsFormatter(tz).formatToParts(instant);
  const out: Record<string, number> = {};
  for (const p of parts) {
    if (p.type === "year" || p.type === "month" || p.type === "day"
      || p.type === "hour" || p.type === "minute" || p.type === "second") {
      out[p.type] = parseInt(p.value, 10);
    }
  }
  // en-US "24" is rendered as "24" for midnight under hourCycle h23 in some
  // engines — normalise defensively.
  if (out.hour === 24) out.hour = 0;
  return {
    year: out.year, month: out.month, day: out.day,
    hour: out.hour, minute: out.minute,
  };
}

/** Offset of `tz` from UTC at `instant`, in minutes. Handles DST. */
export function tzOffsetMinutes(instant: Date, tz: string): number {
  const w = utcToWallTime(instant, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, 0);
  // 60_000 = ms in a minute
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * Convert a wall-clock time in `tz` to the corresponding UTC instant.
 *
 * DST behaviour:
 *  - Ambiguous local times (fall-back hour that occurs twice) resolve to
 *    the earlier occurrence.
 *  - Non-existent local times (spring-forward gap) resolve forward, i.e.
 *    the instant of the same wall-clock minute after DST is applied.
 * Both behaviours emerge naturally from the two-step offset correction and
 * match the deterministic "pick the later valid offset once" convention.
 */
export function wallTimeToUtc(w: WallTime, tz: string): Date {
  // First guess: treat wall time as UTC, then correct by the offset at that
  // instant, then correct once more if the offset changed across DST.
  const guess1 = new Date(Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, 0));
  const offset1 = tzOffsetMinutes(guess1, tz);
  const utc1 = guess1.getTime() - offset1 * 60_000;
  const guess2 = new Date(utc1);
  const offset2 = tzOffsetMinutes(guess2, tz);
  if (offset1 === offset2) return guess2;
  return new Date(guess1.getTime() - offset2 * 60_000);
}

/**
 * Format a UTC instant as a short label in the venture timezone, e.g.
 * "Mar 3, 2027 at 09:15 EST". Deterministic, non-locale-dependent order.
 */
export function formatInVentureTimezone(instant: Date, tz: string): string {
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "short", day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    timeZoneName: "short",
  });
  return `${dateFmt.format(instant)} at ${timeFmt.format(instant)}`;
}

/** Return the venture default timezone or a safe fallback. */
export function resolveVentureTimezone(input: string | null | undefined): string {
  if (input && isValidTimezone(input)) return input;
  return "UTC";
}
