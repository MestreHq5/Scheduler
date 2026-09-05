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

/**
 * Reparents a task by drag-and-drop. Its direct children are detached first
 * and promoted into independent root tasks, each starting its own branch —
 * grandchildren stay put since they're still attached to their own
 * (now-promoted) parent. The moved task itself then takes on the new parent
 * (or becomes a root when newParentId is null). This two-step order means
 * the moved task always has zero children by the time its own parent_id is
 * written, so a reparent can never create a cycle.
 */
export async function moveTask(id: string, newParentId: string | null) {
  const { supabase } = await currentUserId();

  const { error: detachError } = await supabase
    .from("tasks")
    .update({ parent_id: null })
    .eq("parent_id", id);
  if (detachError) throw detachError;

  const { error } = await supabase.from("tasks").update({ parent_id: newParentId }).eq("id", id);
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
