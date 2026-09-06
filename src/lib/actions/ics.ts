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
 * One-shot .ics import — not a persistent feed, nothing to re-sync. Each
 * event's CATEGORIES value names the tag it's imported under; a brand-new
 * tag is created per distinct category found in the file (own random
 * color), so one file can populate several differently-tagged/colored sets
 * of blocks at once. LOCATION is parsed but intentionally not stored
 * (blocks has no location field); the event's SUMMARY becomes the block's
 * `details` text instead, truncated to 30 characters — block `title` stays
 * tag-derived, never typed. Importing again (same file or a different one)
 * just makes more tags.
 */
export async function importIcsAsTags(file: File) {
  const { supabase, userId } = await currentUserId();

  const text = await file.text();
  const events = parseIcs(text);

  const tagLabels = [...new Set(events.map((e) => e.tagLabel))];

  const { data: newTags, error: tagError } = await supabase
    .from("tags")
    .insert(tagLabels.map((label) => ({ user_id: userId, label, color: randomTagColor() })))
    .select("id, label");
  if (tagError) throw tagError;

  const tagIdByLabel = new Map(newTags.map((t) => [t.label, t.id]));

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", userId).single();
  const timezone = profile?.timezone ?? "Europe/Lisbon";

  const rows = events.map((e) => {
    const start = instantToLocalParts(e.startsAt, timezone);
    const end = instantToLocalParts(e.endsAt, timezone);
    return {
      user_id: userId,
      tag_id: tagIdByLabel.get(e.tagLabel)!,
      title: deriveBlockTitle({ label: e.tagLabel, kind: null, group: null }),
      date: start.date,
      start_time: start.time,
      end_time: end.time,
      details: e.title.slice(0, 30),
    };
  });

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("blocks").insert(rows);
    if (insertError) throw insertError;
  }

  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/");

  return { count: rows.length, tagLabels };
}
