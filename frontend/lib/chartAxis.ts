import {
  TIMEFRAME_MS,
  marketParts,
  marketTimeToMs,
  type MarketParts,
} from "@/lib/marketTime";
import type { Timeframe } from "@/lib/types";

/** A chart row; only its epoch-ms time matters to the axis. */
export type Point = { t: number };

/** Spacing between ticks on evenly spaced (category) axes, finest first. */
export const TICK_PERIODS = [
  "1Min",
  "5Min",
  "15Min",
  "30Min",
  "1Hour",
  "2Hour",
  "1Day",
  "1Week",
  "1Month",
  "2Month",
] as const;

export type TickPeriod = (typeof TICK_PERIODS)[number];

// Few enough that labels like "12:40 PM" don't collide at typical chart widths.
const MAX_TICKS = 8;

/** Key identifying the period a bar belongs to; a tick goes on the first bar of each period. */
function periodKey(p: MarketParts, period: TickPeriod): string {
  const day = `${p.year}-${p.month}-${p.day}`;
  switch (period) {
    case "1Min":
      return `${day} ${p.hour}:${p.minute}`;
    case "5Min":
      return `${day} ${p.hour}:${Math.floor(p.minute / 5)}`;
    case "15Min":
      return `${day} ${p.hour}:${Math.floor(p.minute / 15)}`;
    case "30Min":
      return `${day} ${p.hour}:${Math.floor(p.minute / 30)}`;
    case "1Hour":
      return `${day} ${p.hour}`;
    case "2Hour":
      return `${day} ${Math.floor(p.hour / 2)}`;
    case "1Day":
      return day;
    case "1Week": {
      // Monday of the bar's week.
      const monday = new Date(
        Date.UTC(p.year, p.month - 1, p.day - ((p.weekday + 6) % 7))
      );
      return monday.toISOString().slice(0, 10);
    }
    case "1Month":
      return `${p.year}-${p.month}`;
    case "2Month":
      return `${p.year}-${Math.floor((p.month - 1) / 2)}`;
  }
}

function ticksFor(
  points: readonly Point[],
  parts: MarketParts[],
  period: TickPeriod,
  labelFirst: boolean
): number[] {
  return points
    .filter((_, i) =>
      i === 0
        ? labelFirst
        : periodKey(parts[i], period) !== periodKey(parts[i - 1], period)
    )
    .map((point) => point.t);
}

/**
 * Ticks on the first bar of each period, using the finest period that's no finer than the bars
 * and leaves at most MAX_TICKS ticks.
 */
export function periodTicks(
  points: readonly Point[],
  timeframe: Timeframe,
  // 5D data is trimmed to whole sessions, so its first bar starts a day. Other ranges (and custom
  // windows) start mid-period, so skip their first bar rather than label a partial period.
  labelFirst = false
): { period: TickPeriod; ticks: number[] } {
  const parts = points.map((point) => marketParts(point.t));
  const candidates = TICK_PERIODS.slice(TICK_PERIODS.indexOf(timeframe));
  for (const period of candidates) {
    const ticks = ticksFor(points, parts, period, labelFirst);
    if (ticks.length <= MAX_TICKS) return { period, ticks };
  }
  const period = candidates[candidates.length - 1];
  return { period, ticks: ticksFor(points, parts, period, labelFirst) };
}

/**
 * Domain and hourly ticks for a single regular session (9:30-16:00 market time), plus the points
 * that fall inside it. Bars overlapping the open (e.g. the 9:00 hourly bar) are clamped to it.
 */
export function sessionAxis<P extends Point>(
  points: P[],
  timeframe: Timeframe
) {
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

/**
 * The time of the bar containing `at`, or null if no visible bar does, so notes snap to whichever bars are shown
 * (e.g. a note placed on a 5-minute bar lands on its day's bar in a daily chart).
 */
export function containingBar(
  points: readonly Point[],
  at: number,
  timeframe: Timeframe
): number | null {
  let bar: Point | undefined;
  for (const point of points) {
    if (point.t > at) break;
    bar = point;
  }
  return bar && at - bar.t < TIMEFRAME_MS[timeframe] ? bar.t : null;
}
