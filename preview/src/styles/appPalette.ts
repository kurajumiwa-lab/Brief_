// ─────────────────────────────────────────────
// DESIGN TOKENS — Single source of truth (AppPalette)
// ─────────────────────────────────────────────

export const AppPalette = {
  // Primary: Deep Teal — bridges WhatsApp green + Telegram blue
  primary: '#0B6E6E',
  primaryLight: '#14919B',
  primaryDark: '#064545',

  // Accent: Warm Amber — premium, inviting, high-contrast
  accent: '#E8985E',
  accentLight: '#F4C28F',

  // Surfaces — warm, never pure white
  background: '#F0EDE8', // Warm linen
  surface: '#FAFAF8',    // Soft cream
  surfaceAlt: '#E8E4DD', // Deeper warm

  // Depth layer — the "3D background"
  depthDark: '#1A1F2E',  // Midnight
  depthMid: '#2D3548',   // Slate

  // Semantic
  success: '#2ECC71',
  error: '#E74C3C',
  warning: '#F39C12',

  // Text
  textPrimary: '#1A1F2E',
  textSecondary: '#6B7280',
  textOnDark: '#F0EDE8',
  textMuted: '#94A3AF',
} as const;

export const AppTypography = {
  family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  h1: 'text-[28px] font-extrabold tracking-tight leading-[1.2] text-[#1A1F2E]',
  h2: 'text-[22px] font-bold tracking-tight leading-[1.3] text-[#1A1F2E]',
  h3: 'text-[17px] font-semibold leading-[1.4] text-[#1A1F2E]',
  body: 'text-[15px] font-normal leading-[1.5] text-[#6B7280]',
  caption: 'text-[12px] font-medium leading-[1.4] text-[#9CA3AF]',
  button: 'text-[15px] font-bold tracking-wide text-white',
} as const;

export const AppSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
