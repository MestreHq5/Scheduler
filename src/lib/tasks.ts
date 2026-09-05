import type { Task } from "@/lib/database.types";

/** Walks a task's parent chain (within the given set) up to its root ancestor's id. */
export function rootIdOf<T extends Pick<Task, "id" | "parent_id">>(task: T, byId: Map<string, T>): string {
  let cur: T = task;
  while (cur.parent_id) {
    const parent = byId.get(cur.parent_id);
    if (!parent) break;
    cur = parent;
  }
  return cur.id;
}

/**
 * Keeps every not-done branch, plus only the `limit` most-recently-completed
 * main (root) tasks and their full subtree. Everything else stays in the DB
 * untouched — this is purely a display filter for the main Tasks view, see
 * /tasks/archive for the rest. Ordered by `completed_at`; falls back to
 * `updated_at` only for legacy rows completed before that column existed.
 */
export function keepRecentCompletedRoots<T extends Task>(tasks: T[], limit: number): T[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const roots = tasks.filter((t) => t.parent_id === null);
  const doneRootIds = roots
    .filter((t) => t.done)
    .sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at))
    .slice(0, limit)
    .map((t) => t.id);
  const keepDoneRoots = new Set(doneRootIds);

  return tasks.filter((t) => {
    const root = byId.get(rootIdOf(t, byId)) ?? t;
    return !root.done || keepDoneRoots.has(root.id);
  });
}
