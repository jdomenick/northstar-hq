/**
 * Dashboard range translation for module reporting.
 *
 * HQ ranges (mtd, 30d, qtd, ytd) are translated to explicit UTC ISO windows.
 * CAM additionally accepts a `period` shorthand for the windows it supports;
 * everything else is sent as explicit from/to (or start/end for CAM).
 */

export type DashboardRange = "mtd" | "30d" | "qtd" | "ytd";

export interface ResolvedRange {
  range: DashboardRange;
  startIso: string;
  endIso: string;
  /** CAM `period` shorthand when CAM supports it directly, otherwise null. */
  camPeriod: "mtd" | "30d" | null;
}

const CAM_PERIODS: Record<string, "mtd" | "30d" | null> = {
  mtd: "mtd",
  "30d": "30d",
  qtd: null,
  ytd: null,
};

export function isDashboardRange(value: unknown): value is DashboardRange {
  return value === "mtd" || value === "30d" || value === "qtd" || value === "ytd";
}

export function resolveRange(
  input: string | null | undefined,
  now: Date = new Date(),
): ResolvedRange {
  const range: DashboardRange = isDashboardRange(input) ? input : "mtd";
  const end = new Date(now.getTime());
  let start: Date;

  switch (range) {
    case "30d":
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "qtd": {
      const quarterStartMonth = Math.floor(end.getUTCMonth() / 3) * 3;
      start = new Date(Date.UTC(end.getUTCFullYear(), quarterStartMonth, 1, 0, 0, 0, 0));
      break;
    }
    case "ytd":
      start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
      break;
    case "mtd":
    default:
      start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1, 0, 0, 0, 0));
      break;
  }

  return {
    range,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    camPeriod: CAM_PERIODS[range] ?? null,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}
