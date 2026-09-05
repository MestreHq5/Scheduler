"use client";

import { useState, useTransition } from "react";
import type { TagGroup } from "@/lib/database.types";
import { createTagGroup, deleteTagGroup, updateTagGroup } from "@/lib/actions/tag-groups";
import { randomTagColor } from "@/lib/tags";

export function TagGroupManager({ groups }: { groups: TagGroup[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3">
      {groups.length > 0 && (
        <ul className="space-y-1.5">
          {groups.map((g) => (
            <GroupRow key={g.id} group={g} />
          ))}
        </ul>
      )}

      {adding ? (
        <NewGroupForm onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text hover:border-accent transition-colors"
        >
          + New group
        </button>
      )}
    </div>
  );
}

function GroupRow({ group }: { group: TagGroup }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(group.label);

  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface">
      <input
        type="color"
        value={group.color}
        onChange={(e) => startTransition(() => updateTagGroup(group.id, { color: e.target.value }))}
        title="Group color"
        className="w-5 h-5 rounded-full shrink-0 border border-border bg-transparent p-0 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
      />
      {editing ? (
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (label.trim() && label !== group.label) {
              startTransition(() => updateTagGroup(group.id, { label: label.trim() }));
            }
          }}
          autoFocus
          className="flex-1 bg-transparent border-b border-border outline-none text-sm"
        />
      ) : (
        <button className="flex-1 text-left text-sm" onClick={() => setEditing(true)}>
          {group.label}
        </button>
      )}
      <label className="flex items-center gap-1.5 text-xs text-text-muted">
        <input
          type="checkbox"
          checked={group.is_study_unit}
          onChange={(e) => startTransition(() => updateTagGroup(group.id, { is_study_unit: e.target.checked }))}
        />
        study unit
      </label>
      <button
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${group.label}"? Tags in it become ungrouped.`)) {
            startTransition(() => deleteTagGroup(group.id));
          }
        }}
        className="text-xs text-text-muted hover:text-danger"
      >
        delete
      </button>
    </li>
  );
}

function NewGroupForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(() => randomTagColor());
  const [isStudyUnit, setIsStudyUnit] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    startTransition(async () => {
      await createTagGroup({ label: label.trim(), color, is_study_unit: isStudyUnit });
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="w-5 h-5 rounded-full shrink-0 border border-border bg-transparent p-0 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Curricular Units"
        autoFocus
        className="flex-1 bg-transparent border-b border-border outline-none text-sm"
      />
      <label className="flex items-center gap-1.5 text-xs text-text-muted">
        <input type="checkbox" checked={isStudyUnit} onChange={(e) => setIsStudyUnit(e.target.checked)} />
        study unit
      </label>
      <button
        type="submit"
        disabled={pending || !label.trim()}
        className="text-xs text-accent hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      <button type="button" onClick={onDone} className="text-xs text-text-muted hover:text-text">
        cancel
      </button>
    </form>
  );
}
