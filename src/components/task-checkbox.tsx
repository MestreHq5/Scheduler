"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { toggleTaskDone } from "@/lib/actions/tasks";

export function TaskCheckbox({ id, done }: { id: string; done: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleTaskDone(id, !done))}
      className={clsx(
        "shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors",
        done ? "bg-success border-success" : "border-border hover:border-accent",
        pending && "opacity-60",
      )}
      aria-label={done ? "Mark as not done" : "Mark as done"}
    >
      {done && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0b0f1a" strokeWidth="3">
          <path d="m5 13 4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
