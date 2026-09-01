"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TagKind } from "@/lib/database.types";

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

export async function createTag(input: { label: string; color: string; kind: TagKind }) {
  const { supabase, userId } = await currentUserId();
  const { error } = await supabase.from("tags").insert({ ...input, user_id: userId });
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function updateTag(
  id: string,
  input: Partial<{ label: string; color: string; kind: TagKind }>,
) {
  const { supabase } = await currentUserId();
  const { error } = await supabase.from("tags").update(input).eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

/**
 * Archiving a tag also archives its *future* tasks/blocks (undone tasks with
 * no due date or a future due date; blocks dated today or later). Past
 * records are left untouched. Unarchiving reverses exactly that set.
 */
export async function setTagArchived(id: string, archived: boolean) {
  const { supabase, userId } = await currentUserId();
  const today = new Date().toISOString().slice(0, 10);

  const { error: tagError } = await supabase.from("tags").update({ archived }).eq("id", id);
  if (tagError) throw tagError;

  const { error: taskError } = await supabase
    .from("tasks")
    .update({ archived })
    .eq("user_id", userId)
    .eq("tag_id", id)
    .or(`due_date.is.null,due_date.gte.${today}`);
  if (taskError) throw taskError;

  const { error: blockError } = await supabase
    .from("blocks")
    .update({ archived })
    .eq("user_id", userId)
    .eq("tag_id", id)
    .gte("date", today);
  if (blockError) throw blockError;

  revalidatePath("/", "layout");
}

/** Tasks/blocks referencing this tag become tagless (tag_id -> null via FK ON DELETE SET NULL). */
export async function deleteTag(id: string) {
  const { supabase } = await currentUserId();
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}
