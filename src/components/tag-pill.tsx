import type { Tag } from "@/lib/database.types";

export function TagPill({ tag }: { tag: Pick<Tag, "label" | "color"> | null }) {
  if (!tag) {
    return <span className="text-xs text-text-muted italic">no tag</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
      {tag.label}
    </span>
  );
}
