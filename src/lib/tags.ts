import type { Tag } from "@/lib/database.types";

/** Block titles are always auto-derived from the tag — never typed. */
export function deriveBlockTitle(tag: Pick<Tag, "label" | "kind">): string {
  return tag.kind === "unit" ? `Study ${tag.label}` : tag.label;
}
