// ---------------------------------------------------------------------------
// BRIEF DESIGN TOKENS — the TypeScript mirror of the canonical design system.
//
// The single source of truth for COLORS lives in src/ui/theme.css (:root) —
// the LIGHT system: white page, dark ink, a electric indigo primary and a cyan
// secondary. This module mirrors those values for the rare case a component
// needs a color/radius/type constant in JS rather than a `var(--…)` reference.
// (The motion tokens live separately in src/ui/motion/tokens.ts.)
//
// Honesty: there is exactly ONE palette. The earlier purple/lime draft is gone
// — it never shipped and was removed because a second, conflicting palette is
// a second source of truth waiting to disagree with the first.
// ---------------------------------------------------------------------------

import { MotionDuration, MotionEasing } from '../ui/motion/tokens';

export const DesignTokens = {
  colors: {
    // Light system — see src/ui/theme.css for the --brief-*/--color-* names.
    background: '#F7F8FA',        // --color-bg
    surface: '#FFFFFF',           // --color-surface
    surfaceElevated: '#F0F2F5',   // --color-surface-elevated
    border: '#E5E8EC',            // --color-border
    textPrimary: '#0D1117',       // --color-text (ink)
    textSecondary: '#5A6472',     // --color-text-muted
    textMuted: '#7A8494',         // meta / timestamps (>=4.5:1)
    primary: '#4F46E5',           // --color-primary (electric indigo)
    primaryStrong: '#4338CA',     // --color-primary-strong (hover/pressed)
    accent: '#06B6D4',            // --color-accent (cyan secondary)
    success: '#16A34A',
    warning: '#B45309',
    danger: '#DC2626'
  },
  typography: {
    // Type scale mirrors --text-* in src/ui/theme.css.
    display: '34px',
    page: '26px',
    section: '21px',
    card: '18px',
    body: '15px',
    meta: '12px',
    family:
      "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  radius: {
    card: '24px',
    hero: '28px',
    button: '16px',
    input: '18px',
    pill: '999px'
  },
  motion: {
    durations: MotionDuration,
    easings: MotionEasing
  }
} as const;

export default DesignTokens;
