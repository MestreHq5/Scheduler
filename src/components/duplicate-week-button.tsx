"use client";

import { useTransition } from "react";
import { duplicateWeek } from "@/lib/actions/blocks";

export function DuplicateWeekButton({
  sourceMonday,
  targetMonday,
}: {
  sourceMonday: string;
  targetMonday: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => duplicateWeek(sourceMonday, targetMonday))}
      disabled={pending}
      className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text disabled:opacity-50"
      title="Copies this week's blocks onto next week. Existing blocks there are left as-is — overlaps are yours to resolve."
    >
      {pending ? "Duplicating…" : "Duplicate → next week"}
    </button>
  );
}
