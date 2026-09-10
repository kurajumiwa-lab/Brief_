// ---------------------------------------------------------------------------
// MOTION TOKENS — the three tiers of stateful motion.
//
// The critique's spec (§4): silent product identity, stateful motion ONLY,
// three tiers:
//   micro         100–180ms   buttons, toggles, chips
//   structural    200–350ms   cards, nav, sheets
//   consequential 350–700ms   payment confirmed, completed order, onboarding
//                             rung, trust event, partner milestone
//
// CSS is the single source of truth for the COLOR palette and the RADIUS
// scale; the --motion-* and --ease-* custom properties live alongside them in
// src/ui/theme.css (:root). These TS constants MUST stay in sync with those
// custom properties so JS-driven motion (inline styles, tweens) uses the SAME
// numbers a stylesheet would. The test suite pins them inside the spec ranges.
//
// Hard rules (asserted in tests, never to be relaxed):
//   * no bounce, no elastic — every easing is a decelerating cubic-bezier.
//   * no infinite loops here — the marquee/breathe loops that DO exist live in
//     the stylesheet and are functional (a ticker, a live pulse), not garnish.
// ---------------------------------------------------------------------------

export const MotionDuration = {
  fast: 140,   // micro — buttons/toggles/chips        (spec 100–180ms)
  normal: 260, // structural — cards/nav/sheets        (spec 200–350ms)
  slow: 480    // consequential — the money/trust beats (spec 350–700ms)
} as const;

export const MotionEasing = {
  standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  emphasized: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)',
  decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1.0)'
} as const;

/** The three semantic tiers, mapped onto the duration keys. */
export const MotionTier = {
  micro: 'fast',
  structural: 'normal',
  consequential: 'slow'
} as const;

export type MotionDurationKey = keyof typeof MotionDuration;
export type MotionEasingKey = keyof typeof MotionEasing;
export type MotionTierKey = keyof typeof MotionTier;

// The spec ranges, exported so the test suite can pin every tier against the
// critique's numbers rather than just checking they are "not zero".
export const MotionSpec = {
  micro: [100, 180],
  structural: [200, 350],
  consequential: [350, 700]
} as const;
