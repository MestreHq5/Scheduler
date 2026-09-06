"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import type { TagGroup } from "@/lib/database.types";
import { createTagGroup, deleteTagGroup, updateTagGroup } from "@/lib/actions/tag-groups";
import { randomTagColor } from "@/lib/tags";
import { ColorPicker } from "@/components/color-picker";

function StudyToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Blocks for tags in this group get a &quot;Study&quot; title prefix"
      className={clsx(
        "rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
        active ? "bg-accent-soft text-accent border-accent/40" : "border-border text-text-muted hover:text-text",
      )}
    >
      Study
    </button>
  );
}

function SkipCopyToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Skip this group's tags' blocks when duplicating a week"
      className={clsx(
        "rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
        active ? "bg-accent-soft text-accent border-accent/40" : "border-border text-text-muted hover:text-text",
      )}
    >
      Skip copy
    </button>
  );
}

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
      <ColorPicker
        value={group.color}
        onChange={(hex) => startTransition(() => updateTagGroup(group.id, { color: hex }))}
        className="w-6 h-6 rounded-full"
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
      <StudyToggle
        active={group.is_study_unit}
        onToggle={() => startTransition(() => updateTagGroup(group.id, { is_study_unit: !group.is_study_unit }))}
      />
      <SkipCopyToggle
        active={group.exclude_from_duplicate}
        onToggle={() =>
          startTransition(() => updateTagGroup(group.id, { exclude_from_duplicate: !group.exclude_from_duplicate }))
        }
      />
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
      <ColorPicker value={color} onChange={setColor} className="w-6 h-6 rounded-full" />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Curricular Units"
        autoFocus
        className="flex-1 bg-transparent border-b border-border outline-none text-sm"
      />
      <StudyToggle active={isStudyUnit} onToggle={() => setIsStudyUnit((v) => !v)} />
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
