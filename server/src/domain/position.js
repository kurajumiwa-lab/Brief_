// ---------------------------------------------------------------------------
// POSITION — the user's *position in time*, derived entirely from real rows.
//
// A register is a state; a queue moves without you. This module computes the
// honest version of that: what is expiring, what you were in the running for
// and lost, and what is still open. Every number is arithmetic over real rows
// on read — nothing is stored, nothing is estimated, nothing is rounded up.
//
// The four impulses, mapped to real data only:
//   decay    — expiring quotes (requestQuotes.offers[].terms.validUntil),
//              a campaign waitlist position + offer expiry, and lipa-mdogo
//              overdue instalments.
//              A fourth source used to sit here: the field agent's 24-month
//              override window. Decision 5 (docs/DECISIONS.md) replaced the
//              override with a flat KES 150 per approved visit, paid weekly —
//              so there is no window left to expire and the row is gone rather
//              than printed as a permanent zero. Nothing else was removed.
//   missed   — my quotes that were declined BECAUSE another was selected
//              (the real quote_declined event with reason "Selected another
//              option", written when a request's quote is accepted).
//   open     — still-open unmet demand (gaps.unmetDemand), action framing.
//
// There is deliberately NO fabricated "rider queue", NO tier/badge ladder, NO
// trust score, and NO invented KES figure for "what you missed" — those rows
// do not exist, and inventing them would be the exact fraud this layer exists
// to avoid.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { listFor as lipaMdogoContracts, contractState } from './lipaMdogo.js';
import { unmetDemand } from './gaps.js';
import { categoryClosure, fillStats } from './precedent.js';
import { offerValue } from './offerValue.js';

// Same end-of-day-in-Nairobi semantics the quote layer uses, so an expiring
// quote is judged by the same clock everywhere.
const expiryMs = (value) => (value ? Date.parse(`${value}T23:59:59.999+03:00`) : Infinity);
const HOUR = 3600000;

const CLOSED_QUOTE = new Set(['accepted', 'declined', 'withdrawn']);

function vendorOwner(vendorId) {
  return store.find('vendors', (v) => v.id === vendorId)?.ownerId ?? null;
}

/**
 * The ONE move worth making next, chosen from real rows — and only from them.
 *
 * Ranking uses facts that already exist:
 *   1. demand the matching engine put in front of one of MY enterprises
 *      (a live `matches` row naming me, not expired);
 *   2. demand I already have a live proposal on (a `requestQuotes` row of mine
 *      that is still open) — following up on it is a real next step;
 *   3. otherwise the most acute open gap the gap engine already ranked.
 *
 * Everything carried along is a field of the request row or a count derived
 * from real rows: the severity label, the number of matched suppliers, the age
 * of the request, the requester's own `requiredBy` date (only while it is in
 * the future), and this category's real closure precedent. NO invented run
 * price, NO "closes in 6h" without a stored date, NO queue position, NO tier.
 * Returns null when nothing is open — the absence is the honest answer.
 */
function nextMoveFor(userId, gaps) {
  if (!gaps.length) return null;

  const matchedToMe = new Set(
    store
      .filter('matches', (m) => m.status !== 'expired' && vendorOwner(m.participantId) === userId)
      .map((m) => m.requestId)
  );
  const myOpenQuoteByRequest = new Map();
  for (const q of store.filter('requestQuotes', (x) => x.participantUserId === userId)) {
    if (CLOSED_QUOTE.has(q.status) || myOpenQuoteByRequest.has(q.requestId)) continue;
    myOpenQuoteByRequest.set(q.requestId, q);
  }

  const ranked = gaps
    .map((g, index) => ({
      g,
      index,
      rank: matchedToMe.has(g.requestId) ? 0 : myOpenQuoteByRequest.has(g.requestId) ? 1 : 2
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)[0];

  const gap = ranked.g;
  const row = store.find('requests', (r) => r.id === gap.requestId);
  const nowMs = Date.now();
  const openedMs = row?.createdAt ? Date.parse(row.createdAt) : NaN;
  const deadlineMs = row?.requiredBy ? expiryMs(row.requiredBy) : null;
  // A countdown is only ever allowed when the row itself carries a date that
  // is still ahead. No date, or a past one -> null, and no number on screen.
  const hasDeadline = deadlineMs !== null && deadlineMs > nowMs;

  const myQuote = myOpenQuoteByRequest.get(gap.requestId) ?? null;
  const myOffer = myQuote ? offerValue(myQuote.offers.at(-1)) : null;
  const offerExpiryMs = myQuote?.offers.at(-1)?.terms?.validUntil
    ? expiryMs(myQuote.offers.at(-1).terms.validUntil)
    : null;

  const precedent = fillStats({ category: row?.category || null });

  return {
    requestId: gap.requestId,
    title: gap.title,
    category: gap.category,
    location: gap.location,
    quantity: gap.quantity,
    unit: gap.unit,
    currency: gap.currency,
    severityLabel: gap.severityLabel,
    matchCount: gap.matchCount,
    collective: gap.collective,
    openedAt: row?.createdAt ?? null,
    ageHours: Number.isFinite(openedMs) ? Math.max(1, Math.round((nowMs - openedMs) / HOUR)) : null,
    // The requester's own stated date, and only while it is still ahead. A row
    // without one reports null — never a made-up countdown.
    requiredBy: hasDeadline ? row.requiredBy : null,
    hoursUntilRequiredBy: hasDeadline ? Math.max(1, Math.round((deadlineMs - nowMs) / HOUR)) : null,
    myQuote: myQuote
      ? {
          quoteId: myQuote.id,
          status: myQuote.status,
          offerValue: myOffer,
          validUntil: myQuote.offers.at(-1)?.terms?.validUntil ?? null,
          hoursLeft:
            offerExpiryMs !== null && Number.isFinite(offerExpiryMs) && offerExpiryMs > nowMs
              ? Math.max(1, Math.round((offerExpiryMs - nowMs) / HOUR))
              : null
        }
      : null,
    // Real precedent for demand in this category — counts of rows, not stories.
    precedent: {
      closedInWindow: precedent.closed,
      windowDays: precedent.windowDays,
      avgHoursToFill: precedent.avgHoursToFill,
      avgValue: precedent.avgValue
    },
    why:
      ranked.rank === 0
        ? 'This was matched to one of your enterprises'
        : ranked.rank === 1
          ? 'You already have a live proposal on this'
          : 'Open demand on the platform right now',
    evidence: { table: 'requests', id: gap.requestId }
  };
}

export function positionFor(userId) {
  const now = Date.now();

  // --- DECAY 1: expiring quotes (I am the seller/participant) ---------------
  const myQuotes = store.filter('requestQuotes', (q) => q.participantUserId === userId);
  const expiringQuotes = [];
  for (const q of myQuotes) {
    if (CLOSED_QUOTE.has(q.status)) continue;
    const offer = q.offers.at(-1);
    if (!offer) continue;
    const validUntil = offer.terms?.validUntil ?? null;
    const ms = expiryMs(validUntil);
    if (ms <= now) continue; // already expired — gone, not "expiring"
    const request = store.find('requests', (r) => r.id === q.requestId);
    expiringQuotes.push({
      quoteId: q.id,
      requestId: q.requestId,
      title: request?.title ?? 'Open proposal',
      validUntil,
      hoursLeft: Math.max(1, Math.round((ms - now) / HOUR))
    });
  }
  expiringQuotes.sort((a, b) => a.hoursLeft - b.hoursLeft);

  // --- DECAY 2: campaign waitlist position + offer expiry ------------------
  const waitlist = store
    .filter('waitlistEntries', (w) => w.userId === userId && ['waiting', 'offered', 'reserved'].includes(w.status))
    .map((w) => {
      const campaign = store.find('campaigns', (c) => c.id === w.campaignId);
      const offerMs = w.offerExpiresAt ? Date.parse(w.offerExpiresAt) : null;
      return {
        entryId: w.id,
        campaignId: w.campaignId,
        campaignTitle: campaign?.title ?? 'Waitlist',
        position: Number(w.position) || null,
        status: w.status,
        offerExpiresAt: w.offerExpiresAt,
        hoursLeft: offerMs ? Math.max(1, Math.round((offerMs - now) / HOUR)) : null
      };
    })
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

  // --- DECAY 3: lipa-mdogo overdue instalments -----------------------------
  // (This was DECAY 4. The field-agent override window that stood at 3 no
  // longer exists — Decision 5 pays a flat fee per approved visit, with no
  // window to run down — and a decay rail does not carry a row that can never
  // be non-null.)
  let overdueInstallments = 0;
  for (const contract of lipaMdogoContracts(userId)) {
    overdueInstallments += contractState(contract.id).summary.overdueCount;
  }

  // --- MISSED: my quotes declined because another was selected -------------
  // The value attached to each is MY OWN offer's derived total (from my row's
  // terms, with the quote engine's own arithmetic) — never the winner's price,
  // which Brief does not store, and never an estimate of "what you could have
  // earned". Where my offer carried no completed price, no figure is shown.
  const missed = [];
  for (const q of myQuotes) {
    if (q.status !== 'declined') continue;
    const lost = (q.history ?? []).find(
      (h) => h.action === 'quote_declined' && /another/i.test(h.reason ?? '')
    );
    if (!lost) continue;
    const request = store.find('requests', (r) => r.id === q.requestId);
    missed.push({
      requestId: q.requestId,
      title: request?.title ?? 'Proposal',
      at: lost.at ?? q.updatedAt ?? null,
      value: offerValue(q.offers.at(-1)),
      evidence: { table: 'requestQuotes', id: q.id }
    });
  }
  missed.sort((a, b) => (a.at < b.at ? 1 : -1));
  const THIRTY_DAYS = 30 * 24 * HOUR;
  const valuedRecent = missed.filter(
    (m) => m.value && Date.parse(m.at ?? '') >= now - THIRTY_DAYS
  );
  const missedValue = valuedRecent.length
    ? {
        amount: Math.round(valuedRecent.reduce((s, m) => s + m.value.amount, 0) * 100) / 100,
        currency: valuedRecent[0].value.currency,
        over: `${Math.round(THIRTY_DAYS / (24 * HOUR))} days`,
        sampleCount: valuedRecent.length
      }
    : null;

  // --- OPEN: still-open unmet demand (action framing, not loss) -------------
  const gaps = unmetDemand();
  // Precedent: how many requests in each category have actually closed lately.
  const closure = categoryClosure();
  const closedByCategory = new Map(closure.byCategory.map((c) => [c.category, c.closed]));

  return {
    decay: {
      expiringQuotes,
      waitlist,
      overdueInstallments
    },
    missedCapture: {
      count: missed.length,
      recent: missed.slice(0, 5),
      // The sum of MY OWN declined offers' derived totals in the window — each
      // one traceable to a quote row of mine. null when no such figure exists.
      value: missedValue
    },
    // The single move worth making, chosen from real rows. null = nothing open.
    nextMove: nextMoveFor(userId, gaps.gaps),
    open: {
      total: gaps.total,
      top: gaps.gaps.slice(0, 3).map((g) => ({
        requestId: g.requestId,
        title: g.title,
        category: g.category,
        location: g.location,
        severityLabel: g.severityLabel,
        collective: g.collective,
        // Honest precedent: this category has closed N× recently (null = never).
        closesMonthly: closedByCategory.get(g.category) ?? null
      }))
    },
    derivedAt: new Date().toISOString(),
    note:
      'Every number here is derived by scanning real rows on read. Nothing is stored, estimated, or rounded up — a missed capture is only ever a real "selected another option" event you can trace to your own quote, its value is your own offer\'s total, and the next move is a real open request with its own timestamps. Where a row holds no date or no price, no figure is shown.'
  };
}
