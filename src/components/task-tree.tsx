"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import type { Tag, Task } from "@/lib/database.types";
import { TaskCheckbox } from "@/components/task-checkbox";
import { TagPill } from "@/components/tag-pill";
import { TagSelect } from "@/components/tag-select";
import { QuickAddTask } from "@/components/quick-add-task";
import { WheelDatePicker } from "@/components/wheel-date-picker";
import { updateTask, moveTask } from "@/lib/actions/tasks";

const ROOT_DROP = "ROOT";

// Depth-based shading (v1 of the columned tree redesign) — pure gray scale
// tokens (--color-level-0/1/2 in globals.css), deliberately distinct from
// the navy-tinted surface/surface-2 tokens used everywhere else, so nesting
// reads at a glance without relying on indentation.
const LEVEL_BG: string[] = ["bg-level-0", "bg-level-1", "bg-level-2"];
const LEVEL_CARD: string[] = [
  "rounded-2xl border border-border/60 px-4 py-3",
  "rounded-xl border border-border/50 px-3.5 py-2.5",
  "rounded-lg border border-border/40 px-3 py-2",
];

type DragVisual = { id: string; x: number; y: number; overId: string | null };

interface TreeCtxValue {
  drag: DragVisual | null;
  invalidIdsRef: React.RefObject<Set<string>>;
  onGripPointerDown: (task: Task, e: React.PointerEvent<HTMLButtonElement>) => void;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
}

const TreeCtx = createContext<TreeCtxValue | null>(null);

type Connector = { id: string; x1: number; y1: number; x2: number; y2: number };

function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const invalidIdsRef = useRef<Set<string>>(new Set());
  const pendingHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [resizeTick, setResizeTick] = useState(0);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function registerRef(id: string, el: HTMLElement | null) {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
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
  const col1: Task[] = [];
  for (const r of roots) {
    if (expandedIds.has(r.id)) col1.push(...(byParent.get(r.id) ?? []));
  }
  const col2: Task[] = [];
  for (const s of col1) {
    if (expandedIds.has(s.id)) col2.push(...(byParent.get(s.id) ?? []));
  }

  const draggedTask = drag ? byId.get(drag.id) : null;

  // Recompute connector geometry whenever the layout could have shifted:
  // task list changes, expand/collapse, or a resize of the tree container
  // (the ResizeObserver below also catches inline form/editing height
  // changes, so this doesn't need to track every possible cause by hand).
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const next: Connector[] = [];

    function link(parentId: string, childId: string) {
      const p = nodeRefs.current.get(parentId);
      const c = nodeRefs.current.get(childId);
      if (!p || !c) return;
      const pr = p.getBoundingClientRect();
      const cr = c.getBoundingClientRect();
      next.push({
        id: `${parentId}:${childId}`,
        x1: pr.right - containerRect.left,
        y1: pr.top + pr.height / 2 - containerRect.top,
        x2: cr.left - containerRect.left,
        y2: cr.top + cr.height / 2 - containerRect.top,
      });
    }

    for (const r of roots) {
      if (!expandedIds.has(r.id)) continue;
      for (const s of byParent.get(r.id) ?? []) link(r.id, s.id);
    }
    for (const s of col1) {
      if (!expandedIds.has(s.id)) continue;
      for (const g of byParent.get(s.id) ?? []) link(s.id, g.id);
    }

    setConnectors(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, expandedIds, resizeTick]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setResizeTick((t) => t + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Live "ghost" connector while dragging, from the dragged card to whatever
  // valid drop target is currently under the pointer, so the pending
  // connection is visible before drop. Read straight from the DOM at render
  // time since it only feeds this frame's SVG output, not persisted state.
  let ghost: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (drag?.overId && drag.overId !== ROOT_DROP && !invalidIdsRef.current.has(drag.overId) && containerRef.current) {
    const target = byId.get(drag.overId);
    const from = nodeRefs.current.get(drag.id);
    const to = nodeRefs.current.get(drag.overId);
    if (target && target.depth < 2 && from && to) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const fr = from.getBoundingClientRect();
      const tr = to.getBoundingClientRect();
      ghost = {
        x1: fr.right - containerRect.left,
        y1: fr.top + fr.height / 2 - containerRect.top,
        x2: tr.left - containerRect.left,
        y2: tr.top + tr.height / 2 - containerRect.top,
      };
    }
  }

  return (
    <TreeCtx.Provider value={{ drag, invalidIdsRef, onGripPointerDown, expandedIds, toggleExpand, registerRef }}>
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
        <div ref={containerRef} className="relative">
          <svg className="absolute inset-0 hidden md:block" style={{ width: "100%", height: "100%" }}>
            {connectors.map((c) => (
              <g key={c.id}>
                <path
                  d={bezierPath(c.x1, c.y1, c.x2, c.y2)}
                  fill="none"
                  stroke="var(--color-border)"
                  strokeWidth={1.5}
                />
                <circle cx={c.x1} cy={c.y1} r={2.5} fill="var(--color-border)" />
                <circle cx={c.x2} cy={c.y2} r={2.5} fill="var(--color-border)" />
              </g>
            ))}
            {ghost && (
              <path
                d={bezierPath(ghost.x1, ghost.y1, ghost.x2, ghost.y2)}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            )}
          </svg>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-6 items-start">
            <ul className="space-y-3">
              {roots.map((task) => (
                <TaskNode key={task.id} task={task} tags={tags} byParent={byParent} byId={byId} />
              ))}
            </ul>
            <ul className="space-y-3">
              {col1.map((task) => (
                <TaskNode key={task.id} task={task} tags={tags} byParent={byParent} byId={byId} />
              ))}
            </ul>
            <ul className="space-y-3">
              {col2.map((task) => (
                <TaskNode key={task.id} task={task} tags={tags} byParent={byParent} byId={byId} />
              ))}
            </ul>
          </div>
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

  return (
    <li
      ref={(el) => ctx?.registerRef(task.id, el)}
      data-task-id={task.id}
      className={clsx(
        "hover:border-accent/40 transition-colors duration-500",
        LEVEL_CARD[task.depth],
        LEVEL_BG[task.depth],
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

        <div className="flex-1 min-w-0">
          {parentTask && (
            <p className="md:hidden text-[10px] text-text-muted/70 mb-0.5 truncate">under {parentTask.title}</p>
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
                onDone={() => setAddingChild(false)}
              />
            </div>
          )}
        </div>
      </div>
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
