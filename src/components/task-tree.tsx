"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { Tag, Task } from "@/lib/database.types";
import { TaskCheckbox } from "@/components/task-checkbox";
import { TagPill } from "@/components/tag-pill";
import { QuickAddTask } from "@/components/quick-add-task";

export function TaskTree({ tasks, tags }: { tasks: Task[]; tags: Tag[] }) {
  const byParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const key = t.parent_id;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }

  const roots = byParent.get(null) ?? [];
  if (roots.length === 0) {
    return <p className="text-sm text-text-muted">Nothing here yet.</p>;
  }

  return (
    <ul className="space-y-1">
      {roots.map((task) => (
        <TaskNode key={task.id} task={task} byParent={byParent} tags={tags} />
      ))}
    </ul>
  );
}

function TaskNode({
  task,
  byParent,
  tags,
}: {
  task: Task;
  byParent: Map<string | null, Task[]>;
  tags: Tag[];
}) {
  const children = byParent.get(task.id) ?? [];
  const [expanded, setExpanded] = useState(true);
  const [addingChild, setAddingChild] = useState(false);
  const tag = tags.find((t) => t.id === task.tag_id) ?? null;
  const canNest = task.depth < 2;

  return (
    <li>
      <div
        className={clsx(
          "flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-surface transition-colors",
          task.done && "opacity-50",
        )}
      >
        <TaskCheckbox id={task.id} done={task.done} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {children.length > 0 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-text-muted text-xs w-4"
                aria-label="Toggle children"
              >
                {expanded ? "▾" : "▸"}
              </button>
            )}
            <span className={clsx("text-sm", task.done && "line-through")}>{task.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <TagPill tag={tag} />
            {task.due_date && (
              <span className="text-xs text-text-muted">due {task.due_date}</span>
            )}
            {children.length > 0 && (
              <span className="text-xs text-text-muted">
                {children.filter((c) => c.done).length}/{children.length}
              </span>
            )}
            {canNest && (
              <button
                onClick={() => setAddingChild((v) => !v)}
                className="text-xs text-accent hover:opacity-80"
              >
                + subtask
              </button>
            )}
          </div>
          {addingChild && (
            <div className="mt-2">
              <QuickAddTask
                tags={tags}
                parentId={task.id}
                compact
                onDone={() => setAddingChild(false)}
              />
            </div>
          )}
        </div>
      </div>

      {expanded && children.length > 0 && (
        <ul className="ml-6 border-l border-border pl-3 space-y-1">
          {children.map((child) => (
            <TaskNode key={child.id} task={child} byParent={byParent} tags={tags} />
          ))}
        </ul>
      )}
    </li>
  );
}
