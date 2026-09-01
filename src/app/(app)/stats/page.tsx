import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { BarChart } from "@/components/bar-chart";
import { startOfWeek, addDays, weekDates, todayInTimezone } from "@/lib/dates";

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

  function weekCountByLabel(monday: string, matchLabel: (l: string) => boolean) {
    const end = weekDates(monday)[6]!;
    return rows.filter((b) => b.date >= monday && b.date <= end && b.tag && matchLabel(b.tag.label)).length;
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

      <Section title="Gym check-ins (last 3 weeks)">
        <BarChart
          bars={[
            { label: "This week", value: weekCountByLabel(thisMonday, (l) => l === "Gym"), color: "#22c55e" },
            { label: "Last week", value: weekCountByLabel(lastMonday, (l) => l === "Gym"), color: "#22c55e" },
            { label: "2 weeks ago", value: weekCountByLabel(twoAgoMonday, (l) => l === "Gym"), color: "#22c55e" },
          ]}
        />
      </Section>
    </div>
  );
}
