// ---------------------------------------------------------------------------
// MOTION LIST — items that arrive in order, each a beat apart.
//
// Structural tier. Children enter one after another with a small stagger, so a
// list reads as a sequence instead of a single flash. The stagger is additive
// (not multiplicative) and bounded: it is a delay, never a pile-up.
// ---------------------------------------------------------------------------

import React from 'react';
import { Entering } from './Entering';
import type { MotionEasingName, MotionTierName } from './transitions';

export interface MotionListProps extends React.HTMLAttributes<HTMLDivElement> {
  tier?: MotionTierName;
  easing?: MotionEasingName;
  /** Delay between successive items, in ms. */
  stagger?: number;
}

export function MotionList({
  children,
  tier = 'structural',
  easing = 'standard',
  stagger = 40,
  ...rest
}: MotionListProps) {
  const items = React.Children.toArray(children);
  return (
    <div {...rest}>
      {items.map((child, i) => (
        <Entering
          key={i}
          tier={tier}
          easing={easing}
          delay={i * stagger}
          style={{ display: 'block' }}
        >
          {child}
        </Entering>
      ))}
    </div>
  );
}
