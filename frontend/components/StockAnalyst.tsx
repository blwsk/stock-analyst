"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import PriceChart from "@/components/PriceChart";
import { fetcher, patchJSON, postJSON } from "@/lib/api";
import { formatBarTime } from "@/lib/marketTime";
import {
  ALLOWED_TIMEFRAMES,
  DEFAULT_TIMEFRAME,
  RANGES,
  TIMEFRAMES,
  type Bar,
  type ChartConfig,
  type Range,
  type Timeframe,
  type Workspace,
} from "@/lib/types";

type Chart = {
  range: Range;
  timeframe: Timeframe;
  // Epoch ms of a window dragged out on the chart; when set, it overrides the range.
  start: number | null;
  end: number | null;
};

function fromConfig(config: ChartConfig | null): Chart {
  if (!config)
    return { range: "1M", timeframe: "1Day", start: null, end: null };
  return {
    // A custom window has no range; 1M allows every timeframe, so it fits any saved window.
    range: config.range ?? "1M",
    timeframe: config.timeframe,
    start: config.start ? Date.parse(config.start) : null,
    end: config.end ? Date.parse(config.end) : null,
  };
}

function toConfig(chart: Chart): ChartConfig {
  const custom = chart.start !== null && chart.end !== null;
  return {
    range: custom ? null : chart.range,
    timeframe: chart.timeframe,
    start: custom ? new Date(chart.start!).toISOString() : null,
    end: custom ? new Date(chart.end!).toISOString() : null,
  };
}

/** Compares parsed times, since the API's ISO strings differ in precision from the browser's. */
function sameConfig(a: ChartConfig, b: ChartConfig) {
  const time = (s: string | null) => (s ? Date.parse(s) : null);
  return (
    a.range === b.range &&
    a.timeframe === b.timeframe &&
    time(a.start) === time(b.start) &&
    time(a.end) === time(b.end)
  );
}

/**
 * The ticker form and chart. Submitting the form creates a workspace and opens it, or fills in the ticker of a
 * workspace that has none. Inside a workspace, chart option changes are kept locally until saved or reverted.
 */
export default function StockAnalyst({ workspace }: { workspace?: Workspace }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [input, setInput] = useState("");
  const [chart, setChart] = useState(() =>
    fromConfig(workspace?.chart ?? null)
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ticker = workspace?.tickers[0] ?? null;
  const { range, timeframe, start, end } = chart;
  const custom = start !== null && end !== null;
  const saved = toConfig(fromConfig(workspace?.chart ?? null));
  const dirty = workspace !== undefined && !sameConfig(toConfig(chart), saved);

  const span = custom
    ? `start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`
    : `range=${range}`;
  const bars = useSWR<Bar[]>(
    ticker
      ? `/stocks/${encodeURIComponent(ticker)}/bars?${span}&timeframe=${timeframe}`
      : null,
    fetcher
  );
  const clearSelection = () => setChart({ ...chart, start: null, end: null });

  /** Runs a save or create, tracking whether it's in flight and showing any error. Resolves to whether it worked. */
  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setPending(false);
    }
  };

  const createWorkspace = (symbol: string) =>
    run(async () => {
      const created = await postJSON<Workspace>("/workspaces", {
        name: `Analyzing ${symbol}`,
        tickers: [symbol],
        chart: toConfig(chart),
      });
      await mutate("/workspaces");
      setInput("");
      router.push(`/workspace/${created.id}`);
    });

  const updateWorkspace = (body: Partial<Workspace>) =>
    run(async () => {
      const updated = await patchJSON<Workspace>(
        `/workspaces/${workspace!.id}`,
        body
      );
      await mutate(`/workspaces/${updated.id}`, updated, { revalidate: false });
      await mutate("/workspaces");
    });

  const saveChart = () => updateWorkspace({ chart: toConfig(chart) });

  const removeTicker = () =>
    updateWorkspace({
      tickers: workspace!.tickers.filter((t) => t !== ticker),
    });

  return (
    <>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = input.trim().toUpperCase();
          if (!value) return;
          if (workspace && !ticker) {
            updateWorkspace({ tickers: [value] }).then(
              (ok) => ok && setInput("")
            );
          } else {
            createWorkspace(value);
          }
        }}
      >
        <div className="flex items-center gap-1 rounded border border-zinc-300 px-1.5 focus-within:border-zinc-500">
          {ticker && (
            <span className="inline-flex items-center gap-0.5 rounded bg-zinc-200 py-0.5 pr-0.5 pl-2 text-sm font-medium text-zinc-700">
              {ticker}
              <button
                type="button"
                aria-label={`Remove ${ticker} from workspace`}
                disabled={pending}
                className="rounded px-1 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900 disabled:opacity-50"
                onClick={removeTicker}
              >
                ✕
              </button>
            </span>
          )}
          <input
            className="min-w-0 px-1.5 py-1.5 outline-none"
            placeholder={ticker ? "" : "Ticker, e.g. AAPL"}
            aria-label="Ticker"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <select
          className="rounded border border-zinc-300 px-2 py-1.5"
          value={range}
          onChange={(e) => {
            const next = e.target.value as Range;
            setChart({
              range: next,
              timeframe: ALLOWED_TIMEFRAMES[next].includes(timeframe)
                ? timeframe
                : DEFAULT_TIMEFRAME[next],
              start: null,
              end: null,
            });
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
          onChange={(e) =>
            setChart({ ...chart, timeframe: e.target.value as Timeframe })
          }
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
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-1.5 text-white disabled:opacity-50"
        >
          Go
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">Error: {error}</p>}

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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium">{ticker}</h2>
              <p className="mb-4 text-sm text-zinc-600">
                {custom ? "Custom" : range} ({timeframe})
              </p>
            </div>
            {dirty && (
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded border border-zinc-300 px-3 py-1 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                  onClick={() => setChart(fromConfig(workspace!.chart))}
                >
                  Revert changes
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded bg-zinc-900 px-3 py-1 text-white disabled:opacity-50"
                  onClick={saveChart}
                >
                  Save
                </button>
              </div>
            )}
          </div>
          {bars.isLoading ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : bars.error ? (
            <p className="text-sm text-red-600">Error: {bars.error.message}</p>
          ) : bars.data?.length ? (
            <PriceChart
              bars={bars.data}
              range={custom ? null : range}
              timeframe={timeframe}
              onSelect={(s, e) => setChart({ ...chart, start: s, end: e })}
            />
          ) : (
            <p className="text-sm text-zinc-600">No data for {ticker}.</p>
          )}
        </section>
      )}
    </>
  );
}
