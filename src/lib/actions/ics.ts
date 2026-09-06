"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseIcs } from "@/lib/ics";
import { deriveBlockTitle, randomTagColor } from "@/lib/tags";
import { instantToLocalParts } from "@/lib/dates";

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

/**
 * One-shot .ics import — not a persistent feed, nothing to re-sync. Creates
 * a brand-new tag named `tagLabel` and adds every event in the file as a
 * block under that tag (same color/title, like any tag-derived block).
 * The event's SUMMARY becomes the block's `details` text and LOCATION
 * becomes `location` — block `title` stays tag-derived, never typed.
 * Importing again (same file or a different one) just makes another tag.
 */
export async function importIcsAsTag(tagLabel: string, file: File) {
  const { supabase, userId } = await currentUserId();

  const label = tagLabel.trim();
  if (!label) throw new Error("Tag name is required.");

  const text = await file.text();
  const events = parseIcs(text);

  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .insert({ user_id: userId, label, color: randomTagColor() })
    .select("id")
    .single();
  if (tagError) throw tagError;

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", userId).single();
  const timezone = profile?.timezone ?? "Europe/Lisbon";

  const title = deriveBlockTitle({ label, kind: null, group: null });

  const rows = events.map((e) => {
    const start = instantToLocalParts(e.startsAt, timezone);
    const end = instantToLocalParts(e.endsAt, timezone);
    return {
      user_id: userId,
      tag_id: tag.id,
      title,
      date: start.date,
      start_time: start.time,
      end_time: end.time,
      details: e.title.slice(0, 200),
      location: e.location ? e.location.slice(0, 60) : e.location,
    };
  });

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("blocks").insert(rows);
    if (insertError) throw insertError;
  }

  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/");

  return { count: rows.length, label };
}
