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

/** Real money and work that moved recently — the "it actually happens" proof. */
export function movement({ windowDays = WINDOW_DAYS } = {}) {
  const cutoff = Date.now() - windowDays * DAY;

  const settledOrders = store.filter('orders', (o) =>
    o.status === 'settled' && Date.parse(o.updatedAt ?? o.createdAt) >= cutoff);
  const completedWork = store.filter('workOrders', (w) =>
    w.status === 'completed' && Date.parse(w.updatedAt ?? w.createdAt) >= cutoff);
  const deliveredPickups = store.filter('pickups', (p) =>
    p.status === 'delivered' && Date.parse(p.completedAt ?? p.createdAt) >= cutoff);

  return {
    settledOrders: settledOrders.length,
    settledOrdersKes: settledOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
    completedWorkOrders: completedWork.length,
    deliveredPickups: deliveredPickups.length,
    windowDays,
    derivedAt: new Date().toISOString(),
    note:
      'Precedent is derived from real rows — settled orders, completed work orders, delivered pickups, and requests that reached an accepted quote. No story is invented; every count traces to rows a user could query.'
  };
}
