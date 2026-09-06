"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { clsx } from "clsx";
// Deep import: `PrefetchKind` isn't re-exported from the public `next/navigation`
// entry point, but `router.prefetch`'s `kind` option is typed against this exact
// enum (not a string literal) in Next 15, so this is the only way to pass "full".
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";

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

  // The default prefetch only warms the static shell for a searchParams-driven
  // page like this one — it skips the actual Supabase-backed data. Forcing a
  // "full" prefetch of both neighbors means the RSC payload is already cached
  // by the time the user clicks, so back-to-back navigation feels instant
  // instead of paying a fresh round-trip per click.
  useEffect(() => {
    router.prefetch(`/calendar?week=${prevWeek}`, { kind: PrefetchKind.FULL });
    router.prefetch(`/calendar?week=${nextWeek}`, { kind: PrefetchKind.FULL });
  }, [router, prevWeek, nextWeek]);

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
