// ---------------------------------------------------------------------------
// PULSE — "what is the local economy doing?" Answered only with real rows.
//
// This is the honest version of a signal bar. Every phrase below is a count or
// a sum over rows that exist right now, computed on read:
//
//   demand    — live requests with no accepted quote (the gap engine).
//   closure   — requests that actually reached an accepted quote recently.
//   fill      — how long those took and what the accepted offers were priced
//               at, from their own terms. null when no row carries the figure.
//   money     — settled order totals, completed work orders, delivered pickups.
//   listings  — the CURRENT average listed price per listing type: a snapshot.
//   events    — published campaigns that have not ended, plus what appeared in
//               the last 24 hours.
//
// Deliberately absent, because no row supports them:
//   * a "price movement %" or trend (a listing carries one price, not a series;
//     there is no market feed wired into Brief and no soko/WFP connector here);
//   * any "live" claim — this is a snapshot of the store taken on read, so the
//     surface stamps it with the newest real row time and never pulses a fake
//     "LIVE SCANNING" state;
//   * sector/route figures, rider counts per route, per-run prices.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { unmetDemand } from './gaps.js';
import { categoryClosure, movement, fillStats } from './precedent.js';
import { priceSignals } from './priceSignals.js';
import { hasEnded } from './events.js';

const DAY = 86400000;
const RECENT_MS = DAY; // "in the last 24 hours"

const money = (amount, currency) =>
  `${currency ?? 'KES'} ${Number(amount).toLocaleString('en-KE')}`;

/** The newest real timestamp among the rows that contributed to this read. */
function newestRowTime() {
  let best = null;
  const consider = (value) => {
    if (!value) return;
    const ms = Date.parse(value);
    if (Number.isFinite(ms) && (best === null || ms > best)) best = ms;
  };
  for (const r of store.filter('requests', () => true)) consider(r.updatedAt ?? r.createdAt);
  for (const r of store.filter('orders', () => true)) consider(r.updatedAt ?? r.createdAt);
  for (const r of store.filter('campaigns', () => true)) consider(r.updatedAt ?? r.createdAt);
  for (const r of store.filter('listings', () => true)) consider(r.updatedAt ?? r.createdAt);
  for (const r of store.filter('pickups', () => true)) consider(r.completedAt ?? r.updatedAt ?? r.createdAt);
  return best === null ? null : new Date(best).toISOString();
}

function countSince(table, stampField = 'createdAt') {
  const cutoff = Date.now() - RECENT_MS;
  return store.filter(table, (r) => Date.parse(r[stampField] ?? r.updatedAt ?? '') >= cutoff).length;
}

export function pulse() {
  const demand = unmetDemand();
  const closure = categoryClosure();
  const moved = movement();
  const fills = fillStats();
  const prices = priceSignals();

  const openCampaigns = store.filter(
    'campaigns',
    (c) => (c.status === 'published' || c.status === 'live') && !hasEnded(c)
  );
  const closedTotal = closure.byCategory.reduce((s, c) => s + c.closed, 0);
  const listingsOpen = store.filter('listings', (l) => l.status === 'active').length;

  const sections = {
    demand: {
      open: demand.total,
      bySeverity: demand.bySeverity,
      collective: demand.gaps.filter((g) => g.collective).length
    },
    closure: {
      windowDays: closure.windowDays,
      closed: closedTotal,
      topCategory: closure.byCategory[0] ?? null
    },
    fill: {
      windowDays: fills.windowDays,
      closed: fills.closed,
      avgHoursToFill: fills.avgHoursToFill,
      hoursSampleCount: fills.hoursSampleCount,
      avgValue: fills.avgValue
    },
    money: {
      windowDays: moved.windowDays,
      settledOrders: moved.settledOrders,
      settledValue: moved.settledCurrency ? moved.settledOrdersKes : null,
      settledCurrency: moved.settledCurrency,
      completedWorkOrders: moved.completedWorkOrders,
      deliveredPickups: moved.deliveredPickups
    },
    listings: {
      active: listingsOpen,
      snapshot: prices.signals
    },
    events: {
      open: openCampaigns.length,
      newLast24h: {
        requests: countSince('requests'),
        events: countSince('campaigns'),
        listings: countSince('listings'),
        orders: countSince('orders')
      }
    }
  };

  // Facts are composed here so the phrasing is one auditable thing, not a
  // string each surface guesses at. A fact is emitted ONLY when its rows exist.
  const facts = [];
  const push = (id, text) => facts.push({ id, text });

  if (sections.demand.open > 0) {
    push(
      'gaps',
      `${sections.demand.open} request${sections.demand.open === 1 ? '' : 's'} open with no accepted quote`
    );
    if (sections.demand.bySeverity.no_supplier > 0) {
      push(
        'no_supplier',
        `${sections.demand.bySeverity.no_supplier} of ${
          sections.demand.open
        } ha${sections.demand.bySeverity.no_supplier === 1 ? 's' : 've'} nobody matched yet`
      );
    }
    if (sections.demand.collective > 0) {
      push(
        'collective',
        `${sections.demand.collective} ${
          sections.demand.collective === 1 ? 'is a' : 'are'
        } a group's collective order`
      );
    }
  }

  if (sections.closure.closed > 0) {
    push(
      'closure',
      `${sections.closure.closed} request${
        sections.closure.closed === 1 ? '' : 's'
      } closed in the last ${sections.closure.windowDays} days`
    );
    if (typeof sections.fill.avgHoursToFill === 'number') {
      push(
        'fill_speed',
        `took ${sections.fill.avgHoursToFill}h on average across ${sections.fill.hoursSampleCount} real row${
          sections.fill.hoursSampleCount === 1 ? '' : 's'
        }`
      );
    }
    if (sections.fill.avgValue) {
      push(
        'fill_value',
        `accepted offers averaged ${money(
          sections.fill.avgValue.amount,
          sections.fill.avgValue.currency
        )} (${sections.fill.avgValue.sampleCount} priced offer${
          sections.fill.avgValue.sampleCount === 1 ? '' : 's'
        })`
      );
    }
  }

  if (sections.money.settledOrders > 0) {
    push(
      'money',
      `${sections.money.settledOrders} order${
        sections.money.settledOrders === 1 ? '' : 's'
      } settled${
        sections.money.settledValue !== null
          ? ` for ${money(sections.money.settledValue, sections.money.settledCurrency)}`
          : ''
      } in the last ${sections.money.windowDays} days`
    );
  }
  if (sections.money.completedWorkOrders > 0) {
    push(
      'work',
      `${sections.money.completedWorkOrders} work order${
        sections.money.completedWorkOrders === 1 ? '' : 's'
      } completed`
    );
  }
  if (sections.money.deliveredPickups > 0) {
    push(
      'pickups',
      `${sections.money.deliveredPickups} pickup${
        sections.money.deliveredPickups === 1 ? '' : 's'
      } delivered`
    );
  }

  if (sections.events.open > 0) {
    push(
      'events',
      `${sections.events.open} published event${sections.events.open === 1 ? '' : 's'} still open`
    );
  }
  for (const s of sections.listings.snapshot) {
    push(
      `price_${s.type}`,
      `${s.count} active ${s.type}${s.count === 1 ? '' : 's'} · average listed ${money(
        s.avgPrice,
        s.currency
      )} (range ${money(s.minPrice, s.currency)}–${money(s.maxPrice, s.currency)})`
    );
  }

  const recent = sections.events.newLast24h;
  const newTotal = recent.requests + recent.events + recent.listings + recent.orders;
  if (newTotal > 0) {
    push('new_24h', `${newTotal} new row${newTotal === 1 ? '' : 's'} in the last 24 hours`);
  }

  return {
    asOf: newestRowTime(),
    sections,
    facts,
    empty: facts.length === 0,
    note:
      'Derived on read from real rows in the store. A snapshot, not a live feed: there is no market price ' +
      'index, no external commodity feed and no trend percentage, because no row in Brief holds a price ' +
      'history. Every count above traces to rows a user could query themselves.'
  };
}
