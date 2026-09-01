export function BarChart({
  bars,
  valueSuffix = "",
}: {
  bars: { label: string; value: number; color: string }[];
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));

  if (bars.length === 0) {
    return <p className="text-sm text-text-muted">Nothing to show yet.</p>;
  }

  return (
    <div className="space-y-2.5">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-xs text-text-muted w-24 shrink-0 truncate">{b.label}</span>
          <div className="flex-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(b.value / max) * 100}%`, backgroundColor: b.color }}
            />
          </div>
          <span className="text-xs text-text-muted w-10 text-right shrink-0">
            {b.value}
            {valueSuffix}
          </span>
        </div>
      ))}
    </div>
  );
}
