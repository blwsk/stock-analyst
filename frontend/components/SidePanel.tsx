"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";

export default function SidePanel() {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden transition-[width] duration-200 ${open ? "w-80" : "w-7"}`}
    >
      {/* Collapsed, the panel is exactly the button's width (16px icon + 2 × 6px padding), so the page padding and the gap beside it match. */}
      <div className="flex items-center justify-between">
        {open && (
          <h2 className="pl-2 text-sm font-medium text-zinc-700">
            Stock Analyst
          </h2>
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
      {open && (
        <div className="mt-2 flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
          Nothing here yet.
        </div>
      )}
    </aside>
  );
}
