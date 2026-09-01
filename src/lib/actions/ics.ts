"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseIcs } from "@/lib/ics";
import type { IcsSource } from "@/lib/database.types";

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

export async function saveIcsFeedUrl(source: IcsSource, url: string) {
  const { supabase, userId } = await currentUserId();
  const { error } = await supabase
    .from("ics_feeds")
    .upsert({ user_id: userId, source, kind: "url", url, storage_path: null }, { onConflict: "user_id,source" });
  if (error) throw error;
  revalidatePath("/settings");
}

export async function uploadIcsFile(source: IcsSource, file: File) {
  const { supabase, userId } = await currentUserId();
  const path = `${userId}/${source}.ics`;

  const { error: uploadError } = await supabase.storage
    .from("ics-feeds")
    .upload(path, file, { upsert: true, contentType: "text/calendar" });
  if (uploadError) throw uploadError;

  const { error } = await supabase
    .from("ics_feeds")
    .upsert({ user_id: userId, source, kind: "file", storage_path: path, url: null }, { onConflict: "user_id,source" });
  if (error) throw error;

  revalidatePath("/settings");
}

/**
 * Manual sync for now — fetches (URL) or reads (uploaded file) the feed,
 * parses it, and upserts into imported_events keyed on raw_uid so re-syncs
 * just update existing rows. The periodic/automatic version of this belongs
 * in a Supabase Edge Function on pg_cron (see README) once deployed.
 */
export async function syncIcsFeed(source: IcsSource) {
  const { supabase, userId } = await currentUserId();

  const { data: feed, error: feedError } = await supabase
    .from("ics_feeds")
    .select("*")
    .eq("user_id", userId)
    .eq("source", source)
    .single();
  if (feedError) throw feedError;

  try {
    let text: string;
    if (feed.kind === "url") {
      if (!feed.url) throw new Error("No URL configured");
      const res = await fetch(feed.url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      text = await res.text();
    } else {
      if (!feed.storage_path) throw new Error("No file uploaded");
      const { data, error } = await supabase.storage.from("ics-feeds").download(feed.storage_path);
      if (error) throw error;
      text = await data.text();
    }

    const events = parseIcs(text);
    const rows = events.map((e) => ({
      user_id: userId,
      source,
      title: e.title,
      starts_at: e.startsAt,
      ends_at: e.endsAt,
      location: e.location,
      raw_uid: e.uid,
      last_synced_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("imported_events")
        .upsert(rows, { onConflict: "user_id,source,raw_uid" });
      if (upsertError) throw upsertError;
    }

    await supabase
      .from("ics_feeds")
      .update({ last_synced_at: new Date().toISOString(), last_sync_status: "ok", last_sync_error: null })
      .eq("id", feed.id);
  } catch (err) {
    await supabase
      .from("ics_feeds")
      .update({
        last_sync_status: "error",
        last_sync_error: err instanceof Error ? err.message : String(err),
      })
      .eq("id", feed.id);
    throw err;
  }

  revalidatePath("/settings");
  revalidatePath("/scheduler");
}
