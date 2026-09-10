// ---------------------------------------------------------------------------
// MOTION TRANSITIONS — the one way components build transition/animation
// strings, so a duration or easing is never hand-rolled inconsistently.
// ---------------------------------------------------------------------------

import { MotionDuration, MotionEasing, MotionTier } from './tokens';
import type { MotionEasingKey, MotionTierKey } from './tokens';

export type MotionTierName = MotionTierKey;
export type MotionEasingName = MotionEasingKey;

/** The duration (ms) for a semantic tier: micro -> fast, structural -> normal,
 *  consequential -> slow. */
export function durationFor(tier: MotionTierName = 'structural'): number {
  const key = MotionTier[tier];
  return MotionDuration[key];
}

export function easingFor(name: MotionEasingName = 'standard'): string {
  return MotionEasing[name];
}

/** A CSS `transition` value for one or more properties at a given tier. */
export function transitionFor(
  properties: string[],
  tier: MotionTierName = 'structural',
  easing: MotionEasingName = 'standard'
): string {
  return properties
    .map((p) => `${p} ${durationFor(tier)}ms ${easingFor(easing)}`)
    .join(', ');
}

/** A CSS `animation` shorthand for a named keyframe at a given tier. */
export function animationFor(
  keyframes: string,
  tier: MotionTierName = 'structural',
  easing: MotionEasingName = 'standard'
): string {
  return `${keyframes} ${durationFor(tier)}ms ${easingFor(easing)} both`;
}
