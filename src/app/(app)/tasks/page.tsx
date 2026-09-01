import Link from "next/link";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/server";
import { QuickAddTask } from "@/components/quick-add-task";
import { TaskTree } from "@/components/task-tree";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag: tagFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: tags }, { data: tasks }] = await Promise.all([
    supabase.from("tags").select("*").eq("archived", false).order("sort_order"),
    supabase
      .from("tasks")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: true }),
  ]);

  const allTags = tags ?? [];
  const allTasks = tasks ?? [];

  // Tag filter keeps a task's whole ancestor chain so the tree stays intact.
  const visible = tagFilter
    ? filterByTagKeepingAncestors(allTasks, tagFilter)
    : allTasks;

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Tasks</h1>

      <div className="mb-6">
        <QuickAddTask tags={allTags} />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Link
          href="/tasks"
          className={clsx(
            "rounded-full px-3 py-1 text-xs font-medium border border-border",
            !tagFilter ? "bg-surface-2" : "text-text-muted",
          )}
        >
          All
        </Link>
        {allTags.map((t) => (
          <Link
            key={t.id}
            href={`/tasks?tag=${t.id}`}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium border border-border",
              tagFilter === t.id ? "bg-surface-2" : "text-text-muted",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <TaskTree tasks={visible} tags={allTags} />
    </div>
  );
}

function filterByTagKeepingAncestors<T extends { id: string; parent_id: string | null; tag_id: string | null }>(
  tasks: T[],
  tagId: string,
) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const keep = new Set<string>();

  for (const t of tasks) {
    if (t.tag_id === tagId) {
      let cur: T | undefined = t;
      while (cur) {
        keep.add(cur.id);
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
      }
    }
  }

  return tasks.filter((t) => keep.has(t.id));
}
