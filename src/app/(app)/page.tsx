import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { WeekCalendar } from "@/components/week-calendar";
import { DeadlinesPanel, type DeadlineTask } from "@/components/deadlines-panel";
import { TagTracker, type TrackedBlock } from "@/components/tag-tracker";
import { WorkProgress } from "@/components/work-progress";
import { addDays, todayInTimezone } from "@/lib/dates";
import type { Block, Tag } from "@/lib/database.types";

const QUOTE = "Ad astra per aspera.";
const TRACKER_WINDOW_DAYS = 120;
const DEADLINE_WINDOW_DAYS = 14;

type BlockWithTag = Block & { tag: { label: string; color: string } | null };
type BlockWithWork = Block & { tag: { label: string; color: string; counts_as_work: boolean } | null };

export default async function HubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, previous_timezone, timezone_changed_at")
    .eq("id", user!.id)
    .single();
  const timezone = profile?.timezone ?? "Europe/Lisbon";
  const today = todayInTimezone(timezone);

  const [{ data: tags }, { data: todayBlocks }, { data: deadlineTasks }, { data: trackedBlocks }] = await Promise.all([
    supabase.from("tags").select("*").eq("archived", false).order("sort_order"),
    supabase
      .from("blocks")
      .select("*, tag:tags(label,color,counts_as_work)")
      .eq("archived", false)
      .eq("date", today)
      .order("start_time"),
    supabase
      .from("tasks")
      .select("id, title, done, due_date, tag:tags(label,color)")
      .eq("archived", false)
      .eq("done", false)
      .not("due_date", "is", null)
      .lte("due_date", addDays(today, DEADLINE_WINDOW_DAYS))
      .order("due_date", { ascending: true }),
    supabase
      .from("blocks")
      .select("id, tag_id, date, start_time, end_time, title")
      .eq("archived", false)
      .gte("date", today)
      .lte("date", addDays(today, TRACKER_WINDOW_DAYS))
      .order("date")
      .order("start_time"),
  ]);

  const todayBlocksTyped = (todayBlocks as unknown as BlockWithWork[]) ?? [];

  const tzChanged =
    profile?.timezone_changed_at &&
    new Date(profile.timezone_changed_at) > new Date(Date.now() - 30 * 86_400_000);

  return (
    <div>
      <header className="mb-8 pt-2">
        <p className="font-display italic text-lg text-text-muted">{QUOTE}</p>
        <h1 className="font-display text-4xl mt-1">Scheduler</h1>
        {tzChanged && (
          <p
            className="text-xs text-accent mt-2"
            title={`Changed from ${profile?.previous_timezone} on ${new Date(
              profile!.timezone_changed_at!,
            ).toLocaleDateString("en-GB")}. Past events keep their original local time; upcoming imported events use the new timezone.`}
          >
            Timezone changed recently — hover for details
          </p>
        )}
      </header>

      <div className="mb-8">
        <WorkProgress
          blocks={todayBlocksTyped.map((b) => ({
            start_time: b.start_time,
            end_time: b.end_time,
            countsAsWork: b.tag ? b.tag.counts_as_work : true,
          }))}
          timezone={timezone}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14">
        <div>
          <Section title="Deadlines" href="/tasks">
            <DeadlinesPanel tasks={(deadlineTasks as unknown as DeadlineTask[]) ?? []} today={today} />
          </Section>

          <Section title="Track a tag">
            <TagTracker tags={(tags as Tag[]) ?? []} blocks={(trackedBlocks as unknown as TrackedBlock[]) ?? []} />
          </Section>
        </div>

        <div>
          <Section title="Today" href="/calendar">
            <WeekCalendar
              weekDates={[today]}
              blocks={todayBlocksTyped as unknown as BlockWithTag[]}
              tags={(tags as Tag[]) ?? []}
              today={today}
              timezone={timezone}
              heightClassName="h-[60dvh]"
            />
          </Section>
        </div>
      </div>

      {!tags?.length && (
        <p className="text-sm text-text-muted mt-6">
          No tags yet — add your curricular units in Settings to get started.
        </p>
      )}
    </div>
  );
}
