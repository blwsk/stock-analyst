"use client";

import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/api";
import type { Workspace } from "@/lib/types";

const UPDATED_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export default function SidePanel() {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  // The API returns workspaces most recently updated first.
  const workspaces = useSWR<Workspace[]>("/workspaces", fetcher);

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden transition-[width] duration-200 ${open ? "w-80" : "w-7"}`}
    >
      {/* Collapsed, the panel is exactly the button's width (16px icon + 2 × 6px padding), so the page padding and the gap beside it match. */}
      <div className="flex items-center justify-between">
        {open && (
          <div className="flex items-center gap-1">
            <h2 className="pl-2 text-sm font-medium text-zinc-700">
              Stock Analyst
            </h2>
            {/* /workspace asks the agent to create workspaces. */}
            <Link
              href="/workspace"
              aria-label="Create workspace"
              title="Create workspace"
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900"
            >
              <Plus className="size-4" />
            </Link>
          </div>
        )}
        <button
          type="button"
          aria-label={open ? "Collapse side panel" : "Expand side panel"}
          aria-expanded={open}
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeftOpen className="size-4" />
          )}
        </button>
      </div>
      {open &&
        (workspaces.data?.length ? (
          <ul className="mt-2 flex flex-col gap-0.5 overflow-y-auto">
            {workspaces.data.map((workspace) => {
              const href = `/workspace/${workspace.id}`;
              return (
                <li key={workspace.id}>
                  <Link
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                    className={`block rounded-md px-2 py-1.5 text-sm hover:bg-zinc-300 ${pathname === href ? "bg-zinc-300" : ""}`}
                  >
                    <div className="truncate text-zinc-900">
                      {workspace.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(workspace.updated_at).toLocaleString(
                        undefined,
                        UPDATED_FORMAT
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-2 flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
            {workspaces.error
              ? `Couldn't load workspaces: ${workspaces.error.message}`
              : workspaces.isLoading
                ? "Loading…"
                : "No workspaces yet. Describe what you want to analyze to create one."}
          </div>
        ))}
    </aside>
  );
}
