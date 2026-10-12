"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { periodTicks, sessionAxis, type Point } from "@/lib/chartAxis";
import { formatMarketTime } from "@/lib/marketTime";
import type { Bar, Range, Timeframe } from "@/lib/types";

const AXIS_TICK = { fontSize: 12 };

const TICK_FORMATS: Record<Range, Intl.DateTimeFormatOptions> = {
  "1D": { hour: "numeric" },
  "5D": { weekday: "short", month: "numeric", day: "numeric" },
  "1M": { month: "short", day: "numeric" },
  "6M": { month: "short" },
  "1Y": { month: "short" },
};

export default function PriceChart({
  bars,
  range,
  timeframe,
}: {
  bars: Bar[];
  range: Range;
  timeframe: Timeframe;
}) {
  let points: Point[] = bars.map((bar) => ({
    t: Date.parse(bar.timestamp),
    close: bar.close,
  }));

  const formatTick = (t: number) => {
    const label = formatMarketTime(t, TICK_FORMATS[range]);
    // e.g. "Nov '25"; Intl's 2-digit year alone would read like a day ("Nov 25").
    return range === "1Y"
      ? `${label} '${formatMarketTime(t, { year: "2-digit" })}`
      : label;
  };
  const formatLabel = (t: number) =>
    formatMarketTime(
      t,
      timeframe === "1Day"
        ? { dateStyle: "medium" }
        : { dateStyle: "medium", timeStyle: "short" }
    );

  let xAxis;
  if (range === "1D") {
    // A real time axis spanning the regular session, so the rest of today stays empty.
    const session = sessionAxis(points, timeframe);
    points = session.points;
    xAxis = (
      <XAxis
        dataKey="t"
        type="number"
        domain={session.domain}
        ticks={session.ticks}
        tickFormatter={formatTick}
        tick={AXIS_TICK}
      />
    );
  } else {
    // Evenly spaced bars so weekends, holidays and overnight hours don't leave gaps.
    xAxis = (
      <XAxis
        dataKey="t"
        ticks={periodTicks(points, range)}
        interval={0}
        tickFormatter={formatTick}
        tick={AXIS_TICK}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={points}
        margin={{ top: 10, right: 32, bottom: 5, left: 5 }}
      >
        <CartesianGrid vertical={false} />
        {xAxis}
        {/* interval={0} stops recharts nudging the top label down to fit; the top margin gives it room. */}
        <YAxis domain={["auto", "auto"]} tick={AXIS_TICK} interval={0} />
        <Tooltip
          labelFormatter={(t) => formatLabel(Number(t))}
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
  );
}
