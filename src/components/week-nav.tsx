"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { clsx } from "clsx";

export function WeekNav({
  prevWeek,
  nextWeek,
  label,
}: {
  prevWeek: string;
  nextWeek: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(week: string) {
    startTransition(() => {
      router.push(`/calendar?week=${week}`, { scroll: false });
    });
  }

  return (
    <div className={clsx("flex items-center justify-between mb-4 transition-opacity", pending && "opacity-60")}>
      <button type="button" onClick={() => go(prevWeek)} className="text-sm text-text-muted hover:text-text">
        ← prev
      </button>
      <p className="text-sm font-medium">{label}</p>
      <button type="button" onClick={() => go(nextWeek)} className="text-sm text-text-muted hover:text-text">
        next →
      </button>
    </div>
  );
}
