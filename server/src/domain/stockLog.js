// ---------------------------------------------------------------------------
// THE SHELF COUNT, MOVED ONE UNIT AT A TIME
//
// Why this file exists: a listing stores ONE number for stock
// (`quantityAvailable`), and the order rail decrements it. That answers "how
// much is on the shelf right now" and nothing else. It cannot answer the
// question an owner actually asks at 6am:
//
//     "you sold four, so why is the count back at ten?"
//
// Every builder prompt about the morning brief has asked for a stock flag. It
// is not computable against a single stored field: there is no previous value,
// no restock path, and no waste log anywhere in this tree. So the flag is not
// built here — the ROW that would make it honest is. `stockChanges` is an
// append-only movement log: one row per change, written by a real code path
// only.
//
// WHAT WRITES HERE (exactly two doors, both already existing):
//   * `listing.consumeStock()`  — a real order took units (`reason: 'order'`);
//   * `listing.updateListing()` — someone re-typed the count (`reason:
//     'owner_edit'`, carrying the actor).
//
// INVARIANTS
//   * append-only: there is no update path and no delete path. The brief is a
//     read over rows; if rows could be edited it would be a read over mood.
//   * no row for a non-change: re-saving a form that posts every field writes
//     nothing, so a count cannot be "explained" by noise.
//   * a movement is never invented to make a day look busy. If the log is
//     empty, the brief says nothing moved on the shelf — which is the truth.
//   * the REASON for a stock edit is not stored, because the API does not
//     require one (a price change does). Anything built on these rows
//     therefore reports an unexplained DELTA and never a motive.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { dayBucket } from '../dayBoundary.js';

/** The only two things that can move the shelf count in this app. */
export const STOCK_REASONS = ['order', 'owner_edit'];

/**
 * Append one movement. Called from the two doors above — nothing else.
 *
 * `from` and `to` are stored as the caller saw them and `delta` is computed
 * here rather than passed in, so a caller cannot send a number that disagrees
 * with its own endpoints. `delta` is null when there was no previous count
 * (stock tracking just started) — "no earlier number" is not "no change".
 */
export function recordStockChange({
  listingId,
  vendorId = null,
  spaceId = null,
  from = null,
  to = null,
  reason,
  actorId = null,
  orderId = null,
  at = null
} = {}) {
  if (!listingId) throw new Error('a stock change needs the listing it belongs to');
  if (!STOCK_REASONS.includes(reason)) {
    throw new Error(`stock change reason must be one of ${STOCK_REASONS.join(', ')}`);
  }
  const fromNum = Number.isInteger(from) ? from : null;
  const toNum = Number.isInteger(to) ? to : null;
  if (toNum === null) throw new Error('a stock change needs the count it landed on');
  if (fromNum !== null && fromNum === toNum) return null;   // not a movement

  const when = at ? new Date(at).toISOString() : new Date().toISOString();
  return store.insert('stockChanges', {
    id: newId('stk'),
    listingId,
    vendorId: vendorId ?? null,
    spaceId: spaceId ?? null,
    from: fromNum,
    to: toNum,
    // Positive means units appeared on the shelf that no sale put there.
    delta: fromNum === null ? null : toNum - fromNum,
    reason,
    // An order's actor is the buyer, and the buyer is not who edited the
    // shelf; the row's `orderId` already names them. So only a typed edit
    // carries an actor.
    actorId: reason === 'order' ? null : (actorId ?? null),
    orderId: reason === 'order' ? (orderId ?? null) : null,
    at: when
  });
}

/** The shelf history of one offer, oldest first. */
export function stockChangesFor(listingId, { limit = 50 } = {}) {
  return store.filter('stockChanges', (r) => r.listingId === listingId)
    .slice()
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .slice(-limit);
}

/**
 * One day of shelf movement per offer, stated as counts rather than as
 * inference:
 *
 *   sold       units a REAL order took (order-driven decrements only — a count
 *              typed downward by hand is not a sale and must never be folded
 *              into a day's sales figure, which is how a loss goes invisible)
 *   startCount the count the day opened on: the `from` of the day's first row
 *   endCount   the count the day closed on: the `to` of the day's last row
 *
 * Those two need no reconstruction and no assumption that the log is old:
 * every change to the count writes a row, so the first `from` IS the start of
 * the day and the last `to` IS the end of it. `startCount` stays null when the
 * day's first row had no previous count (stock tracking began that day), which
 * leaves the arithmetic unanswerable rather than guessed at.
 *
 * `edits` and `sales` are the rows themselves, oldest first, so whatever is
 * printed next to a figure can point at the evidence for it.
 */
export function movementsOnDay(listingIds, day) {
  const ids = new Set(listingIds);
  const out = new Map();
  for (const r of store.all('stockChanges')) {
    if (!ids.has(r.listingId)) continue;
    if (dayBucket(r.at) !== day) continue;
    const bucket = out.get(r.listingId) ?? {
      listingId: r.listingId, sold: 0, startCount: null, endCount: null, edits: [], sales: [], rows: []
    };
    if (r.reason === 'order') {
      bucket.sold += Math.max(0, (r.from ?? 0) - (r.to ?? 0));
      bucket.sales.push(r);
    } else {
      bucket.edits.push(r);
    }
    bucket.rows.push(r);
    out.set(r.listingId, bucket);
  }
  for (const bucket of out.values()) {
    for (const key of ['edits', 'sales', 'rows']) bucket[key].sort((a, b) => (a.at < b.at ? -1 : 1));
    bucket.startCount = bucket.rows[0]?.from ?? null;
    bucket.endCount = bucket.rows[bucket.rows.length - 1]?.to ?? null;
  }
  return out;
}
