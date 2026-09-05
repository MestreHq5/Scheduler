"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { formatDateDMY } from "@/lib/dates";

const ITEM_H = 36;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseISO(value: string | null) {
  if (value) {
    const [y, m, d] = value.split("-").map(Number);
    if (y && m && d) return { y, m, d };
  }
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/**
 * iOS-style scrolling wheel date picker. Fully self-contained (manages its
 * own open/close state and popover) — pass a `renderTrigger` to control the
 * trigger element's own look, matching whatever the call site needs.
 */
export function WheelDatePicker({
  value,
  onChange,
  renderTrigger,
  title = "Date",
  allowClear = true,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  renderTrigger: (opts: { value: string | null; label: string | null; open: () => void }) => React.ReactNode;
  title?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {renderTrigger({ value, label: value ? formatDateDMY(value) : null, open: () => setOpen(true) })}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          onClick={() => setOpen(false)}
        >
          <DatePanel
            value={value}
            title={title}
            allowClear={allowClear}
            onClose={() => setOpen(false)}
            onCommit={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </div>
      )}
    </>
  );
}

function DatePanel({
  value,
  title,
  allowClear,
  onClose,
  onCommit,
}: {
  value: string | null;
  title: string;
  allowClear: boolean;
  onClose: () => void;
  onCommit: (next: string | null) => void;
}) {
  const initial = parseISO(value);
  const [y, setY] = useState(initial.y);
  const [m, setM] = useState(initial.m);
  const [d, setD] = useState(initial.d);
  const [focusedCol, setFocusedCol] = useState<"day" | "month" | "year">("day");

  const maxDay = daysInMonth(y, m);
  const clampedDay = Math.min(d, maxDay);

  const years = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const minYear = years[0]!;
  const maxYear = years[years.length - 1]!;

  // Keyboard nav: ←/→ move focus between day/month/year, ↑/↓ nudge the
  // focused column's value, Enter confirms — same commit as the Done button.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedCol((c) => (c === "day" ? "month" : "year"));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedCol((c) => (c === "year" ? "month" : "day"));
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const dir = e.key === "ArrowUp" ? -1 : 1;
        if (focusedCol === "day") {
          setD((cur) => Math.min(maxDay, Math.max(1, Math.min(cur, maxDay) + dir)));
        } else if (focusedCol === "month") {
          setM((cur) => Math.min(12, Math.max(1, cur + dir)));
        } else {
          setY((cur) => Math.min(maxYear, Math.max(minYear, cur + dir)));
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        onCommit(`${y}-${pad2(m)}-${pad2(clampedDay)}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedCol, maxDay, minYear, maxYear, y, m, clampedDay, onCommit]);

  return (
    <div
      className="w-full max-w-xs rounded-2xl bg-surface border border-border p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-lg">{title}</p>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text text-xl leading-none">
          ×
        </button>
      </div>

      <div className="relative" style={{ height: ITEM_H * VISIBLE }}>
        {/* Positioned elements paint after in-flow siblings regardless of DOM
            order, so this highlight bar would otherwise sit on top of the
            wheel numbers. Give the columns their own stacking context above it. */}
        <div
          className="pointer-events-none absolute inset-x-0 rounded-lg bg-surface-2"
          style={{ top: PAD, height: ITEM_H }}
        />
        <div className="relative z-10 flex justify-center gap-2">
          <WheelColumn
            items={days}
            value={clampedDay}
            onSettle={setD}
            focused={focusedCol === "day"}
            onFocus={() => setFocusedCol("day")}
          />
          <WheelColumn
            items={months}
            value={m}
            onSettle={setM}
            format={(n) => MONTH_LABELS[n - 1]!}
            focused={focusedCol === "month"}
            onFocus={() => setFocusedCol("month")}
          />
          <WheelColumn
            items={years}
            value={y}
            onSettle={setY}
            focused={focusedCol === "year"}
            onFocus={() => setFocusedCol("year")}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        {allowClear && value && (
          <button
            type="button"
            onClick={() => onCommit(null)}
            className="text-xs text-text-muted hover:text-danger"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={() => onCommit(`${y}-${pad2(m)}-${pad2(clampedDay)}`)}
          className="ml-auto rounded-lg bg-accent text-bg font-semibold px-4 py-2 text-sm hover:opacity-90 transition-opacity"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function WheelColumn({
  items,
  value,
  onSettle,
  format,
  focused,
  onFocus,
}: {
  items: number[];
  value: number;
  onSettle: (n: number) => void;
  format?: (n: number) => string;
  focused?: boolean;
  onFocus?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialIdx = Math.max(items.indexOf(value), 0);
  const [liveIdx, setLiveIdx] = useState(initialIdx);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = initialIdx * ITEM_H;
    // Only ever run once, at mount — this component remounts fresh each
    // time the picker opens (see DatePanel's key-free conditional render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follows external value changes (e.g. keyboard nav) that didn't come from
  // this column's own scroll gesture.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(items.indexOf(value), 0);
    setLiveIdx(idx);
    if (Math.abs(el.scrollTop - idx * ITEM_H) > 0.5) {
      el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    const idx = Math.min(Math.max(Math.round(el.scrollTop / ITEM_H), 0), items.length - 1);
    setLiveIdx(idx);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const next = items[idx];
      if (next !== undefined) onSettle(next);
      if (Math.abs(el.scrollTop - idx * ITEM_H) > 0.5) {
        el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
      }
    }, 80);
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      onPointerDown={onFocus}
      className={clsx(
        "w-16 overflow-y-scroll snap-y snap-mandatory rounded-lg [&::-webkit-scrollbar]:hidden transition-shadow",
        focused && "ring-2 ring-accent",
      )}
      style={{ height: ITEM_H * VISIBLE, scrollPaddingTop: PAD, scrollPaddingBottom: PAD, scrollbarWidth: "none" }}
    >
      <div style={{ height: PAD }} />
      {items.map((n, i) => {
        const dist = Math.abs(i - liveIdx);
        return (
          <div
            key={n}
            className="snap-center flex items-center justify-center text-sm transition-opacity"
            style={{
              height: ITEM_H,
              opacity: dist === 0 ? 1 : dist === 1 ? 0.55 : 0.25,
              color: dist === 0 ? "var(--color-accent)" : undefined,
              fontWeight: dist === 0 ? 600 : 400,
            }}
          >
            {format ? format(n) : n}
          </div>
        );
      })}
      <div style={{ height: PAD }} />
    </div>
  );
}
