import { createClient } from "@/lib/supabase/server";
import { QuickAddBlock } from "@/components/quick-add-block";
import { WeekCalendar } from "@/components/week-calendar";
import { DuplicateWeekButton } from "@/components/duplicate-week-button";
import { WeekNav } from "@/components/week-nav";
import { addDays, formatDateDMY, startOfWeek, todayInTimezone, weekDates } from "@/lib/dates";
import type { Block } from "@/lib/database.types";

type BlockWithTag = Block & { tag: { label: string; color: string } | null };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
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

  const { week } = await searchParams;
  const monday = startOfWeek(week ?? today);
  const dates = weekDates(monday);
  const weekEnd = dates[6]!;

  const [{ data: tags }, { data: blocks }] = await Promise.all([
    supabase.from("tags").select("*").eq("archived", false).order("sort_order").order("created_at"),
    supabase
      .from("blocks")
      .select("*, tag:tags(label,color)")
      .eq("archived", false)
      .gte("date", monday)
      .lte("date", weekEnd),
  ]);

  const prevWeek = addDays(monday, -7);
  const nextWeek = addDays(monday, 7);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl">Calendar</h1>
        <DuplicateWeekButton sourceMonday={monday} targetMonday={nextWeek} />
      </div>

      <div className="mb-6">
        <QuickAddBlock tags={tags ?? []} defaultDate={today} timezone={timezone} />
      </div>

      <WeekNav prevWeek={prevWeek} nextWeek={nextWeek} label={`${formatDateDMY(monday)} – ${formatDateDMY(weekEnd)}`} />

      <WeekCalendar
        weekDates={dates}
        blocks={(blocks as unknown as BlockWithTag[]) ?? []}
        tags={tags ?? []}
        today={today}
        timezone={timezone}
      />
    </div>
  );
}
