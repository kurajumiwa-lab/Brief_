// ---------------------------------------------------------------------------
// ENTERING — the shared fade-and-rise entrance, driven by React state.
//
// Real CSS keyframe animations do not run under jsdom, and a component whose
// motion is a CSS class is therefore untestable there. This wrapper expresses
// the SAME motion as state: the first render is the "from" state (opacity 0,
// rise), and one tick later it settles to the "to" state (opacity 1, settled).
// The transition string it emits uses the canonical tokens, so it is honest
// and deterministic in both a browser and a test.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { transitionFor } from './transitions';
import type { MotionEasingName, MotionTierName } from './transitions';

export interface EnteringProps extends React.HTMLAttributes<HTMLSpanElement> {
  tier?: MotionTierName;
  easing?: MotionEasingName;
  /** Stagger delay in ms before the entrance begins. */
  delay?: number;
  /** How far (px) the element rises on entrance. */
  rise?: number;
}

export function Entering({
  children,
  tier = 'structural',
  easing = 'standard',
  delay = 0,
  rise = 8,
  style,
  ...rest
}: EnteringProps) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), delay + 16);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <span
      {...rest}
      style={{
        display: 'inline-block',
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : `translateY(${rise}px)`,
        transition: transitionFor(['opacity', 'transform'], tier, easing),
        ...style
      }}
    >
      {children}
    </span>
  );
}
