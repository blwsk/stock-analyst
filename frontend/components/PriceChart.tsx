"use client";

import { useRef, useState, type PointerEvent } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  periodTicks,
  sessionAxis,
  type Point,
  type TickPeriod,
} from "@/lib/chartAxis";
import { formatBarTime, formatMarketTime, marketParts } from "@/lib/marketTime";
import type { Bar, Range, Timeframe } from "@/lib/types";

const AXIS_TICK = { fontSize: 12 };

const HEIGHT = 300;
const MARGIN = { top: 10, right: 32, bottom: 5, left: 5 };
// Recharts' default axis sizes, set explicitly so drag selection can locate the plot area.
const Y_AXIS_WIDTH = 60;
const X_AXIS_HEIGHT = 30;
const PLOT_LEFT = MARGIN.left + Y_AXIS_WIDTH;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom - X_AXIS_HEIGHT;
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

export default function PriceChart({
  bars,
  range,
  timeframe,
  onSelect,
}: {
  bars: Bar[];
  /** null for a custom start/end window. */
  range: Range | null;
  timeframe: Timeframe;
  onSelect: (start: number, end: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Drag positions in px from the container's left edge.
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  let points: Point[] = bars.map((bar) => ({
    t: Date.parse(bar.timestamp),
    close: bar.close,
  }));

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
        height={X_AXIS_HEIGHT}
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
        height={X_AXIS_HEIGHT}
      />
    );
  }

  const plotWidth = () =>
    containerRef.current!.clientWidth - PLOT_LEFT - MARGIN.right;

  const clampX = (x: number) =>
    Math.min(Math.max(x, PLOT_LEFT), PLOT_LEFT + plotWidth());

  const localX = (e: PointerEvent) =>
    e.clientX - containerRef.current!.getBoundingClientRect().left;

  /** The time of the bar nearest to an x position. */
  const timeAt = (x: number) => {
    const fraction = (x - PLOT_LEFT) / plotWidth();
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
    const x = localX(e);
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const inPlot =
      x === clampX(x) && y >= MARGIN.top && y <= MARGIN.top + PLOT_HEIGHT;
    if (e.button !== 0 || !inPlot) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: x, to: x });
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
          <CartesianGrid vertical={false} />
          {xAxis}
          {/* interval={0} stops recharts nudging the top label down to fit; the top margin gives it room. */}
          <YAxis
            domain={["auto", "auto"]}
            tick={AXIS_TICK}
            interval={0}
            width={Y_AXIS_WIDTH}
          />
          <Tooltip
            labelFormatter={(t) => formatBarTime(Number(t), timeframe)}
            // Show just the price; the label already says whether it's a close or a time of day.
            formatter={(value) => [`${Number(value).toFixed(2)} USD`, ""]}
            separator=""
            contentStyle={{
              margin: 0,
              padding: "4px 8px",
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: 6,
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
            itemStyle={{
              display: "block",
              padding: 0,
              color: "#000",
              fontWeight: 500,
            }}
          />
          <Line
            dataKey="close"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {drag && (
        <div
          className="pointer-events-none absolute border-x border-zinc-400 bg-zinc-400/20"
          style={{
            left: Math.min(drag.from, drag.to),
            width: Math.abs(drag.to - drag.from),
            top: MARGIN.top,
            height: PLOT_HEIGHT,
          }}
        />
      )}
    </div>
  );
}
