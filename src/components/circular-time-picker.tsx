"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS_OUTER = 82;
const RADIUS_INNER = 54;
const RADIUS_MINUTE = 82;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseHHMM(value: string) {
  const [h, m] = value.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

function angleForIndex(i: number) {
  return (i * 30 - 90) * (Math.PI / 180);
}

/**
 * Android-style 24h circular clock dial. The hour step shows both rings at
 * once (outer = 1–12, inner = 13–23 & 00, like a real 24h Android picker) —
 * tap either directly; auto-advances to a single-ring minute step. Keyboard:
 * ←/→ rotate the focused step's value clockwise/anticlockwise, ↑/↓ jump the
 * hour between its outer/inner ring (±12h, same clock position), Enter
 * confirms. Value in/out is a 24h "HH:MM" string, matching blocks'
 * start/end_time.
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
  const [hour, setHour] = useState(initial.h);
  const [minute, setMinute] = useState(initial.m);
  const [step, setStep] = useState<"hour" | "minute">("hour");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (step === "hour") setHour((h) => (h + 1) % 24);
        else setMinute((m) => (m + 5) % 60);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (step === "hour") setHour((h) => (h + 23) % 24);
        else setMinute((m) => (m + 55) % 60);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        if (step === "hour") setHour((h) => (h + 12) % 24);
        else setMinute((m) => (e.key === "ArrowUp" ? (m + 55) % 60 : (m + 5) % 60));
      } else if (e.key === "Enter") {
        e.preventDefault();
        onCommit(`${pad2(hour)}:${pad2(minute)}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, hour, minute, onCommit]);

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

      <div className="flex items-center justify-center gap-1 mb-2">
        <button
          type="button"
          onClick={() => setStep("hour")}
          className={clsx("text-3xl font-display px-1", step === "hour" ? "text-accent" : "text-text-muted")}
        >
          {pad2(hour)}
        </button>
        <span className="text-3xl font-display text-text-muted">:</span>
        <button
          type="button"
          onClick={() => setStep("minute")}
          className={clsx("text-3xl font-display px-1", step === "minute" ? "text-accent" : "text-text-muted")}
        >
          {pad2(minute)}
        </button>
      </div>

      {step === "hour" ? (
        <HourFace hour={hour} onChange={setHour} onSettle={() => setStep("minute")} />
      ) : (
        <MinuteFace minute={minute} onChange={setMinute} />
      )}

      <div className="flex items-center justify-end mt-3">
        <button
          type="button"
          onClick={() => onCommit(`${pad2(hour)}:${pad2(minute)}`)}
          className="rounded-lg bg-accent text-bg font-semibold px-4 py-2 text-sm hover:opacity-90 transition-opacity"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function HourFace({ hour, onChange, onSettle }: { hour: number; onChange: (h: number) => void; onSettle?: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const midRadius = (RADIUS_OUTER + RADIUS_INNER) / 2;

  function valueFromPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / SIZE;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy) / scale;
    let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    const idx = Math.round(deg / 30) % 12;
    const outer = idx === 0 ? 12 : idx;
    const inner = idx === 0 ? 0 : idx + 12;
    onChange(dist >= midRadius ? outer : inner);
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

  const isOuterSelected = hour !== 0 && hour <= 12;
  const selIdx = isOuterSelected ? (hour === 12 ? 0 : hour) : hour === 0 ? 0 : hour - 12;
  const selRadius = isOuterSelected ? RADIUS_OUTER : RADIUS_INNER;
  const handAngle = angleForIndex(selIdx);
  const handX = CENTER + Math.cos(handAngle) * (selRadius - 2);
  const handY = CENTER + Math.sin(handAngle) * (selRadius - 2);

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
      <circle cx={CENTER} cy={CENTER} r={RADIUS_OUTER + 20} fill="var(--color-surface-2)" />
      <line x1={CENTER} y1={CENTER} x2={handX} y2={handY} stroke="var(--color-accent)" strokeWidth={2} />
      <circle cx={CENTER} cy={CENTER} r={3.5} fill="var(--color-accent)" />
      <circle cx={handX} cy={handY} r={16} fill="var(--color-accent)" opacity={0.9} />

      {Array.from({ length: 12 }, (_, i) => {
        const a = angleForIndex(i);
        const outerVal = i === 0 ? 12 : i;
        const innerVal = i === 0 ? 0 : i + 12;
        const outerActive = hour === outerVal;
        const innerActive = hour === innerVal;
        const ox = CENTER + Math.cos(a) * RADIUS_OUTER;
        const oy = CENTER + Math.sin(a) * RADIUS_OUTER;
        const ix = CENTER + Math.cos(a) * RADIUS_INNER;
        const iy = CENTER + Math.sin(a) * RADIUS_INNER;
        return (
          <g key={i} className="pointer-events-none select-none">
            <text
              x={ox}
              y={oy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={13}
              fontWeight={outerActive ? 700 : 400}
              fill={outerActive ? "var(--color-bg)" : "var(--color-text)"}
            >
              {outerVal}
            </text>
            <text
              x={ix}
              y={iy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={innerActive ? 700 : 400}
              fill={innerActive ? "var(--color-bg)" : "var(--color-text-muted)"}
            >
              {pad2(innerVal)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MinuteFace({ minute, onChange }: { minute: number; onChange: (m: number) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const labels = Array.from({ length: 12 }, (_, i) => i * 5);
  const selectedIdx = Math.round(minute / 5) % 12;

  function valueFromPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let deg = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    const idx = Math.round(deg / 30) % 12;
    onChange(idx * 5);
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
    dragging.current = false;
  }

  const handAngle = angleForIndex(selectedIdx);
  const handX = CENTER + Math.cos(handAngle) * (RADIUS_MINUTE - 2);
  const handY = CENTER + Math.sin(handAngle) * (RADIUS_MINUTE - 2);

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
      <circle cx={CENTER} cy={CENTER} r={RADIUS_MINUTE + 20} fill="var(--color-surface-2)" />
      <line x1={CENTER} y1={CENTER} x2={handX} y2={handY} stroke="var(--color-accent)" strokeWidth={2} />
      <circle cx={CENTER} cy={CENTER} r={3.5} fill="var(--color-accent)" />
      <circle cx={handX} cy={handY} r={16} fill="var(--color-accent)" opacity={0.9} />
      {labels.map((label, i) => {
        const a = angleForIndex(i);
        const x = CENTER + Math.cos(a) * RADIUS_MINUTE;
        const y = CENTER + Math.sin(a) * RADIUS_MINUTE;
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
            {pad2(label)}
          </text>
        );
      })}
    </svg>
  );
}
