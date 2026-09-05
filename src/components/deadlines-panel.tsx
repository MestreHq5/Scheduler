"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { TagPill } from "@/components/tag-pill";
import { TaskCheckbox } from "@/components/task-checkbox";
import { addDays } from "@/lib/dates";

export type DeadlineTask = {
  id: string;
  title: string;
  done: boolean;
  due_date: string;
  tag: { label: string; color: string } | null;
};

const PRESETS = [
  { key: "today", label: "Today", days: 0 },
  { key: "3d", label: "3 days", days: 3 },
  { key: "week", label: "Week", days: 7 },
  { key: "2w", label: "2 weeks", days: 14 },
] as const;

export function DeadlinesPanel({ tasks, today }: { tasks: DeadlineTask[]; today: string }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("week");
  const days = PRESETS.find((p) => p.key === preset)!.days;
  const cutoff = addDays(today, days);

  const visible = tasks
    .filter((t) => t.due_date <= cutoff)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium border border-border transition-colors",
              preset === p.key ? "bg-surface-2 text-text" : "text-text-muted hover:text-text",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-text-muted">No deadlines in this range.</p>
      ) : (
        <ul className="space-y-1">
          {visible.map((t) => {
            const overdue = t.due_date < today;
            return (
              <li key={t.id} className="flex items-center gap-3 px-1 py-1.5">
                <TaskCheckbox id={t.id} done={t.done} />
                <span className="text-sm flex-1">{t.title}</span>
                <TagPill tag={t.tag} />
                <span className={clsx("text-xs shrink-0", overdue ? "text-danger" : "text-text-muted")}>
                  {t.due_date === today ? "today" : t.due_date.slice(5)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
