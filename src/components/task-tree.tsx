"use client";

import { createContext, useContext, useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import type { Tag, Task } from "@/lib/database.types";
import { TaskCheckbox } from "@/components/task-checkbox";
import { TagPill } from "@/components/tag-pill";
import { QuickAddTask } from "@/components/quick-add-task";
import { WheelDatePicker } from "@/components/wheel-date-picker";
import { updateTask, moveTask } from "@/lib/actions/tasks";

const ROOT_DROP = "ROOT";

type DragVisual = { id: string; x: number; y: number; overId: string | null };

interface DragCtxValue {
  drag: DragVisual | null;
  invalidIdsRef: React.RefObject<Set<string>>;
  onGripPointerDown: (task: Task, e: React.PointerEvent<HTMLButtonElement>) => void;
}

const DragCtx = createContext<DragCtxValue | null>(null);

export function TaskTree({
  tasks,
  tags,
  dragHoldMs = 450,
}: {
  tasks: Task[];
  tags: Tag[];
  dragHoldMs?: number;
}) {
  const byParent = useMemo(() => {
    const m = new Map<string | null, Task[]>();
    for (const t of tasks) {
      const key = t.parent_id;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    return m;
  }, [tasks]);

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const [drag, setDrag] = useState<DragVisual | null>(null);
  const [, startTransition] = useTransition();
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const invalidIdsRef = useRef<Set<string>>(new Set());
  const pendingHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function onWindowPointerUp(e: PointerEvent) {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    const { id } = dragRef.current;
    const overId = resolveOverId(e.clientX, e.clientY);
    cleanupWindowListeners();
    dragRef.current = null;
    setDrag(null);

    if (overId === ROOT_DROP) {
      startTransition(() => {
        moveTask(id, null);
      });
    } else if (overId && !invalidIdsRef.current.has(overId)) {
      const target = byId.get(overId);
      if (target && target.depth < 2) {
        startTransition(() => {
          moveTask(id, overId);
        });
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
    <DragCtx.Provider value={{ drag, invalidIdsRef, onGripPointerDown }}>
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
        <ul className="space-y-4">
          {roots.map((task) => (
            <TaskNode key={task.id} task={task} byParent={byParent} tags={tags} />
          ))}
        </ul>
      )}

      {drag && draggedTask && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface-2 border border-accent px-3 py-1.5 text-xs font-medium shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          {draggedTask.title}
        </div>
      )}
    </DragCtx.Provider>
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
  const [expanded, setExpanded] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [, startTransition] = useTransition();
  const tag = tags.find((t) => t.id === task.tag_id) ?? null;
  const canNest = task.depth < 2;
  const hasChildren = children.length > 0;

  const dragCtx = useContext(DragCtx);
  const dragging = dragCtx?.drag ?? null;
  const isBeingDragged = dragging?.id === task.id;
  const isInvalidDropTarget =
    !!dragging &&
    !isBeingDragged &&
    (task.depth === 2 || (dragCtx?.invalidIdsRef.current.has(task.id) ?? false));
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

  const isRoot = task.depth === 0;

  return (
    <li
      className={clsx(
        isRoot && "rounded-2xl border border-border bg-surface/40 overflow-hidden",
      )}
    >
      <div
        data-task-id={task.id}
        className={clsx(
          "flex items-start gap-2 hover:bg-surface transition-colors duration-500",
          isRoot ? "px-4 py-3" : "rounded-xl px-3 py-2.5",
          task.done && "opacity-50",
          isBeingDragged && "opacity-40",
          isInvalidDropTarget && "opacity-30",
          isHoveredValidTarget && "ring-2 ring-accent bg-surface-2",
        )}
      >
        <button
          type="button"
          onPointerDown={(e) => dragCtx?.onGripPointerDown(task, e)}
          className="shrink-0 mt-1.5 p-1 -ml-1 rounded text-text-muted/40 hover:text-text-muted cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to move task"
        >
          <GripIcon />
        </button>

        <TaskCheckbox id={task.id} done={task.done} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {hasChildren && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className={clsx(
                  "shrink-0 flex items-center justify-center rounded-full border border-border text-text-muted hover:text-text hover:border-accent transition-colors",
                  isRoot ? "w-5 h-5 text-xs" : "w-4 h-4 text-[10px]",
                )}
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
            <TagPill tag={tag} />
            <WheelDatePicker
              value={task.due_date}
              onChange={saveDate}
              renderTrigger={({ open }) =>
                task.due_date ? (
                  <button type="button" onClick={open} className="text-xs text-text-muted hover:text-text">
                    due {task.due_date}
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
        <ul
          className={clsx(
            "border-l-2 border-border space-y-1.5",
            isRoot ? "ml-9 pl-4 pb-3 pr-3" : "ml-8 pl-4",
          )}
        >
          {children.map((child) => (
            <TaskNode key={child.id} task={child} byParent={byParent} tags={tags} />
          ))}
        </ul>
      )}
    </li>
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
