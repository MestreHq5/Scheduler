"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 82;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function to24(hour12: number, isPM: boolean) {
  const h = hour12 % 12;
  return isPM ? h + 12 : h;
}

function to12(hour24: number) {
  const h = hour24 % 12;
  return { hour12: h === 0 ? 12 : h, isPM: hour24 >= 12 };
}

function parseHHMM(value: string) {
  const [h, m] = value.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

/**
 * Android-style two-step circular clock dial: pick the hour on the ring,
 * it auto-advances to minutes, drag or tap either ring directly.
 * Value in/out is a 24h "HH:MM" string, matching blocks' start/end_time.
 */
export function CircularTimePicker({
  value,
  onChange,
  renderTrigger,
  title = "Time",
}: {
  value: string;
  onChange: (next: string) => void;
  renderTrigger: (opts: { value: string; open: () => void }) => React.ReactNode;
  title?: string;
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
      {renderTrigger({ value, open: () => setOpen(true) })}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          onClick={() => setOpen(false)}
        >
          <ClockPanel
            value={value}
            title={title}
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

function ClockPanel({
  value,
  title,
  onClose,
  onCommit,
}: {
  value: string;
  title: string;
  onClose: () => void;
  onCommit: (next: string) => void;
}) {
  const initial = parseHHMM(value);
  const init12 = to12(initial.h);
  const [hour12, setHour12] = useState(init12.hour12);
  const [minute, setMinute] = useState(initial.m);
  const [isPM, setIsPM] = useState(init12.isPM);
  const [step, setStep] = useState<"hour" | "minute">("hour");

  return (
    <div
      className="w-full max-w-xs rounded-2xl bg-surface border border-border p-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="font-display text-lg">{title}</p>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text text-xl leading-none">
          ×
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setStep("hour")}
          className={clsx("text-3xl font-display px-1", step === "hour" ? "text-accent" : "text-text-muted")}
        >
          {pad2(hour12)}
        </button>
        <span className="text-3xl font-display text-text-muted">:</span>
        <button
          type="button"
          onClick={() => setStep("minute")}
          className={clsx("text-3xl font-display px-1", step === "minute" ? "text-accent" : "text-text-muted")}
        >
          {pad2(minute)}
        </button>
        <div className="flex flex-col ml-2 gap-1">
          <button
            type="button"
            onClick={() => setIsPM(false)}
            className={clsx(
              "text-[11px] px-2 py-0.5 rounded",
              !isPM ? "bg-accent text-bg" : "text-text-muted border border-border",
            )}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => setIsPM(true)}
            className={clsx(
              "text-[11px] px-2 py-0.5 rounded",
              isPM ? "bg-accent text-bg" : "text-text-muted border border-border",
            )}
          >
            PM
          </button>
        </div>
      </div>

      {step === "hour" ? (
        <ClockFace mode="hour" value={hour12} onChange={setHour12} onSettle={() => setStep("minute")} />
      ) : (
        <ClockFace mode="minute" value={minute} onChange={setMinute} />
      )}

      <div className="flex items-center justify-end mt-3">
        <button
          type="button"
          onClick={() => onCommit(`${pad2(to24(hour12, isPM))}:${pad2(minute)}`)}
          className="rounded-lg bg-accent text-bg font-semibold px-4 py-2 text-sm hover:opacity-90 transition-opacity"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function angleForIndex(i: number) {
  return (i * 30 - 90) * (Math.PI / 180);
}

function ClockFace({
  mode,
  value,
  onChange,
  onSettle,
}: {
  mode: "hour" | "minute";
  value: number;
  onChange: (n: number) => void;
  onSettle?: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const labels = mode === "hour" ? Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i)) : Array.from({ length: 12 }, (_, i) => i * 5);

  const selectedIdx = mode === "hour" ? (value === 12 ? 0 : value) : Math.round(value / 5) % 12;

  function valueFromPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let deg = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    const idx = Math.round(deg / 30) % 12;
    onChange(mode === "hour" ? (idx === 0 ? 12 : idx) : idx * 5);
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    valueFromPoint(e.clientX, e.clientY);
  }
  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging.current) return;
    valueFromPoint(e.clientX, e.clientY);
  }
  function handlePointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    onSettle?.();
  }

  const handAngle = angleForIndex(selectedIdx);
  const handX = CENTER + Math.cos(handAngle) * (RADIUS - 2);
  const handY = CENTER + Math.sin(handAngle) * (RADIUS - 2);

  return (
    <svg
      ref={svgRef}
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <circle cx={CENTER} cy={CENTER} r={RADIUS + 20} fill="var(--color-surface-2)" />
      <line x1={CENTER} y1={CENTER} x2={handX} y2={handY} stroke="var(--color-accent)" strokeWidth={2} />
      <circle cx={CENTER} cy={CENTER} r={3.5} fill="var(--color-accent)" />
      <circle cx={handX} cy={handY} r={16} fill="var(--color-accent)" opacity={0.9} />
      {labels.map((label, i) => {
        const a = angleForIndex(i);
        const x = CENTER + Math.cos(a) * RADIUS;
        const y = CENTER + Math.sin(a) * RADIUS;
        const active = i === selectedIdx;
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={13}
            fontWeight={active ? 700 : 400}
            fill={active ? "var(--color-bg)" : "var(--color-text)"}
            className="pointer-events-none select-none"
          >
            {mode === "minute" ? pad2(label) : label}
          </text>
        );
      })}
    </svg>
  );
}
