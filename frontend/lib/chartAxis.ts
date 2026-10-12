import { TIMEFRAME_MS, marketParts, marketTimeToMs } from "@/lib/marketTime";
import type { Range, Timeframe } from "@/lib/types";

export type Point = { t: number; close: number };

/** Key identifying the period a bar belongs to; a tick goes on the first bar of each period. */
function periodKey(t: number, range: Exclude<Range, "1D">): string {
  const p = marketParts(t);
  switch (range) {
    case "5D":
      return `${p.year}-${p.month}-${p.day}`;
    case "1M": {
      // Monday of the bar's week.
      const monday = new Date(
        Date.UTC(p.year, p.month - 1, p.day - ((p.weekday + 6) % 7))
      );
      return monday.toISOString().slice(0, 10);
    }
    case "6M":
    case "1Y":
      return `${p.year}-${p.month}`;
  }
}

export function periodTicks(
  points: Point[],
  range: Exclude<Range, "1D">
): number[] {
  const ticks: number[] = [];
  points.forEach((point, i) => {
    const key = periodKey(point.t, range);
    if (i === 0) {
      // 5D data is trimmed to whole sessions, so its first bar starts a day. Other ranges start
      // mid-period, so skip their first bar rather than label a partial week or month.
      if (range === "5D") ticks.push(point.t);
    } else if (key !== periodKey(points[i - 1].t, range)) {
      ticks.push(point.t);
    }
  });
  return range === "1Y" ? ticks.filter((_, i) => i % 2 === 0) : ticks;
}

/**
 * Domain and hourly ticks for a single regular session (9:30-16:00 market time), plus the points
 * that fall inside it. Bars overlapping the open (e.g. the 9:00 hourly bar) are clamped to it.
 */
export function sessionAxis(points: Point[], timeframe: Timeframe) {
  const p = marketParts(points[points.length - 1].t);
  const open = marketTimeToMs(p.year, p.month, p.day, 9, 30);
  const close = marketTimeToMs(p.year, p.month, p.day, 16, 0);
  const barMs = TIMEFRAME_MS[timeframe];
  return {
    domain: [open, close] as [number, number],
    ticks: Array.from({ length: 7 }, (_, i) =>
      marketTimeToMs(p.year, p.month, p.day, 10 + i, 0)
    ),
    points: points
      .filter((point) => point.t + barMs > open && point.t < close)
      .map((point) => ({ ...point, t: Math.max(point.t, open) })),
  };
}
