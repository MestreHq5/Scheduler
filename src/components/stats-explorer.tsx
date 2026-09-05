"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import type { Tag } from "@/lib/database.types";
import { LineChart } from "@/components/line-chart";
import { WheelDatePicker } from "@/components/wheel-date-picker";
import { contrastText } from "@/lib/color";
import {
  addDays,
  daysBetween,
  RANGE_PRESET_LABELS,
  resolveRangePreset,
  startOfWeek,
  weekDates,
  type RangePreset,
} from "@/lib/dates";

type BlockRow = { tag_id: string | null; date: string; start_time: string; end_time: string };

const PRESETS: RangePreset[] = ["thisWeek", "lastWeek", "thisMonth", "lastMonth", "last3m", "last6m", "last12m"];

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function hoursOf(b: BlockRow) {
  return (timeToMinutes(b.end_time) - timeToMinutes(b.start_time)) / 60;
}

/**
 * Multi-tag time-series plot + insight card. All filtering/aggregation runs
 * client-side over rows the server already fetched (up to the last 12
 * months, the longest preset) — this is fundamentally interactive filtering,
 * not something that benefits from a server round-trip per selection change.
 */
export function StatsExplorer({
  tags,
  blocks,
  today,
}: {
  tags: Tag[];
  blocks: BlockRow[];
  today: string;
}) {
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(() => new Set(tags.map((t) => t.id)));
  const [preset, setPreset] = useState<RangePreset | "custom">("thisMonth");
  const [customStart, setCustomStart] = useState(addDays(today, -30));
  const [customEnd, setCustomEnd] = useState(today);

  const { start, end } = preset === "custom" ? { start: customStart, end: customEnd } : resolveRangePreset(preset, today);

  const selectedTags = tags.filter((t) => selectedTagIds.has(t.id));

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const weeks = useMemo(() => {
    if (end < start) return [];
    const result: { weekStart: string; weekEnd: string }[] = [];
    let cursor = startOfWeek(start);
    let guard = 0;
    while (cursor <= end && guard < 400) {
      result.push({ weekStart: cursor, weekEnd: weekDates(cursor)[6]! });
      cursor = addDays(cursor, 7);
      guard++;
    }
    return result;
  }, [start, end]);

  const series = selectedTags.map((tag) => ({
    id: tag.id,
    label: tag.label,
    color: tag.color,
    values: weeks.map(({ weekStart, weekEnd }) => {
      const hrs = blocks
        .filter((b) => b.tag_id === tag.id && b.date >= weekStart && b.date <= weekEnd)
        .reduce((sum, b) => sum + hoursOf(b), 0);
      return Math.round(hrs * 10) / 10;
    }),
  }));

  const categories = weeks.map((w) => w.weekStart.slice(5));

  const insights = useMemo(() => {
    if (selectedTags.length === 0 || end < start) return [];
    const ids = new Set(selectedTags.map((t) => t.id));
    const inRange = blocks.filter((b) => b.tag_id && ids.has(b.tag_id) && b.date >= start && b.date <= end);
    const totalHours = inRange.reduce((s, b) => s + hoursOf(b), 0);

    const len = daysBetween(start, end) + 1;
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(start, -len);
    const prevHours = blocks
      .filter((b) => b.tag_id && ids.has(b.tag_id) && b.date >= prevStart && b.date <= prevEnd)
      .reduce((s, b) => s + hoursOf(b), 0);

    const items: string[] = [];

    if (prevHours > 0.05) {
      const pct = Math.round(((totalHours - prevHours) / prevHours) * 100);
      if (Math.abs(pct) >= 5) {
        items.push(
          `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% vs. the previous period (${Math.round(prevHours * 10) / 10}h → ${Math.round(totalHours * 10) / 10}h).`,
        );
      }
    } else if (totalHours > 0) {
      items.push(`No logged time in the previous period — ${Math.round(totalHours * 10) / 10}h this period is a fresh start.`);
    }

    const midMillis = (Date.parse(`${start}T00:00:00Z`) + Date.parse(`${end}T00:00:00Z`)) / 2;
    const mid = new Date(midMillis).toISOString().slice(0, 10);
    const firstHalf = inRange.filter((b) => b.date <= mid).reduce((s, b) => s + hoursOf(b), 0);
    const secondHalf = inRange.filter((b) => b.date > mid).reduce((s, b) => s + hoursOf(b), 0);
    if (firstHalf > 0.05 || secondHalf > 0.05) {
      const diff = secondHalf - firstHalf;
      if (Math.abs(diff) >= 0.5) {
        items.push(
          diff > 0
            ? "Picking up — the second half of this period logged more hours than the first."
            : "Declining — the second half of this period logged fewer hours than the first.",
        );
      } else {
        items.push("Steady pace across this period.");
      }
    }

    return items;
  }, [selectedTags, blocks, start, end]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreset(p)}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium border border-border transition-colors",
              preset === p ? "bg-surface-2 text-text" : "text-text-muted hover:text-text",
            )}
          >
            {RANGE_PRESET_LABELS[p]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreset("custom")}
          className={clsx(
            "rounded-full px-3 py-1 text-xs font-medium border border-border transition-colors",
            preset === "custom" ? "bg-surface-2 text-text" : "text-text-muted hover:text-text",
          )}
        >
          Custom
        </button>
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <WheelDatePicker
            value={customStart}
            onChange={(v) => v && setCustomStart(v)}
            allowClear={false}
            title="Start date"
            renderTrigger={({ value, open }) => (
              <button type="button" onClick={open} className="rounded-lg bg-surface-2 border border-border px-2 py-1.5 text-sm">
                {value}
              </button>
            )}
          />
          <span className="text-text-muted">to</span>
          <WheelDatePicker
            value={customEnd}
            onChange={(v) => v && setCustomEnd(v)}
            allowClear={false}
            title="End date"
            renderTrigger={({ value, open }) => (
              <button type="button" onClick={open} className="rounded-lg bg-surface-2 border border-border px-2 py-1.5 text-sm">
                {value}
              </button>
            )}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {tags.map((tag) => {
          const active = selectedTagIds.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className="rounded-full px-3 py-1.5 text-sm font-medium border transition-colors"
              style={
                active
                  ? { backgroundColor: tag.color, color: contrastText(tag.color), borderColor: "transparent" }
                  : { borderColor: "var(--color-border)", color: "var(--color-text-muted)" }
              }
            >
              {tag.label}
            </button>
          );
        })}
      </div>

      <LineChart categories={categories} series={series} valueSuffix="h" />

      {insights.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
          <p className="text-xs uppercase tracking-wide text-text-muted mb-2">Insights</p>
          <ul className="space-y-1.5 text-sm">
            {insights.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
