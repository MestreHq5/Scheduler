import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { BarChart } from "@/components/bar-chart";
import { startOfWeek, addDays, weekDates, todayInTimezone, instantToLocalParts } from "@/lib/dates";

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
}

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user!.id)
    .single();
  const timezone = profile?.timezone ?? "Europe/Lisbon";
  const today = todayInTimezone(timezone);
  const thisMonday = startOfWeek(today);
  const lastMonday = addDays(thisMonday, -7);
  const twoAgoMonday = addDays(thisMonday, -14);

  const { data: blocks } = await supabase
    .from("blocks")
    .select("tag_id, date, start_time, end_time, tag:tags(label,color)")
    .eq("archived", false)
    .gte("date", twoAgoMonday)
    .lte("date", weekDates(thisMonday)[6]!);

  type Row = { tag_id: string | null; date: string; start_time: string; end_time: string; tag: { label: string; color: string } | null };
  const rows = (blocks as unknown as Row[]) ?? [];

  const { data: completedTasks } = await supabase
    .from("tasks")
    .select("completed_at")
    .eq("archived", false)
    .is("parent_id", null)
    .not("completed_at", "is", null)
    .gte("completed_at", `${twoAgoMonday}T00:00:00.000Z`);

  const completedLocalDates = (completedTasks ?? [])
    .map((t) => t.completed_at as string)
    .map((iso) => instantToLocalParts(iso, timezone).date);

  function weekHoursByTag(monday: string) {
    const end = weekDates(monday)[6]!;
    const map = new Map<string, { label: string; color: string; hours: number }>();
    for (const b of rows) {
      if (b.date < monday || b.date > end || !b.tag_id || !b.tag) continue;
      const hrs = (timeToMinutes(b.end_time) - timeToMinutes(b.start_time)) / 60;
      const cur = map.get(b.tag_id) ?? { label: b.tag.label, color: b.tag.color, hours: 0 };
      cur.hours += hrs;
      map.set(b.tag_id, cur);
    }
    return [...map.values()].map((v) => ({ label: v.label, value: Math.round(v.hours * 10) / 10, color: v.color }));
  }

  function completedTasksInWeek(monday: string) {
    const end = weekDates(monday)[6]!;
    return completedLocalDates.filter((d) => d >= monday && d <= end).length;
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Stats</h1>
      <p className="text-sm text-text-muted mb-6">
        Current week compared with the previous two — a quick gut-check on
        whether the week actually went the way it was planned.
      </p>

      <Section title="This week">
        <BarChart bars={weekHoursByTag(thisMonday)} valueSuffix="h" />
      </Section>

      <Section title="Last week">
        <BarChart bars={weekHoursByTag(lastMonday)} valueSuffix="h" />
      </Section>

      <Section title="Two weeks ago">
        <BarChart bars={weekHoursByTag(twoAgoMonday)} valueSuffix="h" />
      </Section>

      <Section title="Main tasks completed (last 3 weeks)">
        <BarChart
          bars={[
            { label: "This week", value: completedTasksInWeek(thisMonday), color: "#5eead4" },
            { label: "Last week", value: completedTasksInWeek(lastMonday), color: "#5eead4" },
            { label: "2 weeks ago", value: completedTasksInWeek(twoAgoMonday), color: "#5eead4" },
          ]}
        />
      </Section>
    </div>
  );
}
