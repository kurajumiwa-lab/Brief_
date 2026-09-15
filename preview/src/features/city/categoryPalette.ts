// ---------------------------------------------------------------------------
// CATEGORY PALETTE — the colour identity of an exhibit, derived from its
// CATEGORY, not from a hash of its title.
//
// Why: the monogram letter ("W" for Wedding, "S for "Saturday brunch run") read
// as a placeholder — a letter that maps to nothing the user knows. A category
// tint does map to something: the same wing of the case is always the same
// colour, so the palette teaches the taxonomy instead of decorating it.
//
// Light-theme canonical: indigo/cyan family, one tint per wing. A cover image
// always wins over a tint — the tint is only the fallback, never a fake photo.
// ---------------------------------------------------------------------------

export const CATEGORY_PALETTE: Record<string, { from: string; to: string; label: string }> = {
  popup: { from: '#4F46E5', to: '#22D3EE', label: 'Popups & markets' },
  session: { from: '#0EA5E9', to: '#4F46E5', label: 'Sessions & classes' },
  drop: { from: '#7C3AED', to: '#06B6D4', label: 'Drops' },
  event: { from: '#4338CA', to: '#0891B2', label: 'Events' },
  contribution: { from: '#0F766E', to: '#4F46E5', label: 'Causes & pots' }
};

const NEUTRAL = { from: '#334155', to: '#4F46E5' };

export function categoryGradient(category: string | null | undefined): string {
  const p = category ? CATEGORY_PALETTE[category] : null;
  const { from, to } = p ?? NEUTRAL;
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function categoryLabel(category: string | null | undefined): string | null {
  return category && CATEGORY_PALETTE[category] ? CATEGORY_PALETTE[category].label : null;
}
