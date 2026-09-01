"use client";

import { clsx } from "clsx";
import type { Tag } from "@/lib/database.types";

export function TagSelect({
  tags,
  value,
  onChange,
}: {
  tags: Tag[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => onChange(tag.id)}
          className={clsx(
            "rounded-full px-3 py-1.5 text-sm font-medium border transition-colors",
            value === tag.id ? "border-transparent" : "border-border text-text-muted hover:text-text",
          )}
          style={
            value === tag.id
              ? { backgroundColor: tag.color, color: "#0b0f1a" }
              : undefined
          }
        >
          {tag.label}
        </button>
      ))}
    </div>
  );
}
