// ---------------------------------------------------------------------------
// PRICE SIGNALS — average listed prices, derived from real listing rows.
//
// This is NOT a market index, NOT a price feed, and NOT a trend. It is the
// honest aggregate of what sellers are actually listing RIGHT NOW: for each
// listing type (product / service / experience / event), among ACTIVE
// listings, the count and the min / average / max price.
//
// Why no "trend over 30 days"? A listing is a single price point, not a time
// series — there is no per-day price history to average. Inventing one would
// be fabrication, so the signal is a snapshot, stated as such.
//
// Types with no active listings are omitted (not shown as zero, which would
// imply a price of "free"). Every figure is recomputed by scanning rows.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { LISTING_TYPES } from './listing.js';

/** Average, min, max and count of ACTIVE listings per type. */
export function priceSignals() {
  const active = store.filter('listings', (l) => l.status === 'active');

  const signals = LISTING_TYPES.map((type) => {
    const rows = active.filter((l) => l.type === type);
    if (rows.length === 0) return null;

    const prices = rows.map((l) => l.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;

    return {
      type,
      count: rows.length,
      currency: rows[0].currency ?? 'KES',
      minPrice: min,
      avgPrice: Math.round(avg * 100) / 100,
      maxPrice: max
    };
  }).filter(Boolean);

  return {
    signals,
    derivedAt: new Date().toISOString(),
    note:
      'Average of currently-active listed prices by type. A snapshot, not a market ' +
      'index or a trend — listings carry a single price, not a time series.'
  };
}
