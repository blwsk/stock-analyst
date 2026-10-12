"use client";

import { useState } from "react";
import useSWR from "swr";

import PriceChart from "@/components/PriceChart";
import { fetcher } from "@/lib/api";
import { formatBarTime } from "@/lib/marketTime";
import {
  ALLOWED_TIMEFRAMES,
  DEFAULT_TIMEFRAME,
  RANGES,
  TIMEFRAMES,
  type Bar,
  type Range,
  type Timeframe,
} from "@/lib/types";

export default function StockAnalyst() {
  const [input, setInput] = useState("");
  const [ticker, setTicker] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("1M");
  const [timeframe, setTimeframe] = useState<Timeframe>("1Day");
  // Epoch ms of a window dragged out on the chart; when set, it overrides the range.
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const custom = start !== null && end !== null;
  const span = custom
    ? `start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`
    : `range=${range}`;
  const bars = useSWR<Bar[]>(
    ticker
      ? `/stocks/${encodeURIComponent(ticker)}/bars?${span}&timeframe=${timeframe}`
      : null,
    fetcher
  );
  const clearSelection = () => {
    setStart(null);
    setEnd(null);
  };

  return (
    <>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = input.trim().toUpperCase();
          if (value) setTicker(value);
        }}
      >
        <input
          className="rounded border border-zinc-300 px-3 py-1.5"
          placeholder="Ticker, e.g. AAPL"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <select
          className="rounded border border-zinc-300 px-2 py-1.5"
          value={range}
          onChange={(e) => {
            const next = e.target.value as Range;
            setRange(next);
            clearSelection();
            if (!ALLOWED_TIMEFRAMES[next].includes(timeframe)) {
              setTimeframe(DEFAULT_TIMEFRAME[next]);
            }
          }}
        >
          {RANGES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-zinc-300 px-2 py-1.5"
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as Timeframe)}
        >
          {TIMEFRAMES.map((tf) => (
            <option
              key={tf}
              value={tf}
              disabled={!ALLOWED_TIMEFRAMES[range].includes(tf)}
            >
              {tf}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-1.5 text-white"
        >
          Go
        </button>
      </form>

      {ticker && (
        <section className="mt-6">
          {custom && (
            <div className="mb-4 inline-flex items-center gap-1 rounded-md bg-zinc-200 py-1 pr-1 pl-3 text-sm text-zinc-700">
              {formatBarTime(start, timeframe)} →{" "}
              {formatBarTime(end, timeframe)}
              <button
                type="button"
                aria-label="Clear selected dates"
                className="rounded px-1.5 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900"
                onClick={clearSelection}
              >
                ✕
              </button>
            </div>
          )}
          <h2 className="text-lg font-medium">{ticker}</h2>
          <p className="mb-4 text-sm text-zinc-600">
            {custom ? "Custom" : range} ({timeframe})
          </p>
          {bars.isLoading ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : bars.error ? (
            <p className="text-sm text-red-600">Error: {bars.error.message}</p>
          ) : bars.data?.length ? (
            <PriceChart
              bars={bars.data}
              range={custom ? null : range}
              timeframe={timeframe}
              onSelect={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />
          ) : (
            <p className="text-sm text-zinc-600">No data for {ticker}.</p>
          )}
        </section>
      )}
    </>
  );
}
