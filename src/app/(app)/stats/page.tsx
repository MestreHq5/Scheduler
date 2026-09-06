import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/section";
import { StatsExplorer } from "@/components/stats-explorer";
import { TagBreakdown } from "@/components/tag-breakdown";
import { addMonths, todayInTimezone } from "@/lib/dates";

type BlockRow = { tag_id: string | null; date: string; start_time: string; end_time: string };
type TaskRow = { tag_id: string | null; depth: number; done: boolean; completed_at: string | null };

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
  const windowStart = addMonths(today, -12);

  const [{ data: tags }, { data: blocks }, { data: tasks }] = await Promise.all([
    supabase.from("tags").select("*").eq("archived", false).order("sort_order").order("created_at"),
    supabase
      .from("blocks")
      .select("tag_id, date, start_time, end_time")
      .eq("archived", false)
      .gte("date", windowStart)
      .lte("date", today),
    supabase.from("tasks").select("tag_id, depth, done, completed_at").eq("archived", false),
  ]);

  const blockRows = (blocks as unknown as BlockRow[]) ?? [];
  const taskRows = (tasks as unknown as TaskRow[]) ?? [];

  return (
    <div>
      <h1 className="font-display text-3xl mb-6">Stats</h1>

      <Section title="Study time">
        <StatsExplorer tags={tags ?? []} blocks={blockRows} today={today} />
      </Section>

      <Section title="Tag breakdown">
        <TagBreakdown tags={tags ?? []} blocks={blockRows} tasks={taskRows} today={today} />
      </Section>
    </div>
  );
}
