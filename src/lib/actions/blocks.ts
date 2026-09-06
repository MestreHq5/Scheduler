"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deriveBlockTitle } from "@/lib/tags";
import { addDays, daysBetween } from "@/lib/dates";
import type { Block, TagKind } from "@/lib/database.types";

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

/** Fetches a tag joined with its group, for `deriveBlockTitle` (group.is_study_unit drives the "Study {label}" treatment). */
async function fetchTagForTitle(supabase: Awaited<ReturnType<typeof createClient>>, tagId: string) {
  const { data, error } = await supabase
    .from("tags")
    .select("label, kind, group:tag_groups(is_study_unit)")
    .eq("id", tagId)
    .single();
  if (error) throw error;
  return data as unknown as { label: string; kind: TagKind | null; group: { is_study_unit: boolean } | null };
}

export async function createBlock(input: {
  tag_id: string;
  date: string;
  start_time: string;
  end_time: string;
  details?: string | null;
}) {
  const { supabase, userId } = await currentUserId();

  const tag = await fetchTagForTitle(supabase, input.tag_id);

  const { error } = await supabase.from("blocks").insert({
    ...input,
    details: input.details ? input.details.slice(0, 30) : input.details,
    title: deriveBlockTitle(tag),
    user_id: userId,
  });
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/");
}

/** Reschedules a block after a drag — keeps the same duration, moves date/start/end. */
export async function moveBlock(id: string, input: { date: string; start_time: string; end_time: string }) {
  const { supabase } = await currentUserId();
  const { error } = await supabase.from("blocks").update(input).eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/");
}

/** Edits a block from the calendar's click-to-edit modal. Re-derives the title when the tag changes. */
export async function updateBlock(
  id: string,
  input: Partial<{
    tag_id: string;
    date: string;
    start_time: string;
    end_time: string;
    details: string | null;
  }>,
) {
  const { supabase } = await currentUserId();

  const patch: Partial<Block> = { ...input };
  if (input.details) patch.details = input.details.slice(0, 30);

  if (input.tag_id) {
    const tag = await fetchTagForTitle(supabase, input.tag_id);
    patch.title = deriveBlockTitle(tag);
  }

  const { error } = await supabase.from("blocks").update(patch).eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function deleteBlock(id: string) {
  const { supabase } = await currentUserId();
  const { error } = await supabase.from("blocks").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/calendar");
  revalidatePath("/");
}

/**
 * Copies every block from the given Monday's week onto the week starting at
 * targetMonday. Never touches the source (past) week. Overlaps with
 * whatever already exists in the target week are left in place — the user
 * discards/edits collisions manually afterward.
 */
export async function duplicateWeek(sourceMonday: string, targetMonday: string) {
  const { supabase, userId } = await currentUserId();

  const dayOffset = daysBetween(sourceMonday, targetMonday);
  const weekEnd = addDays(sourceMonday, 6);

  const { data: sourceBlocks, error: fetchError } = await supabase
    .from("blocks")
    .select(
      "tag_id, title, date, start_time, end_time, details, tag:tags(exclude_from_duplicate, group:tag_groups(exclude_from_duplicate))",
    )
    .eq("user_id", userId)
    .gte("date", sourceMonday)
    .lte("date", weekEnd);
  if (fetchError) throw fetchError;
  if (!sourceBlocks?.length) return;

  type SourceBlock = {
    tag_id: string | null;
    title: string;
    date: string;
    start_time: string;
    end_time: string;
    details: string | null;
    tag: { exclude_from_duplicate: boolean; group: { exclude_from_duplicate: boolean } | null } | null;
  };

  const included = (sourceBlocks as unknown as SourceBlock[]).filter((b) => {
    if (!b.tag) return true;
    if (b.tag.exclude_from_duplicate) return false;
    if (b.tag.group?.exclude_from_duplicate) return false;
    return true;
  });
  if (!included.length) return;

  const copies = included.map((b) => ({
    user_id: userId,
    tag_id: b.tag_id,
    title: b.title,
    date: addDays(b.date, dayOffset),
    start_time: b.start_time,
    end_time: b.end_time,
    details: b.details,
  }));

  const { error: insertError } = await supabase.from("blocks").insert(copies);
  if (insertError) throw insertError;
  revalidatePath("/calendar");
}
