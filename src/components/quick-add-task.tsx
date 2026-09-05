"use client";

import { useState, useTransition } from "react";
import type { Tag } from "@/lib/database.types";
import { createTask } from "@/lib/actions/tasks";
import { TagSelect } from "@/components/tag-select";
import { WheelDatePicker } from "@/components/wheel-date-picker";

export function QuickAddTask({
  tags,
  parentId = null,
  compact = false,
  onDone,
}: {
  tags: Tag[];
  parentId?: string | null;
  compact?: boolean;
  onDone?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [tagId, setTagId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(!compact);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await createTask({
        title: title.trim(),
        tag_id: tagId,
        due_date: dueDate,
        parent_id: parentId,
      });
      setTitle("");
      setDueDate(null);
      setTagId(null);
      onDone?.();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2 items-end">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setShowTags(true)}
          placeholder={parentId ? "Subtask title" : "Add a task…"}
          className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {!parentId && (
          <div className="flex flex-col items-start">
            <span className="text-[10px] italic text-text-muted mb-0.5 pl-0.5">optional</span>
            <WheelDatePicker
              value={dueDate}
              onChange={setDueDate}
              title="Due date"
              renderTrigger={({ value, open }) => (
                <button
                  type="button"
                  onClick={open}
                  className="rounded-lg bg-surface border border-border px-2 py-2 text-sm outline-none focus:border-accent w-[9.5rem] text-left"
                >
                  {value ?? <span className="text-text-muted">Due date</span>}
                </button>
              )}
            />
          </div>
        )}
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="rounded-lg bg-accent text-bg font-semibold px-4 py-2 text-sm disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {showTags && tags.length > 0 && (
        <TagSelect tags={tags} value={tagId} onChange={setTagId} />
      )}
    </form>
  );
}
