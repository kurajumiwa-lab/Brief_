// ---------------------------------------------------------------------------
// PRESENCE — deferred unmount, the exit half of the motion vocabulary.
//
// The entrance wrappers (Entering / MotionList) animate things IN; this
// animates them OUT. When `open` flips false the child fades and drops for one
// structural beat, THEN unmounts — so a tab switch or a collapsible section
// leaves instead of teleporting away. This is the custom-system equivalent of
// AnimatePresence: no new dependency, and driven by React state so it is
// deterministic and testable under jsdom (CSS keyframes would not run there).
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from 'react';
import { transitionFor } from './transitions';
import type { MotionEasingName, MotionTierName } from './transitions';

export interface PresenceProps {
  open: boolean;
  children: React.ReactNode;
  tier?: MotionTierName;
  easing?: MotionEasingName;
  /** How far (px) the child falls on exit. */
  drop?: number;
  style?: React.CSSProperties;
}

export function Presence({
  open,
  children,
  tier = 'structural',
  easing = 'standard',
  drop = 6,
  style
}: PresenceProps) {
  // We render the child for as long as `open` OR an exit is in flight.
  const [render, setRender] = useState(open);
  const [exiting, setExiting] = useState(false);
  const durationRef = useRef(0);

  // Resolve the transition once so the timeout matches the exact duration.
  const transition = transitionFor(['opacity', 'transform'], tier, easing);
  useEffect(() => {
    const match = /(\d+)ms/.exec(transition);
    durationRef.current = match ? Number(match[1]) : 200;
  }, [transition]);

  useEffect(() => {
    if (open) {
      setRender(true);
      setExiting(false);
      return;
    }
    // Start the exit; unmount after the transition completes.
    setExiting(true);
    const t = setTimeout(() => setRender(false), durationRef.current + 20);
    return () => clearTimeout(t);
  }, [open]);

  if (!render) return null;

  return (
    <div
      aria-hidden={exiting || undefined}
      style={{
        opacity: exiting ? 0 : 1,
        transform: exiting ? `translateY(${drop}px)` : 'translateY(0)',
        transition,
        ...style
      }}
    >
      {children}
    </div>
  );
}
