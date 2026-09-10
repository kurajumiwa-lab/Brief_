// ---------------------------------------------------------------------------
// MOTION CARD — a surface that arrives, once, and then stays still.
//
// Structural tier (260ms). A card fades in and rises 8px on mount; after that
// it does not move on hover (no fly-cards). Colors reference the canonical
// tokens only.
// ---------------------------------------------------------------------------

import React from 'react';
import { Entering } from './Entering';
import type { MotionEasingName, MotionTierName } from './transitions';

export interface MotionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tier?: MotionTierName;
  easing?: MotionEasingName;
}

export function MotionCard({
  children,
  tier = 'structural',
  easing = 'standard',
  style,
  ...rest
}: MotionCardProps) {
  return (
    <div
      {...rest}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: 16,
        ...style
      }}
    >
      <Entering tier={tier} easing={easing} style={{ display: 'block' }}>
        {children}
      </Entering>
    </div>
  );
}
