// ---------------------------------------------------------------------------
// BRIEF 2.0 DESIGN TOKENS
//
// Neutral surfaces first. Restrained borders. Clear hierarchy.
// Primary Brand: Deep Purple (#5B2EA6)
// Accent / Energy: Electric Lime (#93EE34) & Warm Amber (#E8985E)
// Neutral: Warm Linen Background (#F0EDE8 / #F8F7F4), Crisp White Surfaces
// ---------------------------------------------------------------------------

export const DesignTokens = {
  colors: {
    background: '#F0EDE8',      // Warm linen
    backgroundAlt: '#FAFAF8',   // Soft cream
    surface: '#FFFFFF',          // Crisp pure white for cards
    surfaceMuted: '#F4F7F2',     // Soft sage mint
    surfaceDark: '#0C221F',      // Deep forest pine
    surfaceMidnight: '#1A1F2E',  // Midnight dark
    border: '#E2E8F0',           // Restrained subtle border
    borderSubtle: 'rgba(0, 0, 0, 0.06)',
    textPrimary: '#1A1F2E',      // Ink
    textSecondary: '#64748B',    // Slate secondary
    textMuted: '#94A3B8',        // Faint metadata
    textOnDark: '#FFFFFF',       // Crisp text on dark
    brand: '#5B2EA6',            // Signature Deep Purple
    brandHover: '#4A238A',
    accentLime: '#93EE34',       // Chartreuse / Neon Lime
    accentAmber: '#E8985E',      // Warm amber
    success: '#10B981',          // Emerald
    warning: '#F59E0B',          // Amber
    danger: '#EF4444'            // Rose red
  },
  typography: {
    pageTitle: 'text-2xl sm:text-3xl font-black tracking-tight text-[#1A1F2E]',
    sectionTitle: 'text-lg sm:text-xl font-black tracking-tight text-[#1A1F2E]',
    cardTitle: 'text-base font-bold text-[#1A1F2E]',
    body: 'text-sm text-[#4B5563] leading-relaxed',
    bodySmall: 'text-xs text-[#64748B] leading-normal',
    metadata: 'text-[11px] font-mono text-[#94A3B8]'
  },
  radius: {
    sm: 'rounded-xl',
    md: 'rounded-2xl',
    lg: 'rounded-3xl',
    full: 'rounded-full'
  },
  shadow: {
    subtle: 'shadow-xs',
    card: 'shadow-sm hover:shadow-md transition-shadow',
    elevated: 'shadow-lg'
  }
} as const;

export default DesignTokens;
