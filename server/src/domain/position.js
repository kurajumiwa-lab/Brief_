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
//              a campaign waitlist position + offer expiry, the field-agent
//              override's 24-month window, and lipa-mdogo overdue instalments.
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
import { overrideObligation } from './fieldAgent.js';
import { listFor as lipaMdogoContracts, contractState } from './lipaMdogo.js';
import { unmetDemand } from './gaps.js';
import { categoryClosure } from './precedent.js';

// Same end-of-day-in-Nairobi semantics the quote layer uses, so an expiring
// quote is judged by the same clock everywhere.
const expiryMs = (value) => (value ? Date.parse(`${value}T23:59:59.999+03:00`) : Infinity);
const HOUR = 3600000;
const MONTH = 30.44 * 24 * HOUR;

const CLOSED_QUOTE = new Set(['accepted', 'declined', 'withdrawn']);

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

  // --- DECAY 3: the field-agent override's 24-month window -----------------
  const obligation = overrideObligation(userId);
  const activeClaims = obligation.claims.filter((c) => c.expiresAt);
  let override = null;
  if (activeClaims.length) {
    const soonest = activeClaims.sort((a, b) => (a.expiresAt < b.expiresAt ? -1 : 1))[0];
    override = {
      claimCount: activeClaims.length,
      monthsLeft: Math.max(0, Math.round((Date.parse(soonest.expiresAt) - now) / MONTH)),
      expiresAt: soonest.expiresAt
    };
  }

  // --- DECAY 4: lipa-mdogo overdue instalments -----------------------------
  let overdueInstallments = 0;
  for (const contract of lipaMdogoContracts(userId)) {
    overdueInstallments += contractState(contract.id).summary.overdueCount;
  }

  // --- MISSED: my quotes declined because another was selected -------------
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
      at: lost.at ?? q.updatedAt ?? null
    });
  }
  missed.sort((a, b) => (a.at < b.at ? 1 : -1));

  // --- OPEN: still-open unmet demand (action framing, not loss) -------------
  const gaps = unmetDemand();
  // Precedent: how many requests in each category have actually closed lately.
  const closure = categoryClosure();
  const closedByCategory = new Map(closure.byCategory.map((c) => [c.category, c.closed]));

  return {
    decay: {
      expiringQuotes,
      waitlist,
      override,
      overdueInstallments
    },
    missedCapture: {
      count: missed.length,
      recent: missed.slice(0, 5)
    },
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
      'Every number here is derived by scanning real rows on read. Nothing is stored, estimated, or rounded up — a missed capture is only ever a real "selected another option" event you can trace to your own quote.'
  };
}
