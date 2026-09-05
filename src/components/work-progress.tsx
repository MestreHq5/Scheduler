"use client";

import { useEffect, useState } from "react";
import { nowClockInTimezone } from "@/lib/dates";

type WorkBlock = { start_time: string; end_time: string; countsAsWork: boolean };

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * A day's "work" progress: how much of today's scheduled work-tagged blocks
 * has already elapsed, out of the total. Blocks in progress count partially
 * (proportional to how much of them has passed), so the bar creeps forward
 * smoothly through the day rather than jumping once per finished block.
 */
export function WorkProgress({ blocks, timezone }: { blocks: WorkBlock[]; timezone: string }) {
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  useEffect(() => {
    function update() {
      setNowMinutes(timeToMinutes(nowClockInTimezone(timezone)));
    }
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [timezone]);

  const workBlocks = blocks.filter((b) => b.countsAsWork);
  const totalMinutes = workBlocks.reduce((sum, b) => sum + (timeToMinutes(b.end_time) - timeToMinutes(b.start_time)), 0);
  const elapsedMinutes =
    nowMinutes === null
      ? 0
      : workBlocks.reduce((sum, b) => {
          const start = timeToMinutes(b.start_time);
          const end = timeToMinutes(b.end_time);
          return sum + Math.max(0, Math.min(end, nowMinutes) - start);
        }, 0);
  const pct = totalMinutes > 0 ? Math.min(100, Math.round((elapsedMinutes / totalMinutes) * 100)) : 0;

  function fmt(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-baseline justify-between mb-2.5">
        <p className="text-sm text-text-muted">Today&apos;s work</p>
        {totalMinutes > 0 ? (
          <p className="text-sm font-medium">
            {fmt(elapsedMinutes)} <span className="text-text-muted">/ {fmt(totalMinutes)}</span>
          </p>
        ) : (
          <p className="text-sm text-text-muted">Nothing scheduled</p>
        )}
      </div>
      <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent relative overflow-hidden transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        >
          {pct > 0 && pct < 100 && (
            <span className="absolute inset-y-0 right-0 w-3 bg-white/40 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
