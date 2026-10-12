"use client";

import { useState } from "react";

import { formatNoteTime } from "@/lib/marketTime";

const WIDTH = 256;

/** A form for a note on the bar at `at`, positioned at `x`/`y` within its (relative) container. */
export default function NotePopover({
  at,
  x,
  y,
  containerWidth,
  onCancel,
  onSave,
}: {
  at: number;
  x: number;
  y: number;
  containerWidth: number;
  onCancel: () => void;
  /** Resolves to whether the note was saved. */
  onSave: (content: string) => Promise<boolean>;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    // On success the parent leaves note mode and unmounts this; on failure it shows the error.
    if (!(await onSave(content.trim()))) setSaving(false);
  };

  return (
    <div
      className="absolute z-10 cursor-auto rounded-lg border border-zinc-300 bg-white p-3 shadow-lg select-text"
      // Kept inside the chart, and below the click so it doesn't hide the spot being noted.
      style={{
        left: Math.max(0, Math.min(x - WIDTH / 2, containerWidth - WIDTH)),
        top: y + 8,
        width: WIDTH,
      }}
      // Clicks inside shouldn't reach the chart, which would place the note somewhere else.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-xs text-zinc-500">{formatNoteTime(at)}</p>
      <textarea
        autoFocus
        rows={3}
        className="w-full resize-none rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500"
        placeholder="Write a note…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        }}
      />
      <div className="mt-2 flex justify-end gap-2 text-sm">
        <button
          type="button"
          className="rounded border border-zinc-300 px-3 py-1 text-zinc-700 hover:bg-zinc-100"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!content.trim() || saving}
          className="rounded bg-zinc-900 px-3 py-1 text-white disabled:opacity-50"
          onClick={save}
        >
          Save note
        </button>
      </div>
    </div>
  );
}
