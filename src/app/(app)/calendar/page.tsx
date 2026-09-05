import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QuickAddBlock } from "@/components/quick-add-block";
import { WeekCalendar } from "@/components/week-calendar";
import { DuplicateWeekButton } from "@/components/duplicate-week-button";
import { addDays, startOfWeek, todayInTimezone, weekDates } from "@/lib/dates";
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
    supabase.from("tags").select("*").eq("archived", false).order("sort_order"),
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
        <QuickAddBlock tags={tags ?? []} defaultDate={today} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <Link href={`/calendar?week=${prevWeek}`} className="text-sm text-text-muted hover:text-text">
          ← prev
        </Link>
        <p className="text-sm font-medium">
          {monday} – {weekEnd}
        </p>
        <Link href={`/calendar?week=${nextWeek}`} className="text-sm text-text-muted hover:text-text">
          next →
        </Link>
      </div>

      <WeekCalendar
        weekDates={dates}
        blocks={(blocks as unknown as BlockWithTag[]) ?? []}
        today={today}
      />
    </div>
  );
}
