import React from 'react';

// ---------------------------------------------------------------------------
// BANNER ART — cosmetic identity cards
//
// Purely decorative, animated identity surfaces. They carry NO data and NO
// interactive semantics (they are <div>s, never <button>s), so they can never
// shadow a real action or leak a fabricated number. Each is an abstract
// "semi-logo" — a silk gradient, a floating glyph, and a Konami-style sheen —
// that gives a screen its visual identity without pretending to be content.
// ---------------------------------------------------------------------------

const HUES: Record<string, { from: string; mid: string; to: string }> = {
  green: { from: '#0e1a12', mid: '#0d3320', to: '#070a0e' },
  amber: { from: '#1c150b', mid: '#33240d', to: '#0c0e12' },
  blue: { from: '#0c1821', mid: '#0d2a38', to: '#090a0f' },
  violet: { from: '#1b1c24', mid: '#2a1d3a', to: '#0c0d10' },
  teal: { from: '#161c19', mid: '#0d2f2a', to: '#0b0c0e' }
};

export interface SilkBannerProps {
  /** The floating semi-logo glyph. */
  glyph: string;
  /** A short identity line, sentence case. */
  title: string;
  /** A one-line descriptor. */
  subtitle?: string;
  /** The colour family driving the silk gradient. */
  hue?: keyof typeof HUES;
  /** Compact variant: shorter banner for secondary placement. */
  compact?: boolean;
}

export function SilkBanner({ glyph, title, subtitle, hue = 'green', compact = false }: SilkBannerProps) {
  const c = HUES[hue];
  return (
    <div
      aria-hidden="true"
      className={`brief-sheen brief-silk relative w-full overflow-hidden rounded-2xl border border-[#1E1E22] ${
        compact ? 'h-24' : 'h-40'
      }`}
      style={{ backgroundImage: `linear-gradient(135deg, ${c.from} 0%, ${c.mid} 45%, ${c.to} 100%)` }}
    >
      {/* Aura glow */}
      <div
        className="brief-glow absolute -right-6 -top-10 h-40 w-40 rounded-full"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(0,230,118,0.35) 0%, transparent 70%)', filter: 'blur(18px)' }}
      />
      {/* Subtle second aura, offset */}
      <div
        className="brief-glow absolute -left-8 -bottom-12 h-36 w-36 rounded-full"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(0,230,118,0.18) 0%, transparent 70%)', filter: 'blur(20px)', animationDelay: '1.4s' }}
      />
      <div className={`absolute inset-0 flex items-center ${compact ? 'gap-3 px-4' : 'flex-col justify-center gap-1 px-5 text-center'}`}>
        <span className={`brief-float ${compact ? 'text-2xl' : 'text-4xl'} drop-shadow-[0_0_14px_rgba(0,230,118,0.45)]`}>
          {glyph}
        </span>
        <div className={compact ? 'min-w-0' : ''}>
          <p className="text-[13px] font-extrabold tracking-wide text-[#FFFFFF]">{title}</p>
          {subtitle && <p className="mt-0.5 text-[10px] text-[#8E8E93]">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

export interface GameBannerProps {
  /** The game title (e.g. eFootball). */
  name: string;
  /** The floating semi-logo glyph for the game. */
  glyph: string;
  /** Live, honest activity count (open matchrooms), or null when none. */
  activity?: number;
  /** Accent hue family. */
  hue?: keyof typeof HUES;
}

/**
 * A Konami-style game title card. Purely decorative: it mirrors the selected
 * game's identity and a live count, and never emits an action of its own.
 */
export function GameBanner({ name, glyph, activity, hue = 'green' }: GameBannerProps) {
  const c = HUES[hue];
  return (
    <div
      aria-hidden="true"
      className="brief-sheen brief-silk relative h-36 w-full overflow-hidden rounded-2xl border border-[#1E1E22]"
      style={{ backgroundImage: `linear-gradient(135deg, ${c.from} 0%, ${c.mid} 50%, ${c.to} 100%)` }}
    >
      <div
        className="brief-glow absolute -right-4 -top-8 h-36 w-36 rounded-full"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(0,230,118,0.32) 0%, transparent 70%)', filter: 'blur(16px)' }}
      />
      <div className="absolute inset-0 flex items-center justify-between px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#00E676]">Now in the lobby</p>
          <p className="mt-1 text-2xl font-extrabold text-[#FFFFFF]">{name}</p>
          {typeof activity === 'number' && (
            <p className="mt-1 text-[11px] font-bold text-[#00E676]">
              🎮 {activity} {activity === 1 ? 'matchroom' : 'matchrooms'} active
            </p>
          )}
        </div>
        <span className="brief-float text-5xl drop-shadow-[0_0_18px_rgba(0,230,118,0.5)]">{glyph}</span>
      </div>
    </div>
  );
}
