"use client";

import useSWR from "swr";

import StockAnalyst from "@/components/StockAnalyst";
import { fetcher } from "@/lib/api";
import type { Workspace } from "@/lib/types";

export default function WorkspaceView({ id }: { id: string }) {
  const { data, error } = useSWR<Workspace>(`/workspaces/${id}`, fetcher);

  if (error) {
    return <p className="text-sm text-red-600">Error: {error.message}</p>;
  }
  if (!data) return <p className="text-sm text-zinc-400">Loading…</p>;
  // Keyed so the chart options reset to the saved ones when switching workspaces.
  return <StockAnalyst key={data.id} workspace={data} />;
}
