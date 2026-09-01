import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { TagManager } from "@/components/tag-manager";
import { TimezoneSettings } from "@/components/timezone-settings";
import { IcsFeedSettings } from "@/components/ics-feed-settings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: tags }, { data: icsFeeds }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("tags").select("*").order("sort_order"),
    supabase.from("ics_feeds").select("*").eq("user_id", user!.id),
  ]);

  const classesFeed = icsFeeds?.find((f) => f.source === "classes") ?? null;
  const testsFeed = icsFeeds?.find((f) => f.source === "tests") ?? null;

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Settings</h1>

      <Section title="Timezone">
        <TimezoneSettings timezone={profile?.timezone ?? "Europe/Lisbon"} />
        <p className="text-xs text-text-muted mt-2">
          Only affects imported calendar events going forward — past events keep
          their original local time, and Scheduler blocks/task due dates aren&apos;t
          timezone-relative at all.
        </p>
      </Section>

      <Section title="Tags">
        <TagManager tags={tags ?? []} />
      </Section>

      <Section title="Calendar sync">
        <div className="space-y-3">
          <IcsFeedSettings source="classes" feed={classesFeed} />
          <IcsFeedSettings source="tests" feed={testsFeed} />
        </div>

        <div className="rounded-xl border border-dashed border-border p-4 mt-3">
          <p className="text-sm font-medium mb-1">Google Calendar</p>
          <p className="text-xs text-text-muted mb-3">
            Explicit import or export — never both silently. Needs a Google Cloud
            OAuth client with the Calendar scope (separate from the Google login
            above); not wired up yet.
          </p>
          <div className="flex gap-2">
            <button
              disabled
              className="rounded-lg border border-border px-3 py-2 text-xs text-text-muted cursor-not-allowed"
            >
              Import from Google Calendar
            </button>
            <button
              disabled
              className="rounded-lg border border-border px-3 py-2 text-xs text-text-muted cursor-not-allowed"
            >
              Export to Google Calendar
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}
