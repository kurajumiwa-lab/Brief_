// ---------------------------------------------------------------------------
// ATTRIBUTION — the provenance chain behind every member.
//
// The distribution infrastructure primitive the strategy critique calls "the
// missing primitive": WHO brought a member in, and WHAT that member went on to
// do, so a partner can be shown — honestly — the economic activity their
// cohort produced.
//
// A provenance chain reads:
//
//   partner=WEF → program=women-enterprise-2026 → cohort=nairobi-west
//     → invite=ABC123 → member=USER456 → order/order/work → KES 12,500
//
// HONESTY (unchanged rules, restated for this module):
//   * an `acquisitions` row is captured ONCE per member at the moment they
//     sign up (first-touch-wins). It is a fact about how someone arrived,
//     never a stored total and never rewritten by later activity.
//   * partner/program/cohort are OPAQUE STRING KEYS + display names the member
//     (or their invite link) carried. They are NOT a claim that a first-class
//     partner organisation exists, is contracted, or is owed money. That is a
//     separate concern (the Partner domain), built on top of these keys.
//   * every economic figure below is DERIVED by scanning real rows — orders,
//     work orders, procurements, requests. Nothing is stored, invented, or
//     projected. A member with no activity shows zero, plainly.
//   * a partner/cohort with no members and no activity shows an EMPTY summary,
//     never a fabricated "10,000 members" number.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { CURRENCIES } from './quoteValidation.js';

// Which marketplace order statuses count as commercial activity (a buyer's
// commitment that was actually fulfilled). Everything else is intent, not
// activity.
const FULFILLED_ORDER_STATUS = new Set(['fulfilled']);

// A completed work order is the verified end of a two-party fulfillment.
const COMPLETED_WORK_STATUS = new Set(['completed']);

// The acquisition fields we will ever capture. Anything else a client sends
// is ignored so the row cannot be stuffed with foreign claims.
const CAPTURE_KEYS = [
  'partnerKey', 'partnerName',
  'programKey', 'programName',
  'cohortKey', 'cohortName',
  'inviteCode',
  'channel',
  'source',
  'utmSource', 'utmMedium', 'utmCampaign', 'utmContent',
  'referrerId'
];

// Normalise a provenance string: trimmed, capped, or null when empty. An
// opaque key is lowercased so "WEF" and "wef" group together; display names
// are left as typed (they are labels, not identities).
function str(value, { key = false, max = 96 } = {}) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const capped = s.slice(0, max);
  return key ? capped.toLowerCase() : capped;
}

/** Convert integer minor units to major units for the reported currency.
 *  Returns null when the amount or currency is unknown, so a missing figure
 *  is stated as missing rather than silently treated as KES. */
function minorToMajor(minor, currency) {
  if (!Number.isFinite(minor)) return null;
  const exp = CURRENCIES[currency];
  if (exp === undefined) return null;
  return Math.round(minor / 10 ** exp);
}

/**
 * Record how a member arrived — once. First touch wins: a later call (e.g. a
 * re-sign-in carrying a different code) is ignored so the row stays the TRUE
 * origin and cannot be rewritten by activity. Returns the stored row.
 */
export function capture(userId, context = {}) {
  if (!userId) throw new Error('a user is required');
  const existing = store.find('acquisitions', (a) => a.userId === userId);
  if (existing) return existing;

  const row = {
    id: newId('acq'),
    userId,
    createdAt: new Date().toISOString()
  };
  for (const k of CAPTURE_KEYS) {
    row[k] = str(context?.[k], { key: /Key$/.test(k) });
  }
  // A row with no provenance at all is not stored: the absence of an
  // acquisition row is itself the honest statement "we don't know how this
  // member arrived".
  const hasAny = CAPTURE_KEYS.some((k) => row[k] !== null);
  if (!hasAny) return null;
  return store.insert('acquisitions', row);
}

/** The acquisition row for a member, or null when none was captured. */
export function acquisitionOf(userId) {
  return store.find('acquisitions', (a) => a.userId === userId) ?? null;
}

/** The human-readable provenance chain, null segments omitted. Always ends at
 *  the member, never fabricates an intermediate hop that wasn't captured. */
export function provenanceChain(userId) {
  const a = acquisitionOf(userId);
  if (!a) return null;
  const chain = [];
  if (a.partnerKey) chain.push({ hop: 'partner', key: a.partnerKey, name: a.partnerName ?? a.partnerKey });
  if (a.programKey) chain.push({ hop: 'program', key: a.programKey, name: a.programName ?? a.programKey });
  if (a.cohortKey) chain.push({ hop: 'cohort', key: a.cohortKey, name: a.cohortName ?? a.cohortKey });
  if (a.inviteCode) chain.push({ hop: 'invite', code: a.inviteCode });
  chain.push({ hop: 'member', id: userId });
  return chain;
}

/**
 * Everything a member actually did on Brief, derived from real rows only.
 * Each bucket is reported separately (count + total in major units) so the
 * composition is visible; `verifiedCommercialKes` is the headline number a
 * partner is shown and is the sum of real fulfilled orders and completed work
 * orders this member was a party to — never a stored balance.
 */
export function economicActivityOf(userId) {
  // Marketplace: what the member BOUGHT.
  const boughtOrders = store.filter('orders', (o) => o.buyerId === userId && FULFILLED_ORDER_STATUS.has(o.status));
  const boughtKes = boughtOrders.reduce((s, o) => s + (Number(o.totals?.total ?? o.total ?? 0) || 0), 0);

  // Marketplace: what the member SOLD (as the owner of a vendor).
  const vendorIds = new Set(store.filter('vendors', (v) => v.ownerId === userId).map((v) => v.id));
  const listingIds = new Set(
    store.filter('listings', (l) => vendorIds.has(l.vendorId)).map((l) => l.id)
  );
  const soldOrders = store.filter('orders', (o) => listingIds.has(o.listingId) && FULFILLED_ORDER_STATUS.has(o.status));
  const soldKes = soldOrders.reduce((s, o) => s + (Number(o.totals?.total ?? o.total ?? 0) || 0), 0);

  // Work orders: what the member REQUESTED and what they FULFILLED.
  const requestedWork = store.filter('workOrders', (w) => w.requesterId === userId && COMPLETED_WORK_STATUS.has(w.status));
  const fulfilledWork = store.filter('workOrders', (w) => w.participantUserId === userId && COMPLETED_WORK_STATUS.has(w.status));
  const workTotal = (rows) =>
    rows.reduce((s, w) => {
      const terms = w.agreements?.at?.(-1)?.terms ?? {};
      const major = minorToMajor(terms.totalMinor, terms.currency);
      return s + (major ?? 0);
    }, 0);
  const requestedKes = workTotal(requestedWork);
  const fulfilledKes = workTotal(fulfilledWork);

  // Repeat-procurement memory: how many completed orders became repeatable
  // patterns (this is a count of real completed work orders, not new money).
  const procurements = store.filter('procurements', (p) => p.ownerId === userId);

  // Demand the member created.
  const requests = store.filter('requests', (r) => r.requesterId === userId);

  const verifiedCommercialKes = boughtKes + soldKes + requestedKes + fulfilledKes;

  return {
    orders: {
      bought: { count: boughtOrders.length, totalKes: boughtKes },
      sold: { count: soldOrders.length, totalKes: soldKes }
    },
    work: {
      requested: { count: requestedWork.length, totalKes: requestedKes },
      fulfilled: { count: fulfilledWork.length, totalKes: fulfilledKes }
    },
    procurement: { repeatPatterns: procurements.length },
    requests: { created: requests.length },
    // The single honest headline: value of real fulfilled orders + completed
    // work orders. Derived, never stored.
    verifiedCommercialKes,
    currency: 'KES'
  };
}

/** Resolve an acquisition filter into the set of member ids it matches.
 *  Any combination of partner/program/cohort may be given; empty filter
 *  matches nothing (so a report is always an explicit ask, never "everyone"). */
function memberIdsFor({ partnerKey, programKey, cohortKey } = {}) {
  const p = str(partnerKey, { key: true });
  const g = str(programKey, { key: true });
  const c = str(cohortKey, { key: true });
  if (!p && !g && !c) return new Set();
  const rows = store.filter('acquisitions', (a) => {
    if (p && a.partnerKey !== p) return false;
    if (g && a.programKey !== g) return false;
    if (c && a.cohortKey !== c) return false;
    return true;
  });
  return new Set(rows.map((a) => a.userId));
}

/** Aggregate real economic activity across a partner/program/cohort slice.
 *  The B2B answer to "what did this cohort actually do?" — counts + totals
 *  derived from real rows, plus the per-member rows so nothing is hidden. */
export function cohortSummary(filter = {}) {
  const ids = memberIdsFor(filter);
  const members = [...ids];
  const rows = members.map((userId) => ({
    userId,
    acquisition: acquisitionOf(userId),
    activity: economicActivityOf(userId)
  }));

  const sum = (f) => rows.reduce((s, r) => s + (f(r.activity) || 0), 0);
  const count = (f) => rows.reduce((s, r) => s + (f(r.activity) || 0), 0);

  return {
    filter: {
      partnerKey: str(filter.partnerKey, { key: true }),
      programKey: str(filter.programKey, { key: true }),
      cohortKey: str(filter.cohortKey, { key: true })
    },
    members: rows.length,
    ordersBought: count((a) => a.orders.bought.count),
    ordersBoughtKes: sum((a) => a.orders.bought.totalKes),
    ordersSold: count((a) => a.orders.sold.count),
    ordersSoldKes: sum((a) => a.orders.sold.totalKes),
    workRequested: count((a) => a.work.requested.count),
    workRequestedKes: sum((a) => a.work.requested.totalKes),
    workFulfilled: count((a) => a.work.fulfilled.count),
    workFulfilledKes: sum((a) => a.work.fulfilled.totalKes),
    repeatPatterns: count((a) => a.procurement.repeatPatterns),
    requestsCreated: count((a) => a.requests.created),
    verifiedCommercialKes: sum((a) => a.verifiedCommercialKes),
    currency: 'KES',
    // A gross figure: when both the buyer and the seller of one order are
    // members of the same cohort, that order is counted once on each side.
    // Stated here rather than silently folded, so no partner is misled.
    note: 'Gross activity across members. A cohort-internal transaction counts once for the buyer and once for the seller.',
    // Per-member breakdown — nothing aggregated is ever hidden.
    rows
  };
}

/** Group every acquisition by partner key (then cohort) for the operator
 *  surface. Empty when no member arrived with provenance — never fabricated. */
export function attributionReport() {
  const rows = store.all('acquisitions');
  const byPartner = new Map();
  for (const a of rows) {
    const pk = a.partnerKey ?? '(no partner)';
    if (!byPartner.has(pk)) {
      byPartner.set(pk, {
        partnerKey: a.partnerKey,
        partnerName: a.partnerName ?? (a.partnerKey ? a.partnerKey : 'Unknown origin'),
        programs: new Map()
      });
    }
    const entry = byPartner.get(pk);
    const pk2 = a.programKey ?? '(no program)';
    if (!entry.programs.has(pk2)) entry.programs.set(pk2, { programKey: a.programKey, programName: a.programName ?? null, cohorts: new Map() });
    const prog = entry.programs.get(pk2);
    const ck = a.cohortKey ?? '(no cohort)';
    if (!prog.cohorts.has(ck)) prog.cohorts.set(ck, { cohortKey: a.cohortKey, cohortName: a.cohortName ?? null, memberIds: [] });
    prog.cohorts.get(ck).memberIds.push(a.userId);
  }

  // Convert the nested maps to plain objects with derived economic totals.
  return [...byPartner.values()].map((entry) => {
    let memberTotal = 0;
    const programs = [...entry.programs.values()].map((prog) => {
      const cohorts = [...prog.cohorts.values()].map((coh) => {
        const summary = cohortSummary({ partnerKey: entry.partnerKey ?? undefined, programKey: prog.programKey ?? undefined, cohortKey: coh.cohortKey ?? undefined });
        memberTotal += summary.members;
        return {
          cohortKey: coh.cohortKey,
          cohortName: coh.cohortName,
          members: summary.members,
          verifiedCommercialKes: summary.verifiedCommercialKes,
          workFulfilled: summary.workFulfilled,
          ordersBought: summary.ordersBought,
          ordersSold: summary.ordersSold
        };
      });
      return {
        programKey: prog.programKey,
        programName: prog.programName,
        cohorts
      };
    });
    return {
      partnerKey: entry.partnerKey,
      partnerName: entry.partnerName,
      members: memberTotal,
      programs
    };
  });
}
