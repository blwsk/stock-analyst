"use client";

import { useState } from "react";
import useSWR from "swr";

import PriceChart from "@/components/PriceChart";
import { API_URL, fetcher } from "@/lib/api";
import {
  ALLOWED_TIMEFRAMES,
  DEFAULT_TIMEFRAME,
  RANGES,
  TIMEFRAMES,
  type Bar,
  type Range,
  type Timeframe,
} from "@/lib/types";

type Health = { status: string };

export default function Home() {
  const health = useSWR<Health>("/health", fetcher);
  const [input, setInput] = useState("");
  const [ticker, setTicker] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("1M");
  const [timeframe, setTimeframe] = useState<Timeframe>("1Day");
  const bars = useSWR<Bar[]>(
    ticker
      ? `/stocks/${encodeURIComponent(ticker)}/bars?range=${range}&timeframe=${timeframe}`
      : null,
    fetcher
  );

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Stock Analyst</h1>
      <p className="mt-4 text-sm text-zinc-600">
        Backend ({API_URL}):{" "}
        <span
          className={
            health.error
              ? "font-medium text-red-600"
              : health.isLoading
                ? "text-zinc-400"
                : "font-medium text-green-600"
          }
        >
          {health.isLoading
            ? "checking…"
            : health.error
              ? `error: ${health.error.message}`
              : health.data?.status}
        </span>
      </p>

      <form
        className="mt-8 flex gap-2"
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
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-medium">
            {ticker} — {range} ({timeframe})
          </h2>
          {bars.isLoading ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : bars.error ? (
            <p className="text-sm text-red-600">Error: {bars.error.message}</p>
          ) : bars.data?.length ? (
            <PriceChart bars={bars.data} range={range} timeframe={timeframe} />
          ) : (
            <p className="text-sm text-zinc-600">No data for {ticker}.</p>
          )}
        </section>
      )}
    </main>
  );
}
