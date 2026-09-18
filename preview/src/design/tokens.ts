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
    // Warm light system — see src/ui/theme.css for the --brief-*/--color-* names.
    // Nothing here is #FFFFFF-on-#F7F8FA any more: a cold neutral next to a warm
    // accent is what made surfaces read as unpainted wireframe.
    background: '#F7F8FA',        // --color-bg — the room, warm plaster
    surface: '#FFFFFF',           // --color-surface / --color-paper — warm paper
    surfaceElevated: '#EEF1F5',   // --color-well — input wells, inset rows
    border: '#DCE1E8',            // --color-border — dividers/rings only, never a card
    textPrimary: '#0A0E14',       // --color-text (warm ink)
    textSecondary: '#55493A',     // --color-text-secondary — card bodies
    textMuted: '#5A6472',         // --color-text-muted (5.9:1 on paper)
    textFaint: '#6B7684',         // meta / timestamps (>=4.5:1 on paper)
    quiet: '#8A94A3',             // a zero, a dash, an arrow: present, unbothered
    primary: '#2563EB',           // --color-primary (electric indigo — unchanged)
    primaryStrong: '#4338CA',     // --color-primary-strong (hover/pressed)
    accent: '#0891B2',            // --color-accent (cyan secondary — unchanged)
    success: '#059669',
    warning: '#B45309',
    danger: '#DC2626'             // warm brick, not pure red
  },
  // Elevation is the room's depth language: an inset highlight at the top edge
  // (the light source) plus a warm drop shadow. A card takes one of these and
  // drops its border; `border: 1px solid <line>` on a surface is banned.
  // Mirrored as --lift-1..4 / --lift-signal in src/ui/theme.css.
  elevation: {
    flat: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(60,46,30,0.05)',
    raised: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 6px rgba(60,46,30,0.07), 0 10px 24px -10px rgba(60,46,30,0.12)',
    lifted: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 10px rgba(60,46,30,0.09), 0 20px 40px -16px rgba(60,46,30,0.18)',
    floating: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 22px rgba(60,46,30,0.13), 0 34px 60px -24px rgba(60,46,30,0.24)',
    signal: '0 0 0 1px rgba(79,70,229,0.4), 0 10px 28px -6px rgba(79,70,229,0.34), inset 0 1px 0 rgba(255,255,255,0.5)'
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
