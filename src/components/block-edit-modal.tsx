"use client";

import { useEffect, useState, useTransition } from "react";
import type { Block, Tag } from "@/lib/database.types";
import { deleteBlock, updateBlock } from "@/lib/actions/blocks";
import { TagSelect } from "@/components/tag-select";
import { WheelDatePicker } from "@/components/wheel-date-picker";
import { CircularTimePicker } from "@/components/circular-time-picker";

type BlockWithTag = Block & { tag: { label: string; color: string } | null };

export function BlockEditModal({
  block,
  tags,
  onClose,
}: {
  block: BlockWithTag;
  tags: Tag[];
  onClose: () => void;
}) {
  const [tagId, setTagId] = useState(block.tag_id);
  const [date, setDate] = useState(block.date);
  const [start, setStart] = useState(block.start_time.slice(0, 5));
  const [end, setEnd] = useState(block.end_time.slice(0, 5));
  const [details, setDetails] = useState(block.details ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tagId || start >= end) return;
    startTransition(async () => {
      await updateBlock(block.id, {
        tag_id: tagId,
        date,
        start_time: start,
        end_time: end,
        details: details.trim() ? details.trim() : null,
      });
      onClose();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteBlock(block.id);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface border border-border p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg">Edit block</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text">
            ×
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
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
                  className="rounded-lg bg-surface-2 border border-border px-2 py-2 text-sm outline-none focus:border-accent"
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
                  className="rounded-lg bg-surface-2 border border-border px-2 py-2 text-sm outline-none focus:border-accent"
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
                  className="rounded-lg bg-surface-2 border border-border px-2 py-2 text-sm outline-none focus:border-accent"
                >
                  {value}
                </button>
              )}
            />
          </div>

          <div>
            <input
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={30}
              placeholder="Details (e.g. room number)"
              className="w-full rounded-lg bg-surface-2 border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="text-[11px] text-text-muted mt-1 text-right">{details.length}/30</p>
          </div>

          {start >= end && <p className="text-xs text-danger">End time must be after start time.</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:text-danger hover:border-danger/50 transition-colors disabled:opacity-50"
            >
              Delete
            </button>
            <button
              type="submit"
              disabled={pending || !tagId || start >= end}
              className="ml-auto rounded-lg bg-accent text-bg font-semibold px-4 py-2 text-sm disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
