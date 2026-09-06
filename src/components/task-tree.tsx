"use client";

import { createContext, useContext, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import type { Tag, Task } from "@/lib/database.types";
import { TaskCheckbox } from "@/components/task-checkbox";
import { TagPill } from "@/components/tag-pill";
import { TagSelect } from "@/components/tag-select";
import { QuickAddTask } from "@/components/quick-add-task";
import { WheelDatePicker } from "@/components/wheel-date-picker";
import { deleteTask, updateTask, moveTask } from "@/lib/actions/tasks";
import { formatDateDMY } from "@/lib/dates";

const ROOT_DROP = "ROOT";

// Depth-based shading (v1 of the columned tree redesign) — pure gray scale
// tokens (--color-level-0/1/2 in globals.css), deliberately distinct from
// the navy-tinted surface/surface-2 tokens used everywhere else, so nesting
// reads at a glance without relying on indentation.
const LEVEL_BG: string[] = ["bg-level-0", "bg-level-1", "bg-level-2"];
const LEVEL_CARD: string[] = [
  "rounded-2xl border border-border/60 px-4 py-3",
  "rounded-xl border border-border/50 px-3.5 py-2.5 max-md:px-3 max-md:py-2",
  "rounded-lg border border-border/40 px-3 py-2 max-md:px-2.5 max-md:py-1.5",
];
// Mobile-only left indent, standing in for the desktop column-per-depth
// layout ("smaller indent instead of a whole new column") — depth 0 gets
// none. Pure margin, so it can't collide with LEVEL_CARD's own padding.
const MOBILE_INDENT: string[] = ["", "max-md:ml-4", "max-md:ml-8"];

type DragVisual = { id: string; x: number; y: number; overId: string | null };
type MoveUpdate = { id: string; newParentId: string | null };

interface TreeCtxValue {
  drag: DragVisual | null;
  invalidIdsRef: React.RefObject<Set<string>>;
  onGripPointerDown: (task: Task, e: React.PointerEvent<HTMLButtonElement>) => void;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  ensureExpanded: (id: string) => void;
}

const TreeCtx = createContext<TreeCtxValue | null>(null);

/**
 * Applies a drag-reparent to the local task list immediately, mirroring what
 * `moveTask` (src/lib/actions/tasks.ts) does server-side: the moved task's
 * direct children are promoted to independent roots first (their own
 * children, one level deeper, cascade down by one depth), then the moved
 * task itself takes on the new parent. Approximate but self-corrects once
 * the server action resolves and the page revalidates.
 */
function applyOptimisticMove(state: Task[], update: MoveUpdate): Task[] {
  const byId = new Map(state.map((t) => [t.id, t]));
  const moved = byId.get(update.id);
  if (!moved) return state;
  const newParent = update.newParentId ? (byId.get(update.newParentId) ?? null) : null;
  const movedNewDepth = newParent ? newParent.depth + 1 : 0;
  const promotedIds = new Set(state.filter((t) => t.parent_id === update.id).map((t) => t.id));
  return state.map((t) => {
    if (t.id === update.id) return { ...t, parent_id: update.newParentId, depth: movedNewDepth };
    if (promotedIds.has(t.id)) return { ...t, parent_id: null, depth: 0 };
    if (t.parent_id && promotedIds.has(t.parent_id)) return { ...t, depth: 1 };
    return t;
  });
}

export function TaskTree({
  tasks,
  tags,
  dragHoldMs = 450,
}: {
  tasks: Task[];
  tags: Tag[];
  dragHoldMs?: number;
}) {
  const [optimisticTasks, applyMove] = useOptimistic(tasks, applyOptimisticMove);

  const byParent = useMemo(() => {
    const m = new Map<string | null, Task[]>();
    for (const t of optimisticTasks) {
      const key = t.parent_id;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    return m;
  }, [optimisticTasks]);

  const byId = useMemo(() => new Map(optimisticTasks.map((t) => [t.id, t])), [optimisticTasks]);

  const [drag, setDrag] = useState<DragVisual | null>(null);
  // Fully open on load — collapsing is a user action, not a default. Seeded
  // from whichever tasks already have children on first mount; a tag filter
  // or the archive page each get their own mount (and thus their own fresh
  // full-expand), so this doesn't need to react to later `tasks` changes.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const parentIds = new Set<string>();
    for (const t of tasks) {
      if (t.parent_id) parentIds.add(t.parent_id);
    }
    return parentIds;
  });
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const invalidIdsRef = useRef<Set<string>>(new Set());
  const pendingHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function ensureExpanded(id: string) {
    setExpandedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  function collectInvalidIds(taskId: string) {
    const s = new Set<string>([taskId]);
    const stack = [taskId];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const child of byParent.get(cur) ?? []) {
        if (!s.has(child.id)) {
          s.add(child.id);
          stack.push(child.id);
        }
      }
    }
    return s;
  }

  function resolveOverId(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    if (el.closest("[data-task-drop-root]")) return ROOT_DROP;
    const row = el.closest("[data-task-id]") as HTMLElement | null;
    return row?.dataset.taskId ?? null;
  }

  function cleanupWindowListeners() {
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerCancel);
    document.body.style.userSelect = "";
  }

  function onWindowPointerMove(e: PointerEvent) {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    const overId = resolveOverId(e.clientX, e.clientY);
    setDrag({ id: dragRef.current.id, x: e.clientX, y: e.clientY, overId });
  }

  function runMove(id: string, newParentId: string | null) {
    const movedTitle = byId.get(id)?.title ?? "Task";
    startTransition(async () => {
      applyMove({ id, newParentId });
      try {
        await moveTask(id, newParentId);
      } catch (e) {
        setError(`"${movedTitle}" couldn't be moved — ${e instanceof Error ? e.message : "something went wrong"}.`);
      }
    });
  }

  function onWindowPointerUp(e: PointerEvent) {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    const { id } = dragRef.current;
    const overId = resolveOverId(e.clientX, e.clientY);
    cleanupWindowListeners();
    dragRef.current = null;
    setDrag(null);

    if (overId === ROOT_DROP) {
      runMove(id, null);
    } else if (overId && !invalidIdsRef.current.has(overId)) {
      const target = byId.get(overId);
      if (target && target.depth < 2) {
        runMove(id, overId);
      }
    }
  }

  function onWindowPointerCancel(e: PointerEvent) {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    cleanupWindowListeners();
    dragRef.current = null;
    setDrag(null);
  }

  function startDragging(task: Task, pointerId: number, x: number, y: number) {
    dragRef.current = { id: task.id, pointerId };
    invalidIdsRef.current = collectInvalidIds(task.id);
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerCancel);
    setDrag({ id: task.id, x, y, overId: null });
  }

  function onGripPointerDown(task: Task, e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;

    if (e.pointerType === "touch") {
      const cancelPending = () => {
        if (pendingHoldTimer.current) {
          clearTimeout(pendingHoldTimer.current);
          pendingHoldTimer.current = null;
        }
        window.removeEventListener("pointermove", moveGuard);
        window.removeEventListener("pointerup", cancelPending);
        window.removeEventListener("pointercancel", cancelPending);
      };
      const moveGuard = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) cancelPending();
      };
      window.addEventListener("pointermove", moveGuard);
      window.addEventListener("pointerup", cancelPending, { once: true });
      window.addEventListener("pointercancel", cancelPending, { once: true });
      pendingHoldTimer.current = setTimeout(() => {
        window.removeEventListener("pointermove", moveGuard);
        window.removeEventListener("pointerup", cancelPending);
        window.removeEventListener("pointercancel", cancelPending);
        pendingHoldTimer.current = null;
        startDragging(task, pointerId, startX, startY);
      }, dragHoldMs);
    } else {
      startDragging(task, pointerId, startX, startY);
    }
  }

  const roots = byParent.get(null) ?? [];
  const draggedTask = drag ? byId.get(drag.id) : null;

  return (
    <TreeCtx.Provider value={{ drag, invalidIdsRef, onGripPointerDown, expandedIds, toggleExpand, ensureExpanded }}>
      {error && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 hover:opacity-70" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {drag && (
        <div
          data-task-drop-root
          className={clsx(
            "mb-3 rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs font-medium transition-colors",
            drag.overId === ROOT_DROP
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-text-muted",
          )}
        >
          Move to top level
        </div>
      )}

      {roots.length === 0 ? (
        <p className="text-sm text-text-muted">Nothing here yet.</p>
      ) : (
        // Each root gets its own 3-column group, stacked vertically — this is
        // what guarantees the next root always starts below the previous
        // root's *entire* expanded subtree (its tallest column), rather than
        // three tree-wide columns racing independently at different speeds.
        <div className="space-y-8">
          {roots.map((root) => {
            const children = expandedIds.has(root.id) ? (byParent.get(root.id) ?? []) : [];
            const grandchildren = children
              .filter((c) => expandedIds.has(c.id))
              .flatMap((c) => byParent.get(c.id) ?? []);
            return (
              <div key={root.id} className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-5 items-start">
                <ul>
                  <TaskNode task={root} tags={tags} byParent={byParent} byId={byId} />
                </ul>
                {children.length > 0 && (
                  <ul className="space-y-5">
                    {children.map((task) => (
                      <TaskNode key={task.id} task={task} tags={tags} byParent={byParent} byId={byId} />
                    ))}
                  </ul>
                )}
                {grandchildren.length > 0 && (
                  <ul className="space-y-5">
                    {grandchildren.map((task) => (
                      <TaskNode key={task.id} task={task} tags={tags} byParent={byParent} byId={byId} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {drag && draggedTask && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface-2 border border-accent px-3 py-1.5 text-xs font-medium shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          {draggedTask.title}
        </div>
      )}
    </TreeCtx.Provider>
  );
}

function TaskNode({
  task,
  tags,
  byParent,
  byId,
}: {
  task: Task;
  tags: Tag[];
  byParent: Map<string | null, Task[]>;
  byId: Map<string, Task>;
}) {
  const ctx = useContext(TreeCtx);
  const children = byParent.get(task.id) ?? [];
  const hasChildren = children.length > 0;
  const canNest = task.depth < 2;
  const expanded = ctx?.expandedIds.has(task.id) ?? false;

  const [addingChild, setAddingChild] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [editingTag, setEditingTag] = useState(false);
  const [, startTransition] = useTransition();

  const tag = tags.find((t) => t.id === task.tag_id) ?? null;
  const parentTask = task.parent_id ? (byId.get(task.parent_id) ?? null) : null;

  const dragging = ctx?.drag ?? null;
  const isBeingDragged = dragging?.id === task.id;
  const isInvalidDropTarget =
    !!dragging &&
    !isBeingDragged &&
    (task.depth === 2 || (ctx?.invalidIdsRef.current.has(task.id) ?? false));
  const isHoveredValidTarget = !!dragging && dragging.overId === task.id && !isInvalidDropTarget && !isBeingDragged;

  function saveTitle() {
    setEditingTitle(false);
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === task.title) {
      setTitleValue(task.title);
      return;
    }
    startTransition(() => updateTask(task.id, { title: trimmed }));
  }

  function saveDate(next: string | null) {
    if (next === task.due_date) return;
    startTransition(() => updateTask(task.id, { due_date: next }));
  }

  function saveTag(id: string) {
    setEditingTag(false);
    if (id === task.tag_id) return;
    startTransition(() => updateTask(task.id, { tag_id: id }));
  }

  function removeTask() {
    if (!confirm(`Delete "${task.title}"? This can't be undone — it's removed permanently, along with any subtasks.`)) {
      return;
    }
    startTransition(() => deleteTask(task.id));
  }

  return (
    <li
      data-task-id={task.id}
      className={clsx(
        "hover:border-accent/40 transition-colors duration-500",
        LEVEL_CARD[task.depth],
        LEVEL_BG[task.depth],
        MOBILE_INDENT[task.depth],
        task.done && "opacity-50",
        isBeingDragged && "opacity-40",
        isInvalidDropTarget && "opacity-30",
        isHoveredValidTarget && "ring-2 ring-accent",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onPointerDown={(e) => ctx?.onGripPointerDown(task, e)}
          className="shrink-0 mt-1.5 p-1 -ml-1 rounded text-text-muted/40 hover:text-text-muted cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to move task"
        >
          <GripIcon />
        </button>

        <TaskCheckbox id={task.id} done={task.done} />

        <button
          type="button"
          onClick={removeTask}
          aria-label="Delete task"
          className="order-last shrink-0 mt-1 p-1 rounded text-text-muted/40 hover:text-danger transition-colors"
        >
          <TrashIcon />
        </button>

        <div className="flex-1 min-w-0">
          {parentTask && (
            <p className="md:hidden text-[11px] font-medium text-text-muted mb-1 truncate">
              ↳ under {parentTask.title}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {hasChildren && (
              <button
                onClick={() => ctx?.toggleExpand(task.id)}
                className="shrink-0 flex items-center justify-center w-5 h-5 text-xs rounded-full border border-border text-text-muted hover:text-text hover:border-accent transition-colors"
                aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
              >
                {expanded ? "▾" : "▸"}
              </button>
            )}
            {editingTitle ? (
              <input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setTitleValue(task.title);
                    setEditingTitle(false);
                  }
                }}
                autoFocus
                className="text-sm bg-transparent border-b border-accent outline-none flex-1 min-w-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="relative inline-block text-left text-sm"
              >
                {task.title}
                <span
                  className="absolute left-0 top-1/2 h-px bg-current transition-[width] duration-500 ease-out"
                  style={{ width: task.done ? "100%" : "0%" }}
                />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <button type="button" onClick={() => setEditingTag((v) => !v)} aria-label="Change tag">
              <TagPill tag={tag} />
            </button>
            {hasChildren && (
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
          <div className="mt-1">
            <WheelDatePicker
              value={task.due_date}
              onChange={saveDate}
              renderTrigger={({ open }) =>
                task.due_date ? (
                  <button type="button" onClick={open} className="text-xs text-text-muted hover:text-text">
                    due {formatDateDMY(task.due_date)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={open}
                    className="text-xs text-text-muted/60 hover:text-text-muted italic"
                  >
                    + due date
                  </button>
                )
              }
            />
          </div>

          {editingTag && (
            <div className="mt-2">
              <TagSelect tags={tags} value={task.tag_id} onChange={saveTag} />
            </div>
          )}

          {addingChild && (
            <div className="mt-2">
              <QuickAddTask
                tags={tags}
                parentId={task.id}
                defaultTagId={task.tag_id}
                compact
                onDone={() => {
                  setAddingChild(false);
                  ctx?.ensureExpanded(task.id);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="4" cy="2.5" r="1.3" />
      <circle cx="10" cy="2.5" r="1.3" />
      <circle cx="4" cy="7" r="1.3" />
      <circle cx="10" cy="7" r="1.3" />
      <circle cx="4" cy="11.5" r="1.3" />
      <circle cx="10" cy="11.5" r="1.3" />
    </svg>
  );
}
