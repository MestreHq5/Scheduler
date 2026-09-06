"use client";

import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import type { Block, Tag } from "@/lib/database.types";
import { createBlock, deleteBlock, moveBlock } from "@/lib/actions/blocks";
import { formatDateDMY, nowClockInTimezone } from "@/lib/dates";
import { contrastText } from "@/lib/color";
import { BlockEditModal } from "@/components/block-edit-modal";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // indexed by Date#getUTCDay()
const VISIBLE_HOURS = 12; // the viewport always shows this many hours without scrolling
const DEFAULT_HOUR_HEIGHT = 48;
const SNAP_MINUTES = 15;
const CLICK_THRESHOLD_PX = 5; // pointer movement below this is a click, not a drag

type BlockWithTag = Block & { tag: { label: string; color: string; group: { label: string } | null } | null };

type DragState = {
  id: string;
  duration: number; // minutes
  offsetMinutes: number; // pointer offset from the block's top edge, in minutes
  date: string;
  startMinutes: number;
  pointerStartX: number;
  pointerStartY: number;
  moved: boolean;
};

type ResizeState = {
  id: string;
  date: string;
  edge: "start" | "end";
  origStartMinutes: number;
  origEndMinutes: number;
  pointerStartY: number;
  liveStartMinutes: number;
  liveEndMinutes: number;
};

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
}

function minutesToTime(min: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - SNAP_MINUTES, min));
  const snapped = Math.round(clamped / SNAP_MINUTES) * SNAP_MINUTES;
  const h = Math.floor(snapped / 60);
  const m = snapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Groups time-overlapping blocks in a day into clusters and splits each cluster's width evenly. */
function layoutDay(blocks: BlockWithTag[]) {
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  const clusters: BlockWithTag[][] = [];
  let clusterEnd = -1;
  let current: BlockWithTag[] = [];

  for (const b of sorted) {
    const start = timeToMinutes(b.start_time);
    if (current.length > 0 && start < clusterEnd) {
      current.push(b);
      clusterEnd = Math.max(clusterEnd, timeToMinutes(b.end_time));
    } else {
      if (current.length) clusters.push(current);
      current = [b];
      clusterEnd = timeToMinutes(b.end_time);
    }
  }
  if (current.length) clusters.push(current);

  const layout = new Map<string, { col: number; count: number }>();
  for (const cluster of clusters) {
    cluster.forEach((b, i) => layout.set(b.id, { col: i, count: cluster.length }));
  }
  return layout;
}

type MoveUpdate = { id: string; date: string; start_time: string; end_time: string };

export function WeekCalendar({
  weekDates,
  blocks,
  tags,
  today,
  timezone,
  heightClassName = "h-[70dvh]",
}: {
  weekDates: string[];
  blocks: BlockWithTag[];
  tags: Tag[];
  today: string;
  timezone: string;
  /** Overrides the scroll container's height — used to fit a compact single-day view, e.g. on the Hub. */
  heightClassName?: string;
}) {
  const [optimisticBlocks, applyOptimisticMove] = useOptimistic(blocks, (state, update: MoveUpdate) =>
    state.map((b) => (b.id === update.id ? { ...b, date: update.date, start_time: update.start_time, end_time: update.end_time } : b)),
  );

  const byDate = new Map<string, BlockWithTag[]>();
  for (const b of optimisticBlocks) {
    if (!byDate.has(b.date)) byDate.set(b.date, []);
    byDate.get(b.date)!.push(b);
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<BlockWithTag | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  // Live "now" line — recomputed in the user's configured timezone, not the
  // browser's, since those can differ (see profile timezone setting).
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  useEffect(() => {
    function update() {
      setNowMinutes(timeToMinutes(nowClockInTimezone(timezone)));
    }
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [timezone]);

  const dayHeight = hourHeight * 24;

  // The grid always renders a fixed 24h, but the *viewport* height is derived
  // from the container's own rendered height so exactly VISIBLE_HOURS are
  // visible without scrolling, on any screen size.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      if (h > 0) setHourHeight(h / VISIBLE_HOURS);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 7 * hourHeight - 24 });
    // Only on mount / once hourHeight is first known — not on every recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourHeight > 0]);

  function beginDrag(e: React.PointerEvent, block: BlockWithTag) {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetMinutes = ((e.clientY - rect.top) / hourHeight) * 60;
    setDrag({
      id: block.id,
      duration: timeToMinutes(block.end_time) - timeToMinutes(block.start_time),
      offsetMinutes,
      date: block.date,
      startMinutes: timeToMinutes(block.start_time),
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      moved: false,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function beginResize(e: React.PointerEvent, block: BlockWithTag, edge: "start" | "end") {
    e.stopPropagation();
    const startMinutes = timeToMinutes(block.start_time);
    const endMinutes = timeToMinutes(block.end_time);
    setResize({
      id: block.id,
      date: block.date,
      edge,
      origStartMinutes: startMinutes,
      origEndMinutes: endMinutes,
      pointerStartY: e.clientY,
      liveStartMinutes: startMinutes,
      liveEndMinutes: endMinutes,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (resize) {
      const deltaMinutes = ((e.clientY - resize.pointerStartY) / hourHeight) * 60;
      setResize((r) => {
        if (!r) return r;
        if (r.edge === "start") {
          const next = Math.max(0, Math.min(r.origEndMinutes - SNAP_MINUTES, r.origStartMinutes + deltaMinutes));
          return { ...r, liveStartMinutes: next };
        }
        const next = Math.min(24 * 60, Math.max(r.origStartMinutes + SNAP_MINUTES, r.origEndMinutes + deltaMinutes));
        return { ...r, liveEndMinutes: next };
      });
      return;
    }

    if (!drag) return;
    const movedFar = Math.hypot(e.clientX - drag.pointerStartX, e.clientY - drag.pointerStartY) > CLICK_THRESHOLD_PX;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const col = target?.closest<HTMLElement>("[data-day-col]");
    if (!col) {
      if (movedFar && !drag.moved) setDrag((d) => d && { ...d, moved: true });
      return;
    }
    const rect = col.getBoundingClientRect();
    const minutesAtPointer = ((e.clientY - rect.top) / hourHeight) * 60;
    setDrag((d) =>
      d && {
        ...d,
        date: col.dataset.dayCol!,
        startMinutes: minutesAtPointer - d.offsetMinutes,
        moved: d.moved || movedFar,
      },
    );
  }

  function endResize() {
    if (!resize) return;
    const snappedStart = minutesToTime(resize.liveStartMinutes);
    const snappedEnd = minutesToTime(resize.liveEndMinutes);
    const { id, date } = resize;
    const resizedTitle =
      blocks.find((b) => b.id === id)?.title ?? optimisticBlocks.find((b) => b.id === id)?.title ?? "Block";
    setResize(null);

    startTransition(async () => {
      applyOptimisticMove({ id, date, start_time: snappedStart, end_time: snappedEnd });
      try {
        await moveBlock(id, { date, start_time: snappedStart, end_time: snappedEnd });
      } catch (e) {
        setError(`"${resizedTitle}" couldn't be resized — ${e instanceof Error ? e.message : "something went wrong"}.`);
      }
    });
  }

  /** Double-clicking empty space in a day column adds a tagless block spanning that hour. */
  function onEmptyDoubleClick(e: React.MouseEvent<HTMLDivElement>, date: string) {
    if (e.target !== e.currentTarget) return; // ignore double-clicks landing on a block card
    const rect = e.currentTarget.getBoundingClientRect();
    const minutesAtPointer = ((e.clientY - rect.top) / hourHeight) * 60;
    const hour = Math.max(0, Math.min(23, Math.floor(minutesAtPointer / 60)));
    const startTime = `${String(hour).padStart(2, "0")}:00`;
    const endTime = hour === 23 ? "23:59" : `${String(hour + 1).padStart(2, "0")}:00`;

    startTransition(async () => {
      try {
        await createBlock({ tag_id: null, date, start_time: startTime, end_time: endTime });
      } catch (err) {
        setError(`Couldn't add block — ${err instanceof Error ? err.message : "something went wrong"}.`);
      }
    });
  }

  function onPointerUpOrCancel() {
    if (resize) {
      endResize();
      return;
    }
    endDrag();
  }

  function endDrag() {
    if (!drag) return;

    // A stationary pointerdown/up is a click, not a drag — open the edit
    // modal instead of firing a no-op moveBlock.
    if (!drag.moved) {
      const clicked = optimisticBlocks.find((b) => b.id === drag.id) ?? null;
      setDrag(null);
      if (clicked) setEditingBlock(clicked);
      return;
    }

    const snappedStart = minutesToTime(drag.startMinutes);
    const endTime = minutesToTime(timeToMinutes(snappedStart) + drag.duration);
    const update: MoveUpdate = { id: drag.id, date: drag.date, start_time: snappedStart, end_time: endTime };
    const movedTitle =
      blocks.find((b) => b.id === drag.id)?.title ?? optimisticBlocks.find((b) => b.id === drag.id)?.title ?? "Block";
    setDrag(null);

    // Optimistic: the block jumps to its new slot instantly. moveBlock runs
    // in the background — on success the real `blocks` prop already matches
    // by the time this transition settles, so nothing visibly changes; on
    // failure the optimistic state is discarded automatically (useOptimistic
    // reverts once the transition ends) and we surface exactly what failed.
    startTransition(async () => {
      applyOptimisticMove(update);
      try {
        await moveBlock(update.id, { date: update.date, start_time: update.start_time, end_time: update.end_time });
      } catch (e) {
        setError(`"${movedTitle}" couldn't be moved — ${e instanceof Error ? e.message : "something went wrong"}.`);
      }
    });
  }

  return (
    <div className="relative">
      {error && (
        <div className="absolute inset-x-0 -top-3 -translate-y-full z-30 flex items-start justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 hover:opacity-70" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      <div
        ref={scrollRef}
        className={clsx(
          "overflow-y-auto overflow-x-hidden rounded-xl border border-border p-2",
          heightClassName,
        )}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUpOrCancel}
        onPointerCancel={onPointerUpOrCancel}
      >
      <div
        className="sticky top-0 z-20 grid bg-bg"
        style={{ gridTemplateColumns: `2.75rem repeat(${weekDates.length}, minmax(0, 1fr))` }}
      >
        <div />
        {weekDates.map((date) => {
          const isToday = date === today;
          const weekday = WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()];
          return (
            <div
              key={date}
              className={clsx("text-center pb-2 pt-1 border-b border-border", isToday && "text-accent")}
            >
              <p className="text-xs font-medium">{weekday}</p>
              <p className="text-[11px] text-text-muted">{formatDateDMY(date)}</p>
            </div>
          );
        })}
      </div>

      <div
        className="grid select-none"
        style={{ gridTemplateColumns: `2.75rem repeat(${weekDates.length}, minmax(0, 1fr))` }}
      >
        <div className="sticky left-0 z-10 bg-bg" style={{ height: dayHeight }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              style={{ height: hourHeight }}
              className="text-[9px] md:text-[10px] text-text-muted text-right pr-1 md:pr-1.5 -translate-y-1/2"
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {weekDates.map((date) => {
          const dayBlocks = (byDate.get(date) ?? []).filter((b) => !(drag?.moved && b.id === drag.id));
          const layout = layoutDay(dayBlocks);
          const showGhost = drag?.moved && drag.date === date;

          return (
            <div
              key={date}
              data-day-col={date}
              className={clsx("relative border-l border-border", date === today && "bg-surface/40")}
              style={{
                height: dayHeight,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent ${hourHeight}px)`,
              }}
              onDoubleClick={(e) => onEmptyDoubleClick(e, date)}
            >
              {dayBlocks.map((b) => {
                const { col, count } = layout.get(b.id) ?? { col: 0, count: 1 };
                const isResizing = resize?.id === b.id;
                const startMin = isResizing ? resize.liveStartMinutes : timeToMinutes(b.start_time);
                const endMin = isResizing ? resize.liveEndMinutes : timeToMinutes(b.end_time);
                return (
                  <BlockCard
                    key={b.id}
                    block={b}
                    top={(startMin / 60) * hourHeight}
                    height={Math.max(18, ((endMin - startMin) / 60) * hourHeight)}
                    leftPct={(col / count) * 100}
                    widthPct={100 / count}
                    onPointerDown={(e) => beginDrag(e, b)}
                    onResizeStart={(e, edge) => beginResize(e, b, edge)}
                  />
                );
              })}

              {showGhost && drag && (
                <div
                  className="absolute inset-x-1 rounded-lg border-2 border-dashed border-accent bg-accent/15 pointer-events-none"
                  style={{
                    top: (drag.startMinutes / 60) * hourHeight,
                    height: Math.max(18, (drag.duration / 60) * hourHeight),
                  }}
                />
              )}

              {date === today && nowMinutes !== null && (
                <div
                  className="absolute inset-x-0 z-10 flex items-center pointer-events-none"
                  style={{ top: (nowMinutes / 60) * hourHeight }}
                >
                  <span className="w-2 h-2 rounded-full bg-accent -ml-1 shrink-0" />
                  <span className="h-px flex-1 bg-accent" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {editingBlock && (
        <BlockEditModal block={editingBlock} tags={tags} onClose={() => setEditingBlock(null)} />
      )}
    </div>
  );
}

function BlockCard({
  block,
  top,
  height,
  leftPct,
  widthPct,
  onPointerDown,
  onResizeStart,
}: {
  block: BlockWithTag;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>, edge: "start" | "end") => void;
}) {
  const [pending, startTransition] = useTransition();
  const color = block.tag?.color ?? "#64748b";
  const textColor = contrastText(color);

  const tagLabel = block.tag?.label ?? block.title;
  const groupOrTag = block.tag?.group?.label ?? tagLabel;
  const headerLabel = block.details ? `${groupOrTag} · ${block.details}` : groupOrTag;
  const timeLabel = `${block.start_time.slice(0, 5)}–${block.end_time.slice(0, 5)}`;
  const secondLine = block.location ? `${block.location} · ${timeLabel}` : timeLabel;

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        backgroundColor: color,
        color: textColor,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
        touchAction: "none",
      }}
      className="group absolute overflow-hidden rounded-lg px-2 py-1 text-xs cursor-grab active:cursor-grabbing"
    >
      <div
        onPointerDown={(e) => onResizeStart(e, "start")}
        className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize touch-none"
      >
        <span className="mx-auto mt-0.5 block h-0.5 w-6 rounded-full bg-current opacity-0 group-hover:opacity-50" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{headerLabel}</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => startTransition(() => deleteBlock(block.id))}
          disabled={pending}
          className="opacity-0 group-hover:opacity-100 hover:opacity-80 transition-opacity shrink-0"
          aria-label="Delete block"
        >
          ×
        </button>
      </div>
      <span className="block truncate" style={{ opacity: 0.85 }}>
        {secondLine}
      </span>
      <div
        onPointerDown={(e) => onResizeStart(e, "end")}
        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize touch-none"
      >
        <span className="mx-auto mb-0.5 block h-0.5 w-6 rounded-full bg-current opacity-0 group-hover:opacity-50" />
      </div>
    </div>
  );
}
