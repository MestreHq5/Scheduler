import Link from "next/link";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/server";
import { QuickAddTask } from "@/components/quick-add-task";
import { TaskTree } from "@/components/task-tree";
import { TagQuickAddModal } from "@/components/tag-quick-add-modal";
import { keepRecentCompletedRoots } from "@/lib/tasks";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag: tagFilter } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: tags }, { data: tagGroups }, { data: tasks }, { data: profile }] = await Promise.all([
    supabase.from("tags").select("*").eq("archived", false).order("sort_order").order("created_at"),
    supabase.from("tag_groups").select("*").order("sort_order").order("created_at"),
    supabase
      .from("tasks")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("task_drag_hold_ms").eq("id", user!.id).single(),
  ]);

  const allTags = tags ?? [];
  const allTasks = tasks ?? [];

  // Only the 3 most recently completed main tasks (and their subtree) stay
  // loaded here — older completed branches still live in the DB and reappear
  // the moment their main task is un-done. See /tasks/archive for the rest.
  const recent = keepRecentCompletedRoots(allTasks, 3);

  // Tag filter keeps a task's whole ancestor chain so the tree stays intact.
  const visible = tagFilter
    ? filterByTagKeepingAncestors(recent, tagFilter)
    : recent;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="font-display text-3xl">Tasks</h1>
        <div className="flex items-center gap-2">
          <TagQuickAddModal groups={tagGroups ?? []} />
          <Link
            href="/tasks/archive"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text transition-colors"
          >
            See all
          </Link>
        </div>
      </div>

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

      <TaskTree tasks={visible} tags={allTags} dragHoldMs={profile?.task_drag_hold_ms ?? 450} />
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
