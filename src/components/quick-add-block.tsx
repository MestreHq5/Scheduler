"use client";

import { useState, useTransition } from "react";
import type { Tag } from "@/lib/database.types";
import { createBlock } from "@/lib/actions/blocks";
import { TagSelect } from "@/components/tag-select";
import { deriveBlockTitle } from "@/lib/tags";
import { WheelDatePicker } from "@/components/wheel-date-picker";
import { CircularTimePicker } from "@/components/circular-time-picker";

export function QuickAddBlock({ tags, defaultDate }: { tags: Tag[]; defaultDate: string }) {
  const [tagId, setTagId] = useState<string | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [pending, startTransition] = useTransition();

  const selectedTag = tags.find((t) => t.id === tagId) ?? null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tagId || start >= end) return;
    startTransition(async () => {
      await createBlock({ tag_id: tagId, date, start_time: start, end_time: end });
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border p-4 space-y-3">
      <TagSelect tags={tags} value={tagId} onChange={setTagId} />

      <div className="flex gap-2 items-center flex-wrap">
        <WheelDatePicker
          value={date}
          onChange={(next) => next && setDate(next)}
          title="Block date"
          allowClear={false}
          renderTrigger={({ value, open }) => (
            <button
              type="button"
              onClick={open}
              className="rounded-lg bg-surface border border-border px-2 py-2 text-sm outline-none focus:border-accent"
            >
              {value}
            </button>
          )}
        />
        <CircularTimePicker
          value={start}
          onChange={setStart}
          title="Start time"
          renderTrigger={({ value, open }) => (
            <button
              type="button"
              onClick={open}
              className="rounded-lg bg-surface border border-border px-2 py-2 text-sm outline-none focus:border-accent"
            >
              {value}
            </button>
          )}
        />
        <span className="text-text-muted text-sm">–</span>
        <CircularTimePicker
          value={end}
          onChange={setEnd}
          title="End time"
          renderTrigger={({ value, open }) => (
            <button
              type="button"
              onClick={open}
              className="rounded-lg bg-surface border border-border px-2 py-2 text-sm outline-none focus:border-accent"
            >
              {value}
            </button>
          )}
        />
        <button
          type="submit"
          disabled={pending || !tagId || start >= end}
          className="ml-auto rounded-lg bg-accent text-bg font-semibold px-4 py-2 text-sm disabled:opacity-50"
        >
          {selectedTag ? `Add "${deriveBlockTitle(selectedTag)}"` : "Add block"}
        </button>
      </div>
    </form>
  );
}
