"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deriveBlockTitle } from "@/lib/tags";

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

export async function createBlock(input: {
  tag_id: string;
  date: string;
  start_time: string;
  end_time: string;
  details?: string | null;
}) {
  const { supabase, userId } = await currentUserId();

  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .select("label, kind")
    .eq("id", input.tag_id)
    .single();
  if (tagError) throw tagError;

  const { error } = await supabase.from("blocks").insert({
    ...input,
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

  const sourceDate = new Date(`${sourceMonday}T00:00:00`);
  const targetDate = new Date(`${targetMonday}T00:00:00`);
  const dayOffset = Math.round((targetDate.getTime() - sourceDate.getTime()) / 86_400_000);

  const weekEnd = new Date(sourceDate);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { data: sourceBlocks, error: fetchError } = await supabase
    .from("blocks")
    .select("tag_id, title, date, start_time, end_time, details")
    .eq("user_id", userId)
    .gte("date", sourceMonday)
    .lte("date", weekEnd.toISOString().slice(0, 10));
  if (fetchError) throw fetchError;
  if (!sourceBlocks?.length) return;

  const copies = sourceBlocks.map((b) => {
    const d = new Date(`${b.date}T00:00:00`);
    d.setDate(d.getDate() + dayOffset);
    return {
      user_id: userId,
      tag_id: b.tag_id,
      title: b.title,
      date: d.toISOString().slice(0, 10),
      start_time: b.start_time,
      end_time: b.end_time,
      details: b.details,
    };
  });

  const { error: insertError } = await supabase.from("blocks").insert(copies);
  if (insertError) throw insertError;
  revalidatePath("/calendar");
}
