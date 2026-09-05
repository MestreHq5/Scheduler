"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import type { Tag } from "@/lib/database.types";
import { Dropdown } from "@/components/dropdown";
import { RANGE_PRESET_LABELS, resolveRangePreset, type RangePreset } from "@/lib/dates";

type BlockRow = { tag_id: string | null; date: string; start_time: string; end_time: string };
type TaskRow = { tag_id: string | null; depth: number; done: boolean; completed_at: string | null };

const PRESETS: RangePreset[] = ["thisWeek", "lastWeek", "thisMonth", "lastMonth", "last3m", "last6m", "last12m"];

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Per-tag breakdown: block count, completed tasks/subtasks/sub-subtasks, and total hours for a chosen tag + interval. */
export function TagBreakdown({
  tags,
  blocks,
  tasks,
  today,
}: {
  tags: Tag[];
  blocks: BlockRow[];
  tasks: TaskRow[];
  today: string;
}) {
  const [tagId, setTagId] = useState<string | null>(tags[0]?.id ?? null);
  const [preset, setPreset] = useState<RangePreset>("thisMonth");

  const { start, end } = resolveRangePreset(preset, today);

  const stats = useMemo(() => {
    if (!tagId) return null;
    const blockRows = blocks.filter((b) => b.tag_id === tagId && b.date >= start && b.date <= end);
    const totalMinutes = blockRows.reduce(
      (sum, b) => sum + (timeToMinutes(b.end_time) - timeToMinutes(b.start_time)),
      0,
    );
    const completedTasks = tasks.filter(
      (t) =>
        t.tag_id === tagId &&
        t.done &&
        t.completed_at &&
        t.completed_at.slice(0, 10) >= start &&
        t.completed_at.slice(0, 10) <= end,
    );
    const byDepth = [0, 0, 0];
    for (const t of completedTasks) {
      if (t.depth >= 0 && t.depth <= 2) byDepth[t.depth]!++;
    }
    return {
      blockCount: blockRows.length,
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      tasksDone: byDepth[0]!,
      subtasksDone: byDepth[1]!,
      subsubtasksDone: byDepth[2]!,
    };
  }, [tagId, blocks, tasks, start, end]);

  if (tags.length === 0) return <p className="text-sm text-text-muted">No tags yet.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Dropdown
          value={tagId ?? tags[0]!.id}
          onChange={setTagId}
          className="w-44"
          options={tags.map((t) => ({ value: t.id, label: t.label }))}
        />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium border border-border transition-colors",
                preset === p ? "bg-surface-2 text-text" : "text-text-muted hover:text-text",
              )}
            >
              {RANGE_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Blocks logged" value={String(stats.blockCount)} />
          <StatTile label="Time logged" value={`${stats.hours}h ${stats.minutes}m`} />
          <StatTile label="Tasks done" value={String(stats.tasksDone)} />
          <StatTile label="Sub / sub-sub done" value={`${stats.subtasksDone} / ${stats.subsubtasksDone}`} />
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
    </div>
  );
}
