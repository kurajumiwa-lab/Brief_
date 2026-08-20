import React from 'react';

// ---------------------------------------------------------------------------
// MICRO BARS — tiny, honest comparison charts.
//
// The article's "richer interfaces" pattern: instead of flat KPI tiles, show
// how numbers relate. These are pure renderers — they take server-derived
// values and draw their proportions. They compute nothing and invent nothing;
// when every value is zero they render nothing rather than an empty chart.
// ---------------------------------------------------------------------------

export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

/** Horizontal proportional bars — e.g. settled vs pending money. */
export function MicroBars({
  items,
  accent = 'var(--signal-live)',
  neutral = 'var(--ink-dim)'
}: {
  items: BarItem[];
  accent?: string;
  neutral?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (max <= 0) return null;

  return (
    <div className="space-y-1.5">
      {items.map((i) => {
        const pct = Math.max(0, Math.min(100, (i.value / max) * 100));
        return (
          <div key={i.label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[9px]" style={{ color: 'var(--ink-faint)' }}>
              {i.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--ground)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: i.color ?? (i.value === max ? accent : neutral),
                  opacity: 0.85
                }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[9px]" style={{ color: 'var(--ink)' }}>
              {i.value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export interface FunnelStage {
  label: string;
  value: number;
}

/** A decreasing-width funnel — e.g. views → registered → arrived. */
export function Funnel({ stages, accent = 'var(--signal-live)' }: { stages: FunnelStage[]; accent?: string }) {
  const max = Math.max(0, ...stages.map((s) => s.value));
  if (max <= 0) return null;

  return (
    <div className="space-y-1">
      {stages.map((s, idx) => {
        const pct = Math.max(4, Math.min(100, (s.value / max) * 100));
        return (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[9px]" style={{ color: 'var(--ink-faint)' }}>
              {s.label}
            </span>
            <div className="flex-1">
              <div
                className="h-3 rounded-sm"
                style={{
                  width: `${pct}%`,
                  background: accent,
                  opacity: 0.25 + 0.75 * (1 - idx / Math.max(1, stages.length))
                }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-[9px]" style={{ color: 'var(--ink)' }}>
              {s.value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
