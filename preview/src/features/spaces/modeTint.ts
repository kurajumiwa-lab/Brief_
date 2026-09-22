// ---------------------------------------------------------------------------
// MODE TINT — the colour a shop tile wears. The taxonomy is the server's
// SPACE_MODES (server/src/domain/space.js); this file only colours it. The
// labels stay the server's own `modeLabel` on the Space, so the list of modes
// is defined in exactly one place — and if the server adds a mode, this map
// gives it the neutral slate until somebody picks it a colour, which is the
// honest fallback, not a guess.
// ---------------------------------------------------------------------------

const NEUTRAL = '#64748B';

const MODE_TINT: Record<string, string> = {
  retail: '#0E7C86',
  wholesale: '#1D4ED8',
  services: '#8A5A2B',
  training: '#6D28D9',
  delivery: '#92400E',
  other: '#475569',
};

/** The tile tint for a space's mode. An unstated mode gets the neutral slate. */
export const modeTint = (mode: string | null | undefined): string =>
  (mode && MODE_TINT[mode]) || NEUTRAL;

export default modeTint;
