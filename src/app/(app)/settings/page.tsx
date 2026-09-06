import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { TagManager } from "@/components/tag-manager";
import { TagGroupManager } from "@/components/tag-group-manager";
import { TimezoneSettings } from "@/components/timezone-settings";
import { IcsImportForm } from "@/components/ics-import-form";
import { DragHoldSettings } from "@/components/drag-hold-settings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: tags }, { data: tagGroups }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("tags").select("*").order("sort_order").order("created_at"),
    supabase.from("tag_groups").select("*").order("sort_order").order("created_at"),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Settings</h1>

      <Section title="Timezone">
        <TimezoneSettings timezone={profile?.timezone ?? "Europe/Lisbon"} />
        <p className="text-xs text-text-muted mt-2">
          Used to convert .ics import times to your local date/time at the moment you import — like every block,
          the result is fixed then and won&apos;t move if you change timezones later.
        </p>
      </Section>

      <Section title="Tag groups">
        <TagGroupManager groups={tagGroups ?? []} />
        <p className="text-xs text-text-muted mt-2">
          Groups give tags an optional color and label (e.g. &quot;Curricular
          Units&quot;, &quot;Events&quot;). Mark a group &quot;study unit&quot; to prefix its
          tags&apos; block titles with &quot;Study&quot;.
        </p>
      </Section>

      <Section title="Tags">
        <TagManager tags={tags ?? []} groups={tagGroups ?? []} />
      </Section>

      <Section title="Interaction">
        <DragHoldSettings ms={profile?.task_drag_hold_ms ?? 450} />
        <p className="text-xs text-text-muted mt-2">
          How long to press and hold a task&apos;s grip handle on touch before
          dragging starts, to move it in the tree.
        </p>
      </Section>

      <Section title="Import .ics">
        <IcsImportForm />
      </Section>
    </div>
  );
}
