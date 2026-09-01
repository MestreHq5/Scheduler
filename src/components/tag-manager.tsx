"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import type { Tag, TagKind } from "@/lib/database.types";
import { createTag, deleteTag, setTagArchived, updateTag } from "@/lib/actions/tags";

export function TagManager({ tags }: { tags: Tag[] }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [kind, setKind] = useState<TagKind>("unit");
  const [pending, startTransition] = useTransition();

  const active = tags.filter((t) => !t.archived);
  const archived = tags.filter((t) => t.archived);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    startTransition(async () => {
      await createTag({ label: label.trim(), color, kind });
      setLabel("");
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex gap-2 items-center flex-wrap">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="New tag (e.g. Aero IV)"
          className="flex-1 min-w-32 rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-9 h-9 rounded-lg border border-border bg-surface"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as TagKind)}
          className="rounded-lg bg-surface border border-border px-2 py-2 text-sm"
        >
          <option value="unit">Curricular unit</option>
          <option value="other">Other</option>
        </select>
        <button
          type="submit"
          disabled={pending || !label.trim()}
          className="rounded-lg bg-accent text-bg font-semibold px-4 py-2 text-sm disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <ul className="space-y-1.5">
        {active.map((t) => (
          <TagRow key={t.id} tag={t} />
        ))}
      </ul>

      {archived.length > 0 && (
        <details>
          <summary className="text-sm text-text-muted cursor-pointer">
            Archived ({archived.length})
          </summary>
          <ul className="space-y-1.5 mt-2">
            {archived.map((t) => (
              <TagRow key={t.id} tag={t} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function TagRow({ tag }: { tag: Tag }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(tag.label);

  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
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
      <span className="text-xs text-text-muted">{tag.kind === "unit" ? "unit" : "other"}</span>
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
