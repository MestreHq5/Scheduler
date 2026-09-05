import type { Tag, TagGroup } from "@/lib/database.types";

/** A pleasant, varied preset palette for the "no group picked" auto-color case. */
const RANDOM_TAG_COLORS = [
  "#6366f1",
  "#ec4899",
  "#22c55e",
  "#f59e0b",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#3b82f6",
  "#eab308",
];

export function randomTagColor(): string {
  return RANDOM_TAG_COLORS[Math.floor(Math.random() * RANDOM_TAG_COLORS.length)]!;
}

/**
 * Block titles are always auto-derived from the tag — never typed. A tag's
 * group `is_study_unit` flag drives the "Study {label}" treatment; falls
 * back to the legacy `kind` field for tags that predate groups and were
 * never assigned one.
 */
export function deriveBlockTitle(
  tag: Pick<Tag, "label" | "kind"> & { group?: Pick<TagGroup, "is_study_unit"> | null },
): string {
  const isStudyUnit = tag.group ? tag.group.is_study_unit : tag.kind === "unit";
  return isStudyUnit ? `Study ${tag.label}` : tag.label;
}
