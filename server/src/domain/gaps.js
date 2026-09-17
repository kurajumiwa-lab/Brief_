// ---------------------------------------------------------------------------
// GAPS — unmet demand, derived from real rows. The honest "gap engine".
//
// Brief's gap is not a commodity-arbitrage spreadsheet scraped from the
// internet. It is a fact about the platform's own economic graph: a Request
// (or a Circle's collective order) that has NO accepted quote is demand that
// is not being served. That is the gap, and it is computed by scanning real
// rows — never fetched from a price feed, never assumed, never seeded.
//
// Severity is a derived label, not a score:
//   no_supplier     — the request has ZERO matches: nobody can serve it.
//   awaiting_quote  — suppliers matched, but no quote has been submitted yet.
//   awaiting_accept — a quote exists, but it has not been accepted.
//
// Every count below is recomputed on read. There is no stored counter.
// ---------------------------------------------------------------------------

import { store } from '../store.js';

// Active demand = a request that is live and has no accepted quote yet. A
// request with an accepted quote has status "ready_for_work" (or later), so
// anything before that is still looking for supply.
// Exported so every read that asks "is this demand still open?" uses the SAME
// definition — a second copy is how a board and a gap engine disagree.
export const UNMET_STATUSES = new Set(['open', 'matching', 'quoted']);

function severityOf(request, matchCount) {
  if (matchCount === 0) return 'no_supplier';
  if (request.status === 'quoted') return 'awaiting_accept';
  return 'awaiting_quote';
}

const SEVERITY_RANK = { no_supplier: 0, awaiting_quote: 1, awaiting_accept: 2 };

export const SEVERITY_LABELS = {
  no_supplier: 'No supplier has matched this demand',
  awaiting_quote: 'Suppliers matched; no quote yet',
  awaiting_accept: 'A quote exists; awaiting acceptance'
};

/**
 * The unmet-demand picture: every live request with no accepted quote, each
 * with its derived match count and severity. No private fields — no budget,
 * no requester identity, no specification detail beyond the headline.
 */
export function unmetDemand() {
  const rows = store.filter('requests', (r) => UNMET_STATUSES.has(r.status));

  const gaps = rows.map((r) => {
    const matchCount = store.filter('matches', (m) => m.requestId === r.id).length;
    const severity = severityOf(r, matchCount);
    return {
      requestId: r.id,
      title: r.title,
      category: r.category,
      quantity: r.quantity,
      unit: r.unit,
      currency: r.currency,
      location: r.location,
      status: r.status,
      // A collective order placed on behalf of a table-banking group is flagged
      // as such — it is the "community needs something" gap, the strongest one.
      collective: Boolean(r.businessContext?.tableBankingId),
      tableBankingId: r.businessContext?.tableBankingId ?? null,
      matchCount,
      severity,
      severityLabel: SEVERITY_LABELS[severity],
      updatedAt: r.updatedAt
    };
  });

  gaps.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      String(b.updatedAt).localeCompare(String(a.updatedAt))
  );

  const bySeverity = { no_supplier: 0, awaiting_quote: 0, awaiting_accept: 0 };
  for (const g of gaps) bySeverity[g.severity]++;

  return {
    gaps: gaps.map(({ updatedAt, ...rest }) => rest),
    total: gaps.length,
    bySeverity,
    derivedAt: new Date().toISOString(),
    note:
      'Unmet demand is derived by scanning real request rows with no accepted quote. ' +
      'It is the platform\u2019s own supply\u2013demand gap — no external price feed, no assumed margins.'
  };
}
