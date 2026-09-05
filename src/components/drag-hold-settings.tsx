"use client";

import { useState, useTransition } from "react";
import { changeDragHoldDuration } from "@/lib/actions/profile";

export function DragHoldSettings({ ms }: { ms: number }) {
  const [value, setValue] = useState(ms);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={200}
        max={1000}
        step={50}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="flex-1 accent-accent"
      />
      <span className="text-sm text-text-muted w-14 shrink-0">{value}ms</span>
      <button
        disabled={pending || value === ms}
        onClick={() => startTransition(() => changeDragHoldDuration(value))}
        className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50 hover:bg-surface-2"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
