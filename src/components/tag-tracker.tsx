"use client";

import { useState } from "react";
import type { Tag } from "@/lib/database.types";
import { contrastText } from "@/lib/color";

const MAX_PER_TAG = 5;

export type TrackedBlock = {
  id: string;
  tag_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
};

export function TagTracker({ tags, blocks }: { tags: Tag[]; blocks: TrackedBlock[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {tags.map((tag) => {
          const active = selected.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className="rounded-full px-3 py-1.5 text-sm font-medium border transition-colors"
              style={
                active
                  ? { backgroundColor: tag.color, color: contrastText(tag.color), borderColor: "transparent" }
                  : { borderColor: "var(--color-border)", color: "var(--color-text-muted)" }
              }
            >
              {tag.label}
            </button>
          );
        })}
      </div>

      {selected.size === 0 ? (
        <p className="text-sm text-text-muted">Pick a tag to track its next occurrences.</p>
      ) : (
        <div className="space-y-4">
          {tags
            .filter((t) => selected.has(t.id))
            .map((tag) => {
              const upcoming = blocks
                .filter((b) => b.tag_id === tag.id)
                .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
                .slice(0, MAX_PER_TAG);
              return (
                <div key={tag.id}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: tag.color }}>
                    {tag.label}
                  </p>
                  {upcoming.length === 0 ? (
                    <p className="text-xs text-text-muted">Nothing scheduled.</p>
                  ) : (
                    <ul className="space-y-1">
                      {upcoming.map((b) => (
                        <li key={b.id} className="flex items-center justify-between text-sm px-1">
                          <span className="truncate">{b.title}</span>
                          <span className="text-xs text-text-muted shrink-0 ml-2">
                            {b.date.slice(5)} · {b.start_time.slice(0, 5)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
