// Helpers for working with timestamps in US market time (America/New_York).

import type { Timeframe } from "@/lib/types";

export const MARKET_TZ = "America/New_York";

export const TIMEFRAME_MS = {
  "1Min": 60_000,
  "5Min": 5 * 60_000,
  "15Min": 15 * 60_000,
  "1Hour": 60 * 60_000,
  "1Day": 24 * 60 * 60_000,
} as const;

export type MarketParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
};

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function marketParts(ms: number): MarketParts {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(ms).map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** Epoch ms for a wall-clock time in market time on the given market date. */
export function marketTimeToMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const p = marketParts(asUtc);
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - asUtc;
  return asUtc - offset;
}

export function formatMarketTime(
  ms: number,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TZ,
    ...options,
  }).format(ms);
}

/** A bar's time: just the date for daily bars, which stand for the close, otherwise date and time. */
export function formatBarTime(ms: number, timeframe: Timeframe): string {
  const date = formatMarketTime(ms, { dateStyle: "medium" });
  // Joined by hand: Intl's combined dateStyle/timeStyle reads "Sep 21, 2026 at 9:00 AM".
  return timeframe === "1Day"
    ? date
    : `${date}, ${formatMarketTime(ms, { timeStyle: "short" })}`;
}
