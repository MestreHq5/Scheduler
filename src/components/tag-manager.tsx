"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import type { Tag, TagGroup } from "@/lib/database.types";
import { deleteTag, setTagArchived, updateTag } from "@/lib/actions/tags";
import { TagQuickAddModal } from "@/components/tag-quick-add-modal";
import { Dropdown } from "@/components/dropdown";

const NO_GROUP = "__none__";

export function TagManager({ tags, groups }: { tags: Tag[]; groups: TagGroup[] }) {
  const active = tags.filter((t) => !t.archived);
  const archived = tags.filter((t) => t.archived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">Add new tags from the Tasks page.</p>
        <TagQuickAddModal groups={groups} />
      </div>

      <ul className="space-y-1.5">
        {active.map((t) => (
          <TagRow key={t.id} tag={t} groups={groups} />
        ))}
      </ul>

      {archived.length > 0 && (
        <details>
          <summary className="text-sm text-text-muted cursor-pointer">
            Archived ({archived.length})
          </summary>
          <ul className="space-y-1.5 mt-2">
            {archived.map((t) => (
              <TagRow key={t.id} tag={t} groups={groups} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function TagRow({ tag, groups }: { tag: Tag; groups: TagGroup[] }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(tag.label);

  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface">
      <input
        type="color"
        value={tag.color}
        onChange={(e) => startTransition(() => updateTag(tag.id, { color: e.target.value }))}
        title="Tag color"
        className="w-5 h-5 rounded-full shrink-0 border border-border bg-transparent p-0 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
      />
      {editing ? (
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (label.trim() && label !== tag.label) {
              startTransition(() => updateTag(tag.id, { label: label.trim() }));
            }
          }}
          autoFocus
          className="flex-1 bg-transparent border-b border-border outline-none text-sm"
        />
      ) : (
        <button className="flex-1 text-left text-sm" onClick={() => setEditing(true)}>
          {tag.label}
        </button>
      )}
      <Dropdown
        value={tag.group_id ?? NO_GROUP}
        onChange={(next) => startTransition(() => updateTag(tag.id, { group_id: next === NO_GROUP ? null : next }))}
        className="w-36"
        options={[{ value: NO_GROUP, label: "No group" }, ...groups.map((g) => ({ value: g.id, label: g.label }))]}
      />
      <button
        disabled={pending}
        onClick={() => startTransition(() => setTagArchived(tag.id, !tag.archived))}
        className={clsx("text-xs", tag.archived ? "text-accent" : "text-text-muted hover:text-text")}
      >
        {tag.archived ? "unarchive" : "archive"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${tag.label}"? Tasks/blocks using it become tagless.`)) {
            startTransition(() => deleteTag(tag.id));
          }
        }}
        className="text-xs text-text-muted hover:text-danger"
      >
        delete
      </button>
    </li>
  );
}
