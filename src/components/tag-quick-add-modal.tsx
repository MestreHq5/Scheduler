"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { TagGroup } from "@/lib/database.types";
import { createTag } from "@/lib/actions/tags";
import { randomTagColor } from "@/lib/tags";
import { Dropdown } from "@/components/dropdown";
import { ColorPicker } from "@/components/color-picker";

const NO_GROUP = "__none__";

export function TagQuickAddModal({ groups }: { groups: TagGroup[] }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [groupId, setGroupId] = useState(NO_GROUP);
  const [color, setColor] = useState(() => randomTagColor());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function onGroupChange(next: string) {
    setGroupId(next);
    const group = groups.find((g) => g.id === next);
    setColor(group ? group.color : randomTagColor());
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    startTransition(async () => {
      await createTag({ label: label.trim(), color, group_id: groupId === NO_GROUP ? null : groupId });
      setLabel("");
      setGroupId(NO_GROUP);
      setColor(randomTagColor());
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
                <ColorPicker value={color} onChange={setColor} />
                <Dropdown
                  value={groupId}
                  onChange={onGroupChange}
                  className="flex-1"
                  options={[{ value: NO_GROUP, label: "No group" }, ...groups.map((g) => ({ value: g.id, label: g.label }))]}
                />
              </div>
              <div className="flex items-center justify-between">
                <Link href="/settings" className="text-xs text-text-muted hover:text-text underline underline-offset-2">
                  Manage groups →
                </Link>
                <button
                  type="submit"
                  disabled={pending || !label.trim()}
                  className="rounded-lg bg-accent text-bg font-semibold px-4 py-2 text-sm disabled:opacity-50"
                >
                  {pending ? "Adding…" : "Add tag"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
