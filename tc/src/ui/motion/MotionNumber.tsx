// ---------------------------------------------------------------------------
// MOTION NUMBER — economic causality made visible.
//
// Consequential tier (480ms). When a money/quantity figure changes, the new
// value arrives with an emphasized settle and the DELTA is shown beside it
// (green up, red down) so the causal step is legible:
//
//     KES 4,200  →  KES 5,700  (+KES 1,500)
//
// It is NOT a rolling counter and never counts up from zero: the value is the
// value, and only a REAL change (previous provided and different) shows a
// delta. A number with no prior is displayed plainly.
// ---------------------------------------------------------------------------

import React from 'react';
import { Entering } from './Entering';
import type { MotionTierName } from './transitions';

export interface MotionNumberProps {
  value: number;
  previous?: number | null;
  currency?: string | null;
  format?: (n: number) => string;
  tier?: MotionTierName;
}

export function MotionNumber({
  value,
  previous = null,
  currency = null,
  format,
  tier = 'consequential'
}: MotionNumberProps) {
  const fmt = format ?? ((n: number) => n.toLocaleString());
  const delta = previous !== null && Number.isFinite(previous) ? value - previous : null;
  const prefix = currency ? `${currency} ` : '';

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      <Entering key={String(value)} tier={tier} easing="emphasized">
        {prefix}
        {fmt(value)}
      </Entering>
      {delta !== null && delta !== 0 && (
        <Entering
          key={`delta:${previous}:${value}`}
          tier="micro"
          easing="standard"
          style={{
            marginLeft: 10,
            color: delta > 0 ? 'var(--color-success)' : 'var(--color-danger)'
          }}
        >
          {delta > 0 ? '+' : '\u2212'}
          {prefix}
          {fmt(Math.abs(delta))}
        </Entering>
      )}
    </span>
  );
}
