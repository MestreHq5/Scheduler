"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { instantToLocalParts } from "@/lib/dates";

/**
 * Changing timezone must never rewrite past records. Scheduler blocks and
 * task due dates are stored as plain wall-clock date/time (not an absolute
 * instant), so they're naturally unaffected either way. Imported .ics/Google
 * events DO carry a real UTC instant, so on a tz change we freeze the local
 * display of already-past events using the OLD timezone, while future events
 * keep re-deriving their display live from the new one.
 */
export async function changeTimezone(newTimezone: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;

  const oldTimezone = profile.timezone;
  if (oldTimezone === newTimezone) return;

  const nowIso = new Date().toISOString();

  const { data: pastEvents, error: fetchError } = await supabase
    .from("imported_events")
    .select("id, starts_at, ends_at")
    .eq("user_id", user.id)
    .lt("starts_at", nowIso)
    .is("frozen_date", null);
  if (fetchError) throw fetchError;

  for (const ev of pastEvents ?? []) {
    const start = instantToLocalParts(ev.starts_at, oldTimezone);
    const end = instantToLocalParts(ev.ends_at, oldTimezone);
    await supabase
      .from("imported_events")
      .update({
        frozen_date: start.date,
        frozen_start_time: start.time,
        frozen_end_time: end.time,
      })
      .eq("id", ev.id);
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      timezone: newTimezone,
      previous_timezone: oldTimezone,
      timezone_changed_at: nowIso,
    })
    .eq("id", user.id);
  if (updateError) throw updateError;

  revalidatePath("/", "layout");
}

/** How long a touch-and-hold on a task's grip handle takes before drag starts. */
export async function changeDragHoldDuration(ms: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ task_drag_hold_ms: ms })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath("/tasks");
}
