"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { fetcher, POLL_MS } from "@/lib/api";
import { seriesColor } from "@/lib/seriesColors";
import type { Snapshot } from "@/lib/types";

type SortKey = "ticker" | "price" | "day_change_percent" | "volume";

const COLUMNS: { key: SortKey; label: string; title?: string }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "price", label: "Price" },
  { key: "day_change_percent", label: "Day change" },
  {
    key: "volume",
    label: "Volume (IEX)",
    // The free plan's data comes from the IEX exchange alone, so this is a fraction of the consolidated volume.
    title: "Shares traded on IEX in the latest session",
  },
];

const PRICE = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});
const VOLUME = new Intl.NumberFormat();

/** Live price, day change and volume for each ticker, sortable by column. */
export default function StockTable({ tickers }: { tickers: string[] }) {
  // Null keeps the workspace's ticker order.
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(
    null
  );
  const snapshots = useSWR<Snapshot[]>(
    `/stocks/snapshots?tickers=${encodeURIComponent(tickers.join(","))}`,
    fetcher,
    {
      keepPreviousData: true,
      refreshInterval: POLL_MS,
      dedupingInterval: POLL_MS,
      focusThrottleInterval: POLL_MS,
    }
  );

  // Previous data may include a just-removed ticker.
  const rows = (snapshots.data ?? []).filter((s) => tickers.includes(s.ticker));
  if (sort) {
    rows.sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      // Tickers without data go last either way.
      if (x === null) return 1;
      if (y === null) return -1;
      const order = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -order : order;
    });
  }

  // Click a column to sort by it, again to reverse, and a third time to go back to the workspace's order.
  const toggle = (key: SortKey) =>
    setSort(
      sort?.key !== key
        ? { key, desc: key !== "ticker" }
        : sort.desc === (key !== "ticker")
          ? { key, desc: !sort.desc }
          : null
    );

  if (snapshots.error)
    return (
      <p className="mt-6 text-sm text-red-600">
        Couldn&apos;t load prices: {snapshots.error.message}
      </p>
    );
  if (!rows.length) return null;

  return (
    <table className="mt-6 w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-zinc-500">
          {COLUMNS.map(({ key, label, title }) => (
            <th
              key={key}
              title={title}
              aria-sort={
                sort?.key === key
                  ? sort.desc
                    ? "descending"
                    : "ascending"
                  : undefined
              }
              className={`py-2 font-medium ${key === "ticker" ? "text-left" : "text-right"}`}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-zinc-900"
                onClick={() => toggle(key)}
              >
                {label}
                {sort?.key === key &&
                  (sort.desc ? (
                    <ArrowDown className="size-3" />
                  ) : (
                    <ArrowUp className="size-3" />
                  ))}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.ticker} className="border-b border-zinc-100 tabular-nums">
            <td
              className="py-2 font-medium"
              style={{ color: seriesColor(tickers.indexOf(s.ticker)) }}
            >
              {s.ticker}
            </td>
            <td className="py-2 text-right text-zinc-900">
              {s.price === null ? "—" : PRICE.format(s.price)}
            </td>
            <td
              className={`py-2 text-right ${s.day_change === null
                  ? "text-zinc-400"
                  : s.day_change >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
            >
              {s.day_change === null || s.day_change_percent === null
                ? "—"
                : `${s.day_change >= 0 ? "+" : "−"}${PRICE.format(Math.abs(s.day_change))} (${s.day_change_percent >= 0 ? "+" : "−"}${Math.abs(s.day_change_percent).toFixed(2)}%)`}
            </td>
            <td className="py-2 text-right text-zinc-900">
              {s.volume === null ? "—" : VOLUME.format(s.volume)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
