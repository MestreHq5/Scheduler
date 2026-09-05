"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

const PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#64748b",
  "#78716c",
];

export function ColorPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Pick color"
        className={clsx(
          "rounded-lg border border-border shrink-0 ring-offset-2 ring-offset-surface transition-shadow hover:ring-2 hover:ring-border",
          className ?? "w-9 h-9",
        )}
        style={{ backgroundColor: value }}
      />
      {open && (
        <div className="absolute z-20 mt-1 rounded-xl border border-border bg-surface shadow-lg p-3 w-52">
          <div className="grid grid-cols-6 gap-2 mb-3">
            {PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => {
                  onChange(hex);
                  setOpen(false);
                }}
                aria-label={hex}
                className={clsx(
                  "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                  value.toLowerCase() === hex.toLowerCase() ? "border-accent" : "border-transparent",
                )}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          <label className="flex items-center justify-between gap-2 text-xs text-text-muted border-t border-border pt-2">
            Custom
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-7 h-7 rounded-md border border-border bg-transparent p-0 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[4px] [&::-webkit-color-swatch]:border-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}
