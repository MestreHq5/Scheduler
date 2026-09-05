import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { TagPill } from "@/components/tag-pill";
import { TaskCheckbox } from "@/components/task-checkbox";
import { BarChart } from "@/components/bar-chart";
import { todayInTimezone, startOfWeek, weekDates } from "@/lib/dates";

const QUOTE = "Ad astra per aspera.";

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
}

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
  const monday = startOfWeek(today);
  const weekEnd = weekDates(monday)[6]!;

  const [{ data: tags }, { data: todayBlocks }, { data: openTasks }, { data: deadlines }, { data: weekBlocks }] =
    await Promise.all([
      supabase.from("tags").select("*").eq("archived", false).order("sort_order"),
      supabase
        .from("blocks")
        .select("*, tag:tags(label,color)")
        .eq("archived", false)
        .eq("date", today)
        .order("start_time"),
      supabase
        .from("tasks")
        .select("*, tag:tags(label,color)")
        .eq("archived", false)
        .eq("done", false)
        .is("parent_id", null)
        .order("created_at", { ascending: true })
        .limit(6),
      supabase
        .from("tasks")
        .select("*, tag:tags(label,color)")
        .eq("archived", false)
        .eq("done", false)
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(6),
      supabase
        .from("blocks")
        .select("tag_id, start_time, end_time, tag:tags(label,color)")
        .eq("archived", false)
        .gte("date", monday)
        .lte("date", weekEnd),
    ]);

  const openTaskCountByTag = new Map<string, { label: string; color: string; count: number }>();
  for (const t of (openTasks as unknown as { tag_id: string | null; tag: { label: string; color: string } | null }[]) ?? []) {
    if (!t.tag_id || !t.tag) continue;
    const cur = openTaskCountByTag.get(t.tag_id) ?? { label: t.tag.label, color: t.tag.color, count: 0 };
    cur.count += 1;
    openTaskCountByTag.set(t.tag_id, cur);
  }

  const hoursByTag = new Map<string, { label: string; color: string; hours: number }>();
  for (const b of (weekBlocks as unknown as {
    tag_id: string | null;
    start_time: string;
    end_time: string;
    tag: { label: string; color: string } | null;
  }[]) ?? []) {
    if (!b.tag_id || !b.tag) continue;
    const hrs = (timeToMinutes(b.end_time) - timeToMinutes(b.start_time)) / 60;
    const cur = hoursByTag.get(b.tag_id) ?? { label: b.tag.label, color: b.tag.color, hours: 0 };
    cur.hours += hrs;
    hoursByTag.set(b.tag_id, cur);
  }

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
            ).toLocaleDateString()}. Past events keep their original local time; upcoming imported events use the new timezone.`}
          >
            Timezone changed recently — hover for details
          </p>
        )}
      </header>

      <Section title="Today's blocks" href="/calendar">
        {!todayBlocks?.length && <p className="text-sm text-text-muted">Nothing scheduled today.</p>}
        <ul className="space-y-2">
          {(todayBlocks as unknown as { id: string; title: string; start_time: string; end_time: string; tag: { label: string; color: string } | null }[] | null)?.map(
            (b) => (
              <li
                key={b.id}
                className="rounded-xl px-3.5 py-2.5 flex items-center justify-between"
                style={{ backgroundColor: `${b.tag?.color ?? "#64748b"}18` }}
              >
                <span className="text-sm font-medium">{b.title}</span>
                <span className="text-xs text-text-muted">
                  {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                </span>
              </li>
            ),
          )}
        </ul>
      </Section>

      <Section title="Tasks" href="/tasks">
        {!openTasks?.length && <p className="text-sm text-text-muted">Nothing open.</p>}
        <ul className="space-y-1">
          {(openTasks as unknown as { id: string; title: string; done: boolean; tag: { label: string; color: string } | null }[] | null)?.map(
            (t) => (
              <li key={t.id} className="flex items-center gap-3 px-1 py-1.5">
                <TaskCheckbox id={t.id} done={t.done} />
                <span className="text-sm flex-1">{t.title}</span>
                <TagPill tag={t.tag} />
              </li>
            ),
          )}
        </ul>
      </Section>

      <Section title="Deadlines" href="/tasks">
        {!deadlines?.length && <p className="text-sm text-text-muted">No upcoming deadlines.</p>}
        <ul className="space-y-1">
          {(deadlines as unknown as { id: string; title: string; due_date: string; tag: { label: string; color: string } | null }[] | null)?.map(
            (t) => (
              <li key={t.id} className="flex items-center justify-between px-1 py-1.5">
                <span className="text-sm">{t.title}</span>
                <div className="flex items-center gap-2">
                  <TagPill tag={t.tag} />
                  <span className="text-xs text-text-muted">{t.due_date}</span>
                </div>
              </li>
            ),
          )}
        </ul>
      </Section>

      <Section title="Stats">
        <div className="grid grid-cols-1 gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted mb-3">Open tasks per unit</p>
            <BarChart bars={[...openTaskCountByTag.values()].map((v) => ({ label: v.label, value: v.count, color: v.color }))} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted mb-3">Hours scheduled this week</p>
            <BarChart
              bars={[...hoursByTag.values()].map((v) => ({ label: v.label, value: Math.round(v.hours * 10) / 10, color: v.color }))}
              valueSuffix="h"
            />
          </div>
        </div>
      </Section>

      {!tags?.length && (
        <p className="text-sm text-text-muted">
          No tags yet — add your curricular units in Settings to get started.
        </p>
      )}
    </div>
  );
}
