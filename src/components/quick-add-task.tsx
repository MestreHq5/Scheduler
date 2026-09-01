"use client";

import { useState, useTransition } from "react";
import type { Tag } from "@/lib/database.types";
import { createTask } from "@/lib/actions/tasks";
import { TagSelect } from "@/components/tag-select";

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
  const [dueDate, setDueDate] = useState("");
  const [showTags, setShowTags] = useState(!compact);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await createTask({
        title: title.trim(),
        tag_id: tagId,
        due_date: dueDate || null,
        parent_id: parentId,
      });
      setTitle("");
      setDueDate("");
      setTagId(null);
      onDone?.();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setShowTags(true)}
          placeholder={parentId ? "Subtask title" : "Add a task…"}
          className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {!parentId && (
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg bg-surface border border-border px-2 py-2 text-sm outline-none focus:border-accent w-[9.5rem]"
          />
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
