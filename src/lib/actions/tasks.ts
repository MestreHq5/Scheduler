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

export async function createTask(input: {
  title: string;
  tag_id: string | null;
  due_date: string | null;
  parent_id: string | null;
}) {
  const { supabase, userId } = await currentUserId();
  const { error } = await supabase.from("tasks").insert({ ...input, user_id: userId });
  if (error) throw error;
  revalidatePath("/tasks");
  revalidatePath("/");
}

/**
 * Toggles `done` on a leaf task. If the task has children, the DB trigger
 * (tasks_derive_done) silently overrides this and keeps `done` derived —
 * so this is always safe to call from a checkbox regardless of node type.
 */
export async function toggleTaskDone(id: string, done: boolean) {
  const { supabase } = await currentUserId();
  const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
  if (error) throw error;
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function updateTask(
  id: string,
  input: Partial<{ title: string; tag_id: string | null; due_date: string | null; notes: string | null }>,
) {
  const { supabase } = await currentUserId();
  const { error } = await supabase.from("tasks").update(input).eq("id", id);
  if (error) throw error;
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  const { supabase } = await currentUserId();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/tasks");
  revalidatePath("/");
}
