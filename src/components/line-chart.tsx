"use client";

import { useState } from "react";

type Series = { id: string; label: string; color: string; values: number[] };

/**
 * Dependency-free multi-series line chart (matches the app's existing
 * hand-rolled bar-chart.tsx rather than pulling in a charting library).
 * Series color is the tag's own color — tags already carry a fixed,
 * user-chosen identity color used everywhere else (pills, blocks), so that
 * identity is reused here rather than assigning a separate categorical ramp.
 */
export function LineChart({
  categories,
  series,
  valueSuffix = "h",
}: {
  categories: string[];
  series: Series[];
  valueSuffix?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const width = 640;
  const height = 240;
  const padLeft = 34;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 26;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const n = categories.length;

  const maxY = Math.max(1, ...series.flatMap((s) => s.values));

  function xAt(i: number) {
    return n <= 1 ? padLeft + chartW / 2 : padLeft + (i / (n - 1)) * chartW;
  }
  function yAt(v: number) {
    return padTop + chartH - (v / maxY) * chartH;
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    if (n <= 1) {
      setHoverIdx(0);
      return;
    }
    const idx = Math.round(((px - padLeft) / chartW) * (n - 1));
    setHoverIdx(Math.min(n - 1, Math.max(0, idx)));
  }

  if (series.length === 0 || n === 0) {
    return <p className="text-sm text-text-muted">Nothing to show yet.</p>;
  }

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.max(1, Math.ceil(n / 7));
  const tooltipX = hoverIdx !== null ? xAt(hoverIdx) : null;

  return (
    <div>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[420px] touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHoverIdx(null)}
        >
          {gridSteps.map((g) => {
            const y = padTop + chartH - g * chartH;
            return (
              <g key={g}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--color-text-muted)">
                  {Math.round(g * maxY * 10) / 10}
                </text>
              </g>
            );
          })}

          {categories.map(
            (c, i) =>
              i % labelEvery === 0 && (
                <text
                  key={c + i}
                  x={xAt(i)}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--color-text-muted)"
                >
                  {c}
                </text>
              ),
          )}

          {series.map((s) => (
            <path
              key={s.id}
              d={s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {tooltipX !== null && (
            <line
              x1={tooltipX}
              y1={padTop}
              x2={tooltipX}
              y2={padTop + chartH}
              stroke="var(--color-text-muted)"
              strokeWidth={1}
              strokeOpacity={0.4}
            />
          )}

          {hoverIdx !== null &&
            series.map((s) => (
              <circle
                key={s.id}
                cx={xAt(hoverIdx)}
                cy={yAt(s.values[hoverIdx] ?? 0)}
                r={4}
                fill={s.color}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            ))}
        </svg>
      </div>

      {hoverIdx !== null ? (
        <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
          <p className="text-text-muted mb-1">{categories[hoverIdx] ?? ""}</p>
          <div className="space-y-0.5">
            {series.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-2.5 h-0.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="font-semibold">
                  {s.values[hoverIdx] ?? 0}
                  {valueSuffix}
                </span>
                <span className="text-text-muted">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        series.length > 1 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {series.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        )
      )}

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="mt-2 text-[11px] text-text-muted hover:text-text underline underline-offset-2"
      >
        {showTable ? "Hide table" : "Table view"}
      </button>

      {showTable && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-text-muted font-normal py-1 pr-3">Week</th>
                {series.map((s) => (
                  <th key={s.id} className="text-right text-text-muted font-normal py-1 pl-3">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c + i} className="border-t border-border">
                  <td className="py-1 pr-3">{c}</td>
                  {series.map((s) => (
                    <td key={s.id} className="text-right py-1 pl-3 tabular-nums">
                      {s.values[i] ?? 0}
                      {valueSuffix}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
