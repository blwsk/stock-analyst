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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  usePlotArea,
  XAxis,
  YAxis,
  type PlotArea,
} from "recharts";

import NotePopover from "@/components/NotePopover";
import {
  containingBar,
  periodTicks,
  sessionAxis,
  type Point,
  type TickPeriod,
} from "@/lib/chartAxis";
import {
  formatBarTime,
  formatMarketTime,
  formatNoteTime,
  marketParts,
} from "@/lib/marketTime";
import type { Bar, Note, Range, Timeframe } from "@/lib/types";

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
const NOTE_COLOR = "#f59e0b";

/** Notes grouped by the visible bar they snap to, in time order, so notes on the same bar share one line. */
function notesByBar(
  notes: Note[],
  points: readonly Point[],
  timeframe: Timeframe
): Map<number, Note[]> {
  const bars = new Map<number, Note[]>();
  for (const note of notes) {
    const t = containingBar(points, Date.parse(note.at), timeframe);
    if (t !== null) bars.set(t, [...(bars.get(t) ?? []), note]);
  }
  return bars;
}

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
  notes,
  noteMode,
  onSelect,
  onCreateNote,
}: {
  series: Series[];
  /** null for a custom start/end window. */
  range: Range | null;
  timeframe: Timeframe;
  notes: Note[];
  /** When on, clicking the chart places a note instead of dragging out a window. */
  noteMode: boolean;
  onSelect: (start: number, end: number) => void;
  /** Resolves to whether the note was saved. */
  onCreateNote: (at: number, content: string) => Promise<boolean>;
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
  // Where a note is being written: the clicked bar's time, and the click position for the popover.
  const [draft, setDraft] = useState<{
    at: number;
    x: number;
    y: number;
  } | null>(null);
  // Leaving note mode (by saving, or toggling it off) discards the draft.
  if (!noteMode && draft) setDraft(null);

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

  // Computed from the final points, after the 1D session axis clamps bars to the open.
  const noteBars = notesByBar(notes, points, timeframe);

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
    if (noteMode) {
      setDraft({ at: timeAt(x), x, y });
      return;
    }
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
      className={`relative touch-none select-none ${noteMode ? "cursor-cell" : "cursor-crosshair"}`}
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
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="w-max max-w-60 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs shadow-sm">
                  {/* The label says whether the prices are closes or a time of day's. */}
                  <div className="whitespace-nowrap">
                    {formatBarTime(Number(label), timeframe)}
                  </div>
                  {/* e.g. "AAPL 254.10 USD", in the line's color to match the ticker headings. */}
                  {payload.map((entry) => (
                    <div
                      key={String(entry.name)}
                      className="font-medium whitespace-nowrap"
                      style={{ color: entry.color }}
                    >
                      {entry.name} {Number(entry.value).toFixed(2)} USD
                    </div>
                  ))}
                  {noteBars.get(Number(label))?.map((note) => (
                    <div
                      key={note.id}
                      className="mt-1 border-t border-zinc-200 pt-1"
                    >
                      <div className="text-zinc-500">
                        {formatNoteTime(Date.parse(note.at))}
                      </div>
                      <p className="whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              ) : null
            }
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
          {[...noteBars.keys()].map((t) => (
            <ReferenceLine
              key={t}
              x={t}
              yAxisId={series[0].ticker}
              stroke={NOTE_COLOR}
              strokeDasharray="4 3"
            />
          ))}
          {draft && (
            <ReferenceLine
              x={draft.at}
              yAxisId={series[0].ticker}
              stroke={NOTE_COLOR}
            />
          )}
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
      {draft && (
        <NotePopover
          // Remounted per click, so each placement starts from an empty note.
          key={`${draft.at}-${draft.x}-${draft.y}`}
          at={draft.at}
          x={draft.x}
          y={draft.y}
          containerWidth={containerRef.current?.clientWidth ?? 0}
          onCancel={() => setDraft(null)}
          onSave={(content) => onCreateNote(draft.at, content)}
        />
      )}
    </div>
  );
}
