"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import PriceChart, { type Series } from "@/components/PriceChart";
import { fetcher, patchJSON, postJSON } from "@/lib/api";
import { formatBarTime, formatNoteTime } from "@/lib/marketTime";
import { seriesColor } from "@/lib/seriesColors";
import {
  ALLOWED_TIMEFRAMES,
  DEFAULT_TIMEFRAME,
  RANGES,
  TIMEFRAMES,
  type ChartConfig,
  type Note,
  type Range,
  type TickerBars,
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

/** The default workspace name, e.g. "Analyzing AAPL, MSFT". */
function workspaceName(tickers: string[]) {
  return `Analyzing ${tickers.join(", ")}`;
}

/** A ticker change, renamed to match; a workspace left with no tickers keeps its name. */
function withTickers(tickers: string[]): Partial<Workspace> {
  return tickers.length
    ? { tickers, name: workspaceName(tickers) }
    : { tickers };
}

/**
 * The ticker form and chart. Submitting the form adds the ticker to the open workspace, or creates a workspace for
 * it. Inside a workspace, chart option changes are kept locally until saved or reverted.
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
  // While on, chart clicks place a note rather than select a window; saving a note turns it off.
  const [noteMode, setNoteMode] = useState(false);

  const tickers = workspace?.tickers ?? [];
  const notesKey = workspace ? `/workspaces/${workspace.id}/notes` : null;
  const notes = useSWR<Note[]>(notesKey, fetcher);
  const { range, timeframe, start, end } = chart;
  const custom = start !== null && end !== null;
  const saved = toConfig(fromConfig(workspace?.chart ?? null));
  const dirty = workspace !== undefined && !sameConfig(toConfig(chart), saved);

  const span = custom
    ? `start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`
    : `range=${range}`;
  const bars = useSWR<TickerBars[]>(
    tickers.length
      ? `/stocks/bars?tickers=${encodeURIComponent(tickers.join(","))}&${span}&timeframe=${timeframe}`
      : null,
    fetcher,
    // Keep showing the current lines while an added ticker's bars load.
    { keepPreviousData: true }
  );
  // Colored by position in the workspace, so a ticker keeps its color as others load; previous data may still
  // include a just-removed ticker.
  const series: Series[] = (bars.data ?? []).flatMap(({ ticker, data }) =>
    tickers.includes(ticker)
      ? [{ ticker, data, color: seriesColor(tickers.indexOf(ticker)) }]
      : []
  );
  // Only once the response includes the ticker; while an added ticker loads, the previous data lacks it.
  const noData = (ticker: string) =>
    bars.data?.some((s) => s.ticker === ticker && s.data.length === 0);
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
        name: workspaceName([symbol]),
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

  const createNote = (at: number, content: string) =>
    run(async () => {
      await postJSON<Note>(notesKey!, {
        content,
        at: new Date(at).toISOString(),
      });
      await notes.mutate();
      setNoteMode(false);
    });

  const saveChart = () => updateWorkspace({ chart: toConfig(chart) });

  const removeTicker = (ticker: string) =>
    updateWorkspace(withTickers(tickers.filter((t) => t !== ticker)));

  return (
    <>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = input.trim().toUpperCase();
          if (!value) return;
          if (!workspace) {
            createWorkspace(value);
          } else if (tickers.includes(value)) {
            setInput("");
          } else {
            updateWorkspace(withTickers([...tickers, value])).then(
              (ok) => ok && setInput("")
            );
          }
        }}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded border border-zinc-300 px-1.5 focus-within:border-zinc-500">
          {tickers.map((ticker) => (
            <span
              key={ticker}
              className="inline-flex items-center gap-0.5 rounded bg-zinc-200 py-0.5 pr-0.5 pl-2 text-sm font-medium text-zinc-700"
            >
              {ticker}
              <button
                type="button"
                aria-label={`Remove ${ticker} from workspace`}
                disabled={pending}
                className="rounded px-1 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900 disabled:opacity-50"
                onClick={() => removeTicker(ticker)}
              >
                ✕
              </button>
            </span>
          ))}
          <input
            className="min-w-16 flex-1 px-1.5 py-1.5 outline-none"
            placeholder={tickers.length ? "Add a ticker" : "Ticker, e.g. AAPL"}
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

      {tickers.length > 0 && (
        <section className="mt-6">
          {/* The window chip and the actions share a row; the empty div keeps the actions right-aligned. */}
          <div className="mb-4 flex items-center justify-between gap-4">
            {custom ? (
              <div className="inline-flex items-center gap-1 rounded-md bg-zinc-200 py-1 pr-1 pl-3 text-sm text-zinc-700">
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
            ) : (
              <div />
            )}
            <div className="flex gap-2 text-sm">
              {dirty && (
                <>
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
                </>
              )}
              <button
                type="button"
                aria-pressed={noteMode}
                className={`rounded border px-3 py-1 ${noteMode ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"}`}
                onClick={() => setNoteMode(!noteMode)}
              >
                Create note
              </button>
            </div>
          </div>
          <h2 className="flex flex-wrap gap-x-3 text-lg font-medium">
            {tickers.map((ticker, i) => (
              <span key={ticker} style={{ color: seriesColor(i) }}>
                {ticker}
                {noData(ticker) && (
                  <span className="ml-1 text-sm font-normal text-zinc-400">
                    (no data)
                  </span>
                )}
              </span>
            ))}
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            {custom ? "Custom" : range} ({timeframe})
          </p>
          {noteMode && (
            <p className="mb-2 text-sm text-zinc-500">
              Click the chart to place a note.
            </p>
          )}
          {bars.isLoading && !bars.data ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : bars.error ? (
            <p className="text-sm text-red-600">Error: {bars.error.message}</p>
          ) : series.some((s) => s.data.length > 0) ? (
            <PriceChart
              series={series.filter((s) => s.data.length > 0)}
              range={custom ? null : range}
              timeframe={timeframe}
              notes={notes.data ?? []}
              noteMode={noteMode}
              onSelect={(s, e) => setChart({ ...chart, start: s, end: e })}
              onCreateNote={createNote}
            />
          ) : (
            <p className="text-sm text-zinc-600">
              No data for {tickers.join(", ")}.
            </p>
          )}
        </section>
      )}

      {workspace && (
        <section className="mt-8">
          <h3 className="mb-2 text-sm font-medium text-zinc-700">Notes</h3>
          {notes.error ? (
            <p className="text-sm text-red-600">Error: {notes.error.message}</p>
          ) : !notes.data ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : notes.data.length ? (
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200">
              {notes.data.map((note) => (
                <li key={note.id} className="px-3 py-2 text-sm">
                  <div className="text-xs text-zinc-500">
                    {formatNoteTime(Date.parse(note.at))}
                  </div>
                  <p className="whitespace-pre-wrap text-zinc-900">
                    {note.content}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              No notes yet. Use Create note, then click the chart.
            </p>
          )}
        </section>
      )}
    </>
  );
}
