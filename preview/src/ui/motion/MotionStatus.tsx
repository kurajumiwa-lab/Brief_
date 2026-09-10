// ---------------------------------------------------------------------------
// MOTION STATUS — a state change that is felt, not shouted.
//
// Consequential tier (480ms). A status badge whose color is the semantic token
// for that state (success / warning / danger / muted). When the status changes
// the badge re-enters with an emphasized settle. It never animates a spinner;
// it reports, it does not promise.
// ---------------------------------------------------------------------------

import React from 'react';
import { Entering } from './Entering';
import type { MotionTierName } from './transitions';

// Status -> semantic color token. Unknown states fall back to muted text, so a
// new status can never render an unreadable badge.
const STATUS_COLOR: Record<string, string> = {
  confirmed: 'var(--color-success)',
  completed: 'var(--color-success)',
  settled: 'var(--color-success)',
  active: 'var(--color-success)',
  live: 'var(--color-success)',
  ready: 'var(--color-success)',
  pending: 'var(--color-warning)',
  processing: 'var(--color-warning)',
  in_progress: 'var(--color-warning)',
  failed: 'var(--color-danger)',
  cancelled: 'var(--color-danger)',
  refused: 'var(--color-danger)',
  expired: 'var(--color-danger)',
  disputed: 'var(--color-danger)'
};

export interface MotionStatusProps {
  status: string;
  label?: string;
  tier?: MotionTierName;
}

export function MotionStatus({ status, label, tier = 'consequential' }: MotionStatusProps) {
  const key = String(status).toLowerCase();
  const color = STATUS_COLOR[key] ?? 'var(--color-text-muted)';
  const text = label ?? key;

  return (
    <Entering
      key={key}
      tier={tier}
      easing="emphasized"
      style={{
        color,
        background: 'var(--color-surface)',
        border: `1px solid ${color}`,
        borderRadius: 'var(--radius-pill)',
        padding: '2px 10px',
        fontSize: 'var(--brief-label)'
      }}
    >
      {text}
    </Entering>
  );
}
