"use client";

import Link from "next/link";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import useSWR from "swr";

import { fetcher } from "@/lib/api";
import { formatBarTime } from "@/lib/marketTime";
import { seriesColor } from "@/lib/seriesColors";
import type { TickerBars, Workspace } from "@/lib/types";

type Row = { t: number; values: Record<string, number> };

/** Each ticker's closes as % change from its first bar, so tickers of any price share one axis. */
function toRows(series: TickerBars[]): Row[] {
  const rows = new Map<number, Row>();
  for (const { ticker, data } of series) {
    const first = data[0]?.close;
    for (const bar of data) {
      const t = Date.parse(bar.timestamp);
      const row = rows.get(t) ?? { t, values: {} };
      row.values[ticker] = (bar.close / first - 1) * 100;
      rows.set(t, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.t - b.t);
}

/** A card for a workspace, with a sparkline of its chart, linking to it. */
export default function WorkspacePreview({
  workspace,
}: {
  workspace: Workspace;
}) {
  const { id, name, tickers, chart } = workspace;
  const span = chart?.start
    ? `start=${chart.start}&end=${chart.end}`
    : `range=${chart?.range ?? "1M"}`;
  const timeframe = chart?.timeframe ?? "1Day";
  const bars = useSWR<TickerBars[]>(
    tickers.length
      ? `/stocks/bars?tickers=${encodeURIComponent(tickers.join(","))}&${encodeURI(span)}&timeframe=${timeframe}`
      : null,
    fetcher
  );
  const rows = toRows(bars.data ?? []);

  return (
    <Link
      href={`/workspace/${id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400 hover:shadow"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="truncate font-medium text-zinc-900">{name}</h3>
        <span className="shrink-0 text-xs text-zinc-500">
          {chart?.start && chart.end
            ? `${formatBarTime(Date.parse(chart.start), timeframe)} → ${formatBarTime(Date.parse(chart.end), timeframe)}`
            : (chart?.range ?? "1M")}{" "}
          · {timeframe}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-sm font-medium">
        {tickers.map((ticker, i) => (
          <span key={ticker} style={{ color: seriesColor(i) }}>
            {ticker}
          </span>
        ))}
      </div>
      <div className="mt-3 h-24">
        {bars.error ? (
          <p className="text-sm text-red-600">
            Couldn&apos;t load prices: {bars.error.message}
          </p>
        ) : rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows}>
              <YAxis hide domain={["auto", "auto"]} />
              {tickers.map((ticker, i) => (
                <Line
                  key={ticker}
                  // A function, since a string key like "BRK.B" would be read as a nested path.
                  dataKey={(row: Row) => row.values[ticker]}
                  stroke={seriesColor(i)}
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-zinc-400">
            {bars.isLoading ? "Loading prices…" : "No price data."}
          </p>
        )}
      </div>
    </Link>
  );
}
