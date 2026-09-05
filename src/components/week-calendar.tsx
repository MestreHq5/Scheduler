"use client";

import { useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import type { Block } from "@/lib/database.types";
import { deleteBlock, moveBlock } from "@/lib/actions/blocks";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VISIBLE_HOURS = 12; // the viewport always shows this many hours without scrolling
const DEFAULT_HOUR_HEIGHT = 48;
const SNAP_MINUTES = 15;

type BlockWithTag = Block & { tag: { label: string; color: string } | null };

type DragState = {
  id: string;
  duration: number; // minutes
  offsetMinutes: number; // pointer offset from the block's top edge, in minutes
  date: string;
  startMinutes: number;
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

/** Given a hex color, picks black or white text for legible contrast on a solid fill. */
function contrastText(hex: string) {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0b0f1a" : "#ffffff";
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
  today,
}: {
  weekDates: string[];
  blocks: BlockWithTag[];
  today: string;
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
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

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
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const col = target?.closest<HTMLElement>("[data-day-col]");
    if (!col) return;
    const rect = col.getBoundingClientRect();
    const minutesAtPointer = ((e.clientY - rect.top) / hourHeight) * 60;
    setDrag((d) =>
      d && {
        ...d,
        date: col.dataset.dayCol!,
        startMinutes: minutesAtPointer - d.offsetMinutes,
      },
    );
  }

  function endDrag() {
    if (!drag) return;
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
        className="overflow-y-auto overflow-x-hidden h-[70dvh] rounded-xl border border-border"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
      <div className="grid select-none" style={{ gridTemplateColumns: "2.75rem repeat(7, minmax(0, 1fr))" }}>
        <div className="sticky top-0 left-0 z-20 bg-bg" />
        {weekDates.map((date, i) => {
          const isToday = date === today;
          return (
            <div
              key={date}
              className={clsx(
                "sticky top-0 z-10 bg-bg text-center pb-2 pt-1 border-b border-border",
                isToday && "text-accent",
              )}
            >
              <p className="text-xs font-medium">{DAY_LABELS[i]}</p>
              <p className="text-[11px] text-text-muted">{date.slice(5)}</p>
            </div>
          );
        })}

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
          const dayBlocks = (byDate.get(date) ?? []).filter((b) => !drag || b.id !== drag.id);
          const layout = layoutDay(dayBlocks);
          const showGhost = drag?.date === date;

          return (
            <div
              key={date}
              data-day-col={date}
              className={clsx("relative border-l border-border", date === today && "bg-surface/40")}
              style={{
                height: dayHeight,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent ${hourHeight}px)`,
              }}
            >
              {dayBlocks.map((b) => {
                const { col, count } = layout.get(b.id) ?? { col: 0, count: 1 };
                const startMin = timeToMinutes(b.start_time);
                const endMin = timeToMinutes(b.end_time);
                return (
                  <BlockCard
                    key={b.id}
                    block={b}
                    top={(startMin / 60) * hourHeight}
                    height={Math.max(18, ((endMin - startMin) / 60) * hourHeight)}
                    leftPct={(col / count) * 100}
                    widthPct={100 / count}
                    onPointerDown={(e) => beginDrag(e, b)}
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
            </div>
          );
        })}
      </div>
      </div>
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
}: {
  block: BlockWithTag;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const [pending, startTransition] = useTransition();
  const color = block.tag?.color ?? "#64748b";
  const textColor = contrastText(color);

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
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{block.title}</span>
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
      <span style={{ opacity: 0.85 }}>
        {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)}
      </span>
    </div>
  );
}
