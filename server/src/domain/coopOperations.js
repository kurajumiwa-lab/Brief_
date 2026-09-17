// ---------------------------------------------------------------------------
// COOPERATIVE OPERATIONS — the read that makes a group the customer.
//
// Everything else in Brief is one business looking at itself. A cooperative,
// a SACCO chapter or a chama umbrella has a different question, and it is the
// question that gets paid for: "is my group actually moving money, and is what
// we put in coming back out?" This module answers that from rows that exist.
//
// WHAT IT COUNTS (all derived on read, none stored, none estimated)
//   • the pool — straight from tableBanking.summary(), so the operator's
//     dashboard and the treasurer's screen can never disagree by re-doing maths;
//   • the group's own collective demand — the Requests the group placed, with
//     the status each one is really in and the quotes it really received;
//   • money that settled through Brief on those requests, in the same
//     currency-or-null discipline the precedent layer uses;
//   • each member's PUBLIC shopfront facts, for the operator only.
//
// WHAT IT WILL NOT DO, and this is the part a buyer will ask for anyway
//   • it never ranks members. No "top contributor", no leaderboard, no
//     participation score. A treasurer may see who has and has not contributed
//     (that is a fact of the ledger, already in summary()); attaching a rank or a
//     "reliability" grade to it is a credit judgement Brief is not licensed to
//     make, and the row-level truth does not need a score to be useful.
//   • it never states a member's revenue or turnover outside the group. A
//     member's orders with strangers are their own business; the operator sees
//     that a shopfront is public, how many live offers it holds and whether it
//     is maintained — not their money.
//   • it never invents a number to fill a hole. Share of a member's sales that
//     came through the group? There is no attribution row, so the figure is
//     `null` and listed under `unavailable`. Staff hours and attendance? Brief
//     verifies nothing of the kind, so it is not shown, not zeroed, and never
//     quoted back as something the operator is "losing".
//
// The honesty rule that this module exists to hold: an operator dashboard is the
// easiest surface in the product to decorate with plausible aggregate numbers —
// engagement, member health, expected uplift. Every one of those would be
// invented. A gap is printed as a gap.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { getTableBanking, summary as tbSummary, listCollectiveRequests } from './tableBanking.js';
import { maintenanceFor, editorialQueueFor } from './spaceProfile.js';
import { offerValue, acceptedOffer } from './offerValue.js';
import { getUser } from './auth.js';

const DAY = 86400000;
const UNMET = new Set(['open', 'matching', 'quoted']);

/** The gap list, in the operator's words: what they will ask for and what does
 *  not exist to answer it. Stated so the absence is a decision, not an oversight. */
export const OPERATOR_GAPS = [
  { key: 'member_turnover', label: 'A member’s revenue or turnover outside the group', reason: 'a member’s orders with people other than the group are their own business, and Brief does not read them to an operator' },
  { key: 'attributed_share', label: 'Share of a member’s sales that came through the group', reason: 'there is no attribution row linking an order to a group introduction, so any percentage would be invented' },
  { key: 'staff_hours', label: 'Staff hours or attendance at member businesses', reason: 'Brief verifies no attendance; a number here would be a claim about people we cannot see' },
  { key: 'member_rank', label: 'A ranking of members by contribution or reliability', reason: 'the ledger already says who contributed and who did not; turning that into a grade is a credit judgement Brief is not licensed to make' },
  { key: 'benchmark', label: 'What a comparable group achieves', reason: 'Brief holds no cross-group benchmark table, and a made-up average is how trust products die' }
];

function publicSpacesOf(userId) {
  return store.filter('spaces', (s) => s.ownerId === userId && s.visibility === 'public' && s.status === 'active');
}

function liveOfferCount(space) {
  if (!space?.vendorId) return 0;
  return store.filter('listings', (l) => l.vendorId === space.vendorId && l.status === 'active').length;
}

/**
 * Money the group's OWN requests actually settled in Brief — taken from
 * `workSettlements`, which is the row a payment ends as (one per settled
 * intent, each pointing at a ledger transaction). Not from orders: an order has
 * no request on it, and joining it in would be a guess about who bought for
 * whom. One currency across the rows or `null`: a mixed basket is not a single
 * KES figure and is never presented as one.
 */
function settledForRequests(requestIds, { windowDays = 90 } = {}) {
  const empty = {
    settlements: 0, settledKes: null, currency: null,
    workOrders: 0, workOrdersCompleted: 0, windowDays, latestAt: null
  };
  const ids = new Set(requestIds.filter(Boolean));
  if (!ids.size) return empty;
  const cutoff = Date.now() - windowDays * DAY;
  const rows = store.filter('workSettlements', (w) =>
    w.status === 'settled' && ids.has(w.requestId) && Date.parse(w.settledAt ?? w.createdAt ?? '') >= cutoff);
  const work = store.filter('workOrders', (w) => ids.has(w.requestId));
  const currencies = new Set(rows.map((r) => r.currency).filter(Boolean));
  const one = currencies.size === 1;
  return {
    settlements: rows.length,
    settledKes: one ? rows.reduce((s, r) => s + (Number(r.amount) || 0), 0) : null,
    currency: one ? [...currencies][0] : null,
    workOrders: work.length,
    workOrdersCompleted: work.filter((w) => w.status === 'completed').length,
    windowDays,
    latestAt: rows.map((r) => r.settledAt).filter(Boolean).sort().at(-1) ?? null
  };
}

/**
 * The operator's read. `callerId` decides scope: the group's owner sees the
 * members' public shopfronts; a member sees the shared finance and their own
 * position, and is told exactly why the rest is not theirs.
 */
export function operationsFor(tableBankingId, { callerId = null, now = Date.now(), windowDays = 90 } = {}) {
  const group = getTableBanking(tableBankingId);
  if (!group) return null;
  const s = tbSummary(tableBankingId);
  const isOwner = Boolean(callerId) && group.ownerId === callerId;

  const collective = listCollectiveRequests(tableBankingId).map((row) => {
    const r = row.request ?? null;
    const quotes = r ? store.filter('requestQuotes', (q) => q.requestId === r.id) : [];
    // The value the group actually agreed, read off the accepted offer's own
    // terms — the same two calls precedent.fillStats uses. Never re-priced here,
    // and null when the quote row has no completed terms to read.
    const acceptedQuote = r?.acceptedQuote ?? null;
    const quoteRow = acceptedQuote ? store.find('requestQuotes', (q) => q.id === acceptedQuote.quoteId) : null;
    const value = offerValue(acceptedOffer(quoteRow, acceptedQuote));
    return {
      requestId: row.requestId,
      placedAt: row.placedAt ?? null,
      title: r?.title ?? 'the request row is gone',
      status: r?.status ?? 'unknown',
      open: r ? UNMET.has(r.status) : false,
      quantity: r?.quantity ?? null,
      unit: r?.unit ?? null,
      category: r?.category ?? null,
      location: r?.location ?? null,
      quotes: quotes.length,
      accepted: Boolean(acceptedQuote),
      acceptedValueKes: value ? value.amount : null,
      acceptedValueCurrency: value ? value.currency : null,
      closedAt: r?.closedAt ?? r?.completedAt ?? null
    };
  });

  const byStatus = collective.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const settled = settledForRequests(collective.map((c) => c.requestId), { windowDays });

  const memberBusiness = {
    visible: isOwner,
    reason: isOwner
      ? 'The group owner sees each member’s public shopfront only: that it exists, how many live offers it holds, and how current its own file is. Not their orders, not their money.'
      : 'Only the group owner sees member shopfronts. Your own position is yours below, and it is not shown to other members.',
    rows: []
  };
  if (isOwner) {
    memberBusiness.rows = (group.members ?? []).map((m) => {
      const u = getUser(m.userId);
      const spaces = publicSpacesOf(m.userId);
      return {
        userId: m.userId,
        displayName: u?.displayName ?? u?.handle ?? null,
        joinedAt: m.joinedAt ?? null,
        publicSpaces: spaces.map((sp) => {
          const maintenance = maintenanceFor(sp, { now });
          return {
            id: sp.id,
            name: sp.name,
            slug: sp.slug ?? null,
            liveOffers: liveOfferCount(sp),
            maintenanceState: maintenance?.state ?? 'unstarted',
            openItems: editorialQueueFor(sp, { now }).length
          };
        }),
        // A member with no public shopfront is reported as such. It is not a
        // zero scored against them, and it is not hidden.
        noPublicShopfront: spaces.length === 0 ? 'no public shopfront on Brief' : null
      };
    });
  }

  return {
    id: group.id,
    name: group.name,
    status: group.status ?? 'active',
    currency: group.currency ?? 'KES',
    cycleDays: group.cycleDays ?? null,
    members: group.members?.length ?? 0,
    callerRole: isOwner ? 'owner' : 'member',
    pool: {
      cashOnHand: s.cashOnHand,
      totalContributed: s.totalContributed,
      totalPaidOut: s.totalPaidOut,
      loanedOut: s.loanedOut,
      totalRepaid: s.totalRepaid,
      perCycle: s.contributionAmount,
      welfarePerCycle: s.welfareContributionAmount,
      activeLoans: (s.activeLoans ?? []).length,
      outstandingLoansKes: (s.activeLoans ?? []).reduce((x, l) => x + (l.remaining ?? 0), 0),
      nextRecipientName: s.nextRecipientName ?? null,
      notYetContributed: (s.membersNotYetContributed ?? []).length,
      notYetReceived: (s.membersNotYetReceived ?? []).length
    },
    collective: {
      placed: collective.length,
      open: collective.filter((c) => c.open).length,
      quoted: collective.filter((c) => c.quotes > 0).length,
      accepted: collective.filter((c) => c.accepted).length,
      byStatus,
      windowDays,
      items: collective.slice(0, 20)
    },
    settledThroughBrief: settled,
    memberBusiness,
    unavailable: OPERATOR_GAPS,
    // The benchmark field exists so the surface can print a dash against the
    // question instead of leaving the reader to wonder whether it was forgotten.
    benchmark: null,
    derivedAt: new Date(now).toISOString(),
    note:
      'Every figure here is a count or a sum over rows the group itself wrote: contributions, payouts, loans, the Requests the group placed and what those requests did. ' +
      'The pool is the same arithmetic the treasurer’s screen uses, taken from the same function rather than redone. ' +
      'Money that settled outside Brief is not in it, because Brief did not see it — and the gaps an operator will ask about are listed rather than filled.'
  };
}

export default operationsFor;
