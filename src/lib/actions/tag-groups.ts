"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

export async function createTagGroup(input: { label: string; color: string; is_study_unit: boolean }) {
  const { supabase, userId } = await currentUserId();
  const { error } = await supabase.from("tag_groups").insert({ ...input, user_id: userId });
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function updateTagGroup(
  id: string,
  input: Partial<{ label: string; color: string; is_study_unit: boolean }>,
) {
  const { supabase } = await currentUserId();
  const { error } = await supabase.from("tag_groups").update(input).eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

/** Tags in this group become ungrouped (group_id -> null via FK ON DELETE SET NULL). */
export async function deleteTagGroup(id: string) {
  const { supabase } = await currentUserId();
  const { error } = await supabase.from("tag_groups").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}
