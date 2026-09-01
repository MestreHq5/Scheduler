"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import type { Block } from "@/lib/database.types";
import { deleteBlock } from "@/lib/actions/blocks";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekCalendar({
  weekDates,
  blocks,
  today,
}: {
  weekDates: string[];
  blocks: (Block & { tag: { label: string; color: string } | null })[];
  today: string;
}) {
  const byDate = new Map<string, typeof blocks>();
  for (const b of blocks) {
    if (!byDate.has(b.date)) byDate.set(b.date, []);
    byDate.get(b.date)!.push(b);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
      {weekDates.map((date, i) => {
        const dayBlocks = (byDate.get(date) ?? []).sort((a, b) =>
          a.start_time.localeCompare(b.start_time),
        );
        const isToday = date === today;
        return (
          <div key={date} className={clsx("rounded-xl p-3", isToday ? "bg-surface-2" : "bg-surface")}>
            <p className={clsx("text-xs font-medium mb-2", isToday ? "text-accent" : "text-text-muted")}>
              {DAY_LABELS[i]} {date.slice(5)}
            </p>
            <div className="space-y-1.5 min-h-8">
              {dayBlocks.length === 0 && <p className="text-xs text-text-muted/60">—</p>}
              {dayBlocks.map((b) => (
                <BlockCard key={b.id} block={b} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BlockCard({ block }: { block: Block & { tag: { label: string; color: string } | null } }) {
  const [pending, startTransition] = useTransition();
  const color = block.tag?.color ?? "#64748b";

  return (
    <div
      className="group rounded-lg px-2.5 py-1.5 text-xs"
      style={{ backgroundColor: `${color}22`, borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{block.title}</span>
        <button
          onClick={() => startTransition(() => deleteBlock(block.id))}
          disabled={pending}
          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-opacity"
          aria-label="Delete block"
        >
          ×
        </button>
      </div>
      <span className="text-text-muted">
        {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)}
      </span>
    </div>
  );
}
