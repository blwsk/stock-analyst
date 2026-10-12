"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  usePlotArea,
  XAxis,
  YAxis,
  type PlotArea,
} from "recharts";

import {
  periodTicks,
  sessionAxis,
  type Point,
  type TickPeriod,
} from "@/lib/chartAxis";
import { formatBarTime, formatMarketTime, marketParts } from "@/lib/marketTime";
import type { Bar, Range, Timeframe } from "@/lib/types";

export type Series = { ticker: string; data: Bar[]; color: string };

/** One row per bar time, with each ticker's close at that time. */
type Row = Point & { values: Record<string, number> };

/** Merges the series by time; tickers can miss bars the others have (IEX skips quiet minutes). */
function toRows(series: Series[]): Row[] {
  const rows = new Map<number, Row>();
  for (const { ticker, data } of series) {
    for (const bar of data) {
      const t = Date.parse(bar.timestamp);
      let row = rows.get(t);
      if (!row) rows.set(t, (row = { t, values: {} }));
      row.values[ticker] = bar.close;
    }
  }
  return [...rows.values()].sort((a, b) => a.t - b.t);
}

const AXIS_TICK = { fontSize: 12 };

const HEIGHT = 300;
// The right margin leaves room for the last x-axis label.
const MARGIN = { top: 10, right: 32, bottom: 5, left: 5 };
// Space between stacked y-axes, and recharts' default gap between a tick mark and its label.
const Y_AXIS_GAP = 8;
const TICK_MARGIN = 2;
// Shorter drags are treated as clicks.
const MIN_DRAG_PX = 3;

const MINUTES: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};
const TICK_FORMATS: Record<TickPeriod, Intl.DateTimeFormatOptions> = {
  "1Min": MINUTES,
  "5Min": MINUTES,
  "15Min": MINUTES,
  "30Min": MINUTES,
  "1Hour": { hour: "numeric" },
  "2Hour": { hour: "numeric" },
  "1Day": { weekday: "short", month: "numeric", day: "numeric" },
  "1Week": { month: "short", day: "numeric" },
  "1Month": { month: "short" },
  "2Month": { month: "short" },
};

/**
 * Keeps `plotRef` pointing at the plot area recharts laid out. The y-axes size to their labels, so the plot's
 * position can't be computed up front; drag selection reads it from here.
 */
function PlotAreaTracker({ plotRef }: { plotRef: RefObject<PlotArea | null> }) {
  const area = usePlotArea();
  useEffect(() => {
    plotRef.current = area ?? null;
  }, [area, plotRef]);
  return null;
}

export default function PriceChart({
  series,
  range,
  timeframe,
  onSelect,
}: {
  series: Series[];
  /** null for a custom start/end window. */
  range: Range | null;
  timeframe: Timeframe;
  onSelect: (start: number, end: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<PlotArea | null>(null);
  // Drag positions in px from the container's left edge, plus the plot's vertical extent for the overlay.
  const [drag, setDrag] = useState<{
    from: number;
    to: number;
    top: number;
    height: number;
  } | null>(null);

  let points = toRows(series);

  const formatTick = (period: TickPeriod) => (t: number) => {
    // Hourly ticks can land off the hour, e.g. on the 9:30 open; "9 AM" would misplace them.
    const offHour =
      (period === "1Hour" || period === "2Hour") && marketParts(t).minute !== 0;
    const label = formatMarketTime(t, offHour ? MINUTES : TICK_FORMATS[period]);
    // e.g. "Nov '25"; Intl's 2-digit year alone would read like a day ("Nov 25").
    return period === "2Month"
      ? `${label} '${formatMarketTime(t, { year: "2-digit" })}`
      : label;
  };

  let xAxis;
  let domain: [number, number] | null = null;
  if (range === "1D") {
    // A real time axis spanning the regular session, so the rest of today stays empty.
    const session = sessionAxis(points, timeframe);
    points = session.points;
    domain = session.domain;
    xAxis = (
      <XAxis
        dataKey="t"
        type="number"
        domain={session.domain}
        ticks={session.ticks}
        tickFormatter={formatTick("1Hour")}
        tick={AXIS_TICK}
      />
    );
  } else {
    // Evenly spaced bars so weekends, holidays and overnight hours don't leave gaps.
    const { period, ticks } = periodTicks(points, timeframe, range === "5D");
    xAxis = (
      <XAxis
        dataKey="t"
        ticks={ticks}
        interval={0}
        tickFormatter={formatTick(period)}
        tick={AXIS_TICK}
      />
    );
  }

  const clampX = (x: number) => {
    const plot = plotRef.current!;
    return Math.min(Math.max(x, plot.x), plot.x + plot.width);
  };

  const localX = (e: PointerEvent) =>
    e.clientX - containerRef.current!.getBoundingClientRect().left;

  /** The time of the bar nearest to an x position. */
  const timeAt = (x: number) => {
    const plot = plotRef.current!;
    const fraction = (x - plot.x) / plot.width;
    if (domain) {
      const t = domain[0] + fraction * (domain[1] - domain[0]);
      return points.reduce((best, p) =>
        Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best
      ).t;
    }
    // Category axes in a line chart put the first and last bars on the plot's edges.
    return points[Math.round(fraction * (points.length - 1))].t;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const plot = plotRef.current;
    if (e.button !== 0 || !plot) return;
    const x = localX(e);
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const inPlot = x === clampX(x) && y >= plot.y && y <= plot.y + plot.height;
    if (!inPlot) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: x, to: x, top: plot.y, height: plot.height });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag) setDrag({ ...drag, to: clampX(localX(e)) });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag(null);
    const to = clampX(localX(e));
    if (Math.abs(to - drag.from) < MIN_DRAG_PX) return;
    const [start, end] = [timeAt(drag.from), timeAt(to)].sort((a, b) => a - b);
    if (start < end) onSelect(start, end);
  };

  return (
    <div
      ref={containerRef}
      className="relative cursor-crosshair touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      <ResponsiveContainer width="100%" height={HEIGHT}>
        <LineChart data={points} margin={MARGIN}>
          {/* Gridlines follow the first ticker's axis. */}
          <PlotAreaTracker plotRef={plotRef} />
          <CartesianGrid vertical={false} yAxisId={series[0].ticker} />
          {xAxis}
          {/* interval={0} stops recharts nudging the top label down to fit; the top margin gives it room. */}
          {series.map(({ ticker, color }) => (
            <YAxis
              key={ticker}
              yAxisId={ticker}
              domain={["auto", "auto"]}
              // Colored like the ticker's line, so it's clear which axis is whose. Auto width is the widest
              // label plus tickMargin; shifting the labels back by the extra margin (dx) leaves the gap on their
              // outer side, between axes, without moving them off their tick marks.
              tick={{ ...AXIS_TICK, fill: color, dx: Y_AXIS_GAP }}
              tickMargin={TICK_MARGIN + Y_AXIS_GAP}
              stroke={color}
              interval={0}
              // Sized to its labels rather than recharts' fixed 60px.
              width="auto"
            />
          ))}
          <Tooltip
            labelFormatter={(t) => formatBarTime(Number(t), timeframe)}
            // e.g. "AAPL 254.10 USD"; the label already says whether it's a close or a time of day.
            formatter={(value, name) => [
              `${Number(value).toFixed(2)} USD`,
              name,
            ]}
            separator=" "
            contentStyle={{
              margin: 0,
              padding: "4px 8px",
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: 6,
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
            // Items take their line's color, matching the ticker headings.
            itemStyle={{ display: "block", padding: 0, fontWeight: 500 }}
          />
          {series.map(({ ticker, color }) => (
            <Line
              key={ticker}
              yAxisId={ticker}
              name={ticker}
              // A function rather than a string key, since recharts reads "BRK.B" as a nested path.
              dataKey={(row: Row) => row.values[ticker] ?? null}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {drag && (
        <div
          className="pointer-events-none absolute border-x border-zinc-400 bg-zinc-400/20"
          style={{
            left: Math.min(drag.from, drag.to),
            width: Math.abs(drag.to - drag.from),
            top: drag.top,
            height: drag.height,
          }}
        />
      )}
    </div>
  );
}
