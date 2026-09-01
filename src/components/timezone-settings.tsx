"use client";

import { useState, useTransition } from "react";
import { changeTimezone } from "@/lib/actions/profile";

export function TimezoneSettings({ timezone }: { timezone: string }) {
  const [value, setValue] = useState(timezone);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 items-center">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        disabled={pending || value === timezone}
        onClick={() => startTransition(() => changeTimezone(value))}
        className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50 hover:bg-surface-2"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
