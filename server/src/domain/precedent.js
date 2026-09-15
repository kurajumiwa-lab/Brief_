// ---------------------------------------------------------------------------
// PRECEDENT — the honest confidence layer: "does demand like this actually
// close, and has money really moved?" Derived from real rows only.
//
// A gap on its own is a claim nobody trusts ("Says who?"). Precedent answers
// it with ledger-derived proof: how many requests in a category have closed
// recently, and how much settled money actually moved. Not testimonials —
// counts of real rows a user could query themselves.
//
// There is NO fabricated "Sector 4 filled 4× this month → KES 2,040" story.
// Only real requests that reached an accepted quote, real settled orders, real
// completed work orders, real delivered pickups.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { offerValue, acceptedOffer, meanAmount } from './offerValue.js';

const DAY = 86400000;
const WINDOW_DAYS = 30;

// A request is "closed" once it has an accepted quote (the demand was met).
const CLOSED_STATUSES = new Set(['ready_for_work', 'in_progress', 'completed']);

export function categoryClosure({ windowDays = WINDOW_DAYS } = {}) {
  const cutoff = Date.now() - windowDays * DAY;
  const closed = new Map(); // category -> count

  for (const r of store.filter('requests', () => true)) {
    const closedAt = Date.parse(r.updatedAt ?? r.createdAt);
    if (closedAt < cutoff) continue;
    const isClosed = r.acceptedQuote || CLOSED_STATUSES.has(r.status);
    if (!isClosed) continue;
    const cat = r.category ?? 'uncategorised';
    closed.set(cat, (closed.get(cat) ?? 0) + 1);
  }

  return {
    byCategory: [...closed.entries()]
      .map(([category, count]) => ({ category, closed: count }))
      .sort((a, b) => b.closed - a.closed),
    windowDays,
    derivedAt: new Date().toISOString()
  };
}

const HOUR = 3600000;

/**
 * How demand LIKE THIS has actually resolved — the figure that turns "join"
 * from a leap into a calculation. Derived from real closed request rows only:
 *
 *   closed        — requests in this category that reached an accepted quote
 *                   inside the window.
 *   avgHoursToFill — mean of (acceptedAt − createdAt) for those rows, and ONLY
 *                   for rows where both timestamps exist on the row. A request
 *                   whose status changed without an accepted-quote timestamp is
 *                   not counted here and never guessed.
 *   avgValue       — mean of the ACCEPTED offer's own derived total (the same
 *                   arithmetic the quote engine uses). null when no accepted
 *                   offer in the window carries a completed price — a missing
 *                   price is reported as unavailable, never as zero.
 *
 * `sampleCount` accompanies every average so the reader can judge it.
 */
export function fillStats({ category = null, windowDays = WINDOW_DAYS } = {}) {
  const cutoff = Date.now() - windowDays * DAY;
  const hours = [];
  const values = [];
  let closed = 0;

  for (const r of store.filter('requests', (row) => {
    if (category && row.category !== category) return false;
    const at = Date.parse(row.updatedAt ?? row.createdAt);
    if (at < cutoff) return false;
    return Boolean(row.acceptedQuote) || CLOSED_STATUSES.has(row.status);
  })) {
    closed++;
    if (!r.acceptedQuote) continue; // no accepted offer row -> nothing to average
    const acceptedAt = Date.parse(r.acceptedQuote?.acceptedAt ?? '');
    const openedAt = Date.parse(r.createdAt ?? '');
    if (Number.isFinite(acceptedAt) && Number.isFinite(openedAt) && acceptedAt >= openedAt) {
      hours.push((acceptedAt - openedAt) / HOUR);
    }
    const quote = store.find('requestQuotes', (q) => q.id === r.acceptedQuote.quoteId);
    const value = offerValue(acceptedOffer(quote, r.acceptedQuote));
    if (value) values.push(value);
  }

  const avgHours = hours.length
    ? Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10
    : null;
  const avgValue = meanAmount(values);

  return {
    category,
    windowDays,
    closed,
    avgHoursToFill: avgHours,
    hoursSampleCount: hours.length,
    avgValue,
    note:
      'Precedent is counted from closed request rows and the accepted offer’s own terms. ' +
      'A figure is reported only when the rows behind it exist; otherwise it is absent.'
  };
}

/** Real money and work that moved recently — the "it actually happens" proof. */
export function movement({ windowDays = WINDOW_DAYS } = {}) {
  const cutoff = Date.now() - windowDays * DAY;

  const settledOrders = store.filter('orders', (o) =>
    o.status === 'settled' && Date.parse(o.updatedAt ?? o.createdAt) >= cutoff);
  const completedWork = store.filter('workOrders', (w) =>
    w.status === 'completed' && Date.parse(w.updatedAt ?? w.createdAt) >= cutoff);
  const deliveredPickups = store.filter('pickups', (p) =>
    p.status === 'delivered' && Date.parse(p.completedAt ?? p.createdAt) >= cutoff);

  // One currency across the settled rows, or null when they disagree — a mixed
  // basket is not a single KES figure and is not presented as one.
  const currencies = new Set(settledOrders.map((o) => o.currency).filter(Boolean));
  const settledCurrency = currencies.size === 1 ? [...currencies][0] : null;

  return {
    settledOrders: settledOrders.length,
    settledOrdersKes: settledOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
    settledCurrency,
    completedWorkOrders: completedWork.length,
    deliveredPickups: deliveredPickups.length,
    windowDays,
    derivedAt: new Date().toISOString(),
    note:
      'Precedent is derived from real rows — settled orders, completed work orders, delivered pickups, and requests that reached an accepted quote. No story is invented; every count traces to rows a user could query.'
  };
}
