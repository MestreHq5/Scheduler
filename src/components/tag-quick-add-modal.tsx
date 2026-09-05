"use client";

import { useEffect, useState, useTransition } from "react";
import type { TagKind } from "@/lib/database.types";
import { createTag } from "@/lib/actions/tags";

export function TagQuickAddModal() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [kind, setKind] = useState<TagKind>("unit");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    startTransition(async () => {
      await createTag({ label: label.trim(), color, kind });
      setLabel("");
      setColor("#6366f1");
      setKind("unit");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text hover:border-accent transition-colors"
      >
        + New tag
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface border border-border p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg">New tag</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-text-muted hover:text-text"
              >
                ×
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Aero IV"
                autoFocus
                className="w-full rounded-lg bg-surface-2 border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-border bg-surface-2 shrink-0"
                />
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as TagKind)}
                  className="flex-1 rounded-lg bg-surface-2 border border-border px-2 py-2 text-sm"
                >
                  <option value="unit">Curricular unit</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={pending || !label.trim()}
                className="w-full rounded-lg bg-accent text-bg font-semibold px-4 py-2 text-sm disabled:opacity-50"
              >
                {pending ? "Adding…" : "Add tag"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
