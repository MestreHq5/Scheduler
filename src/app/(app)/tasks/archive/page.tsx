import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TaskTree } from "@/components/task-tree";
import { rootIdOf } from "@/lib/tasks";

const PAGE_SIZE = 5;

export default async function TasksArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  const [{ data: tags }, { data: doneTasks }] = await Promise.all([
    supabase.from("tags").select("*").eq("archived", false).order("sort_order").order("created_at"),
    supabase
      .from("tasks")
      .select("*")
      .eq("archived", false)
      .eq("done", true)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false }),
  ]);

  const allTags = tags ?? [];
  const tasks = doneTasks ?? [];
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // Query order (completed_at desc) is preserved through this filter, so
  // roots are already most-recently-completed first.
  const roots = tasks.filter((t) => t.parent_id === null);
  const totalPages = Math.max(1, Math.ceil(roots.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageRootIds = new Set(
    roots.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => r.id),
  );

  const visible = tasks.filter((t) => pageRootIds.has(rootIdOf(t, byId)));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <Link href="/tasks" className="text-sm text-text-muted hover:text-text">
            ← Tasks
          </Link>
          <h1 className="font-display text-3xl mt-1">Completed</h1>
        </div>
        <p className="text-xs text-text-muted">
          {roots.length} main task{roots.length === 1 ? "" : "s"}
        </p>
      </div>

      {roots.length === 0 ? (
        <p className="text-sm text-text-muted">No completed main tasks yet.</p>
      ) : (
        <TaskTree tasks={visible} tags={allTags} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <PageLink page={page - 1} disabled={page <= 1}>
            ← prev
          </PageLink>
          <p className="text-xs text-text-muted">
            Page {page} of {totalPages}
          </p>
          <PageLink page={page + 1} disabled={page >= totalPages}>
            next →
          </PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="text-sm text-text-muted/40">{children}</span>;
  }
  return (
    <Link href={`/tasks/archive?page=${page}`} className="text-sm text-text-muted hover:text-text">
      {children}
    </Link>
  );
}
