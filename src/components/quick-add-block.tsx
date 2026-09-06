"use client";

import { useState, useTransition } from "react";
import type { Tag } from "@/lib/database.types";
import { createBlock } from "@/lib/actions/blocks";
import { TagSelect } from "@/components/tag-select";
import { deriveBlockTitle } from "@/lib/tags";
import { WheelDatePicker } from "@/components/wheel-date-picker";
import { CircularTimePicker } from "@/components/circular-time-picker";
import { nowClockInTimezone } from "@/lib/dates";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Defaults a new block to the next full hour from now (e.g. 9:37 → 10:00–11:00). */
function nextHourSlot(timezone: string): { start: string; end: string } {
  const [hStr] = nowClockInTimezone(timezone).split(":");
  const h = Number(hStr);
  const startH = (h + 1) % 24;
  const endH = (startH + 1) % 24;
  return { start: `${pad2(startH)}:00`, end: `${pad2(endH)}:00` };
}

export function QuickAddBlock({ tags, defaultDate, timezone }: { tags: Tag[]; defaultDate: string; timezone: string }) {
  const [tagId, setTagId] = useState<string | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [{ start, end }, setSlot] = useState(() => nextHourSlot(timezone));
  const setStart = (v: string) => setSlot((s) => ({ ...s, start: v }));
  const setEnd = (v: string) => setSlot((s) => ({ ...s, end: v }));
  const [details, setDetails] = useState("");
  const [location, setLocation] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedTag = tags.find((t) => t.id === tagId) ?? null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tagId || start >= end) return;
    startTransition(async () => {
      await createBlock({
        tag_id: tagId,
        date,
        start_time: start,
        end_time: end,
        details: details.trim() ? details.trim() : null,
        location: location.trim() ? location.trim() : null,
      });
      setDetails("");
      setLocation("");
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
          renderTrigger={({ label, open }) => (
            <button
              type="button"
              onClick={open}
              className="rounded-lg bg-surface border border-border px-2 py-2 text-sm outline-none focus:border-accent"
            >
              {label}
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
        <input
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={200}
          placeholder="Details (optional)"
          className="rounded-lg bg-surface border border-border px-2 py-2 text-sm outline-none focus:border-accent w-36"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={60}
          placeholder="Location (optional)"
          className="rounded-lg bg-surface border border-border px-2 py-2 text-sm outline-none focus:border-accent w-36"
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
