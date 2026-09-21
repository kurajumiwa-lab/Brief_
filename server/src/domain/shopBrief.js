// ---------------------------------------------------------------------------
// THE MORNING BRIEF — one day of a business, read out of its own rows.
//
// An owner shuts up at 6pm and comes back at 8am. In between, money moved or
// didn't, stock left the shelf or didn't, someone recorded something or didn't.
// The brief answers that gap with one rule: EVERY FIGURE IS A SCAN.
//
// WHY THERE IS NO `shopBriefs` TABLE
//   A stored aggregate is a second source of truth. An expense can be dated
//   into the past (`POST .../expenses` takes a `date`), an order's status moves
//   after the fact, an offer gets re-filed under another space. A row written at
//   05:30 would go on saying what was true at 05:30 — and the moment it
//   disagreed with the ledger, one of the two would be a lie. So the brief is
//   computed on every read from the rows themselves: the same figures for the
//   same day, for as long as the rows exist. Nothing to expire, nothing to
//   re-run, nothing to backfill, and no archive that quietly keeps reporting a
//   number the shop has since corrected.
//
// WHAT IT COUNTS, AND ON WHICH DAY
//   * money in  — orders whose OWN history row says they became paid or settled
//                 on that day. Not "orders placed that day", and not "money
//                 through a payment rail": no rail is connected, so these are
//                 orders somebody marked.
//   * money out — expenses the owner recorded with that date. There is no
//                 import path, so this is "what you wrote down" and the read
//                 says so in the same breath.
//   * net       — marked in minus recorded out. Never called profit here.
//   * people    — the space activity rows for that day, grouped by the actor the
//                 row already names. No name is printed that a user row does not
//                 carry; there is no rota and no schedule table, so the brief
//                 cannot say someone was expected and absent. It does not.
//
// WHAT IT REFUSES
//   ranks, tiers, badges, streaks, "top 10% of shops like yours", sector
//   averages, targets, forecasts, recommendations, and any count whose rows do
//   not exist. A day with nothing recorded returns `empty: true` and no figures
//   at all — not a page of zeros, which is how an absent record starts to read
//   as a record that nothing happened.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { dayBucket, todayKey } from '../dayBoundary.js';
import { spaceBookScope, SETTLED_ORDER_STATUSES, modeLabel } from './space.js';
import { movementsOnDay } from './stockLog.js';
import { notify } from './notifications.js';

/** The statuses that mean "this order's money is meant to have moved". */
const MOMENT_STATUSES = SETTLED_ORDER_STATUSES;
/** Everything short of a terminal state: a real order still waiting on someone. */
export const OPEN_ORDER_STATUSES = ['offered', 'ordered', 'accepted', 'preparing', 'ready'];
/** The flag kinds this module can produce. Each one is a comparison of rows. */
export const BRIEF_FLAG_KINDS = [
  'stock_recount',
  'orders_aged',
  'outflow_unrecorded',
  'money_unattributed'
];
/** The morning hour an owner may pick, in Nairobi time. */
export const HOUR_RANGE = { min: 0, max: 23 };

const DAY_KEYS = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const KES = new Intl.NumberFormat('en-KE');
const DAY_NAME = new Intl.DateTimeFormat('en-KE', {
  timeZone: 'Africa/Nairobi', weekday: 'short', day: 'numeric', month: 'short'
});
const EAT_HOUR = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Nairobi', hour: '2-digit', hour12: false
});
const CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hour12: false
});

export function formatKes(n) {
  return `KES ${KES.format(Number(n) || 0)}`;
}

/** The day a brief is about, named the way the rest of the app names days. */
export function dayLabel(dayKey) {
  const ms = Date.parse(`${dayKey}T12:00:00Z`);
  if (!Number.isFinite(ms)) return String(dayKey);
  // Noon UTC is the anchor the forecast uses too: it always sits inside the same
  // Nairobi day, so a calendar date cannot shift across a boundary while named.
  return DAY_NAME.format(new Date(ms));
}

function previousDay(dayKey) {
  return new Date(Date.parse(`${dayKey}T12:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}

function hourInEat(ms) {
  return Number(EAT_HOUR.format(new Date(ms)).split(':')[0]) || 0;
}

function clockInEat(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? CLOCK.format(new Date(ms)) : null;
}

/** A validated day to read, or the day before `now`. Nothing else is guessed. */
function resolveDay(day, nowMs) {
  const today = todayKey(nowMs);
  if (day === undefined || day === null || day === '') return { day: previousDay(today), isToday: false };
  const want = String(day).trim();
  // Round-tripped through the app's own day rule rather than trusted: `Date.parse`
  // happily accepts 2026-02-30 and rolls it into March, and a brief quietly
  // answering for a different day than the one asked for is worse than a refusal.
  const parsed = Date.parse(`${want}T12:00:00Z`);
  if (!DAY_KEYS.test(want) || !Number.isFinite(parsed) || dayBucket(parsed) !== want) {
    const e = new Error('day must be a real calendar date written as YYYY-MM-DD');
    e.status = 400;
    throw e;
  }
  if (want > today) {
    const e = new Error('a brief reports what happened, so it cannot be asked of a day that has not arrived');
    e.status = 400;
    throw e;
  }
  return { day: want, isToday: want === today };
}

/** The shop: one owner's vendor row, their spaces, and everything under them. */
function shopRows(ownerId) {
  const vendor = store.find('vendors', (v) => v.ownerId === ownerId) ?? null;
  const spaces = store.filter('spaces', (s) => s.ownerId === ownerId);
  const spaceIds = spaces.map((s) => s.id);
  const inShop = (row) => Boolean(row) && (
    row.vendorOwnerId === ownerId
    || (vendor ? row.vendorId === vendor.id : false)
    || (row.spaceId ? spaceIds.includes(row.spaceId) : false)
  );
  return { vendor, spaces, spaceIds, inShop };
}

/**
 * When an order's money is said to have moved, read off the order itself: the
 * first history entry in a money status, else the settled/fulfilled column,
 * else nothing.
 */
function moneyMoment(order) {
  const entries = Array.isArray(order.history) ? order.history : [];
  for (const entry of entries) {
    if (entry && MOMENT_STATUSES.includes(entry.status) && entry.at) {
      return { at: entry.at, stamped: true, source: 'history' };
    }
  }
  const stamped = order.settledAt ?? order.fulfilledAt ?? null;
  if (stamped) return { at: stamped, stamped: true, source: 'row' };
  // An order marked paid with no timestamp anywhere on it cannot be placed on a
  // calendar honestly. Its amount stays out of the day's figure and is counted
  // in `orders.unstamped`, because a total that quietly drops a sale is the
  // same class of error as one that quietly invents it.
  return { at: null, stamped: false, source: 'none' };
}

/**
 * THE BRIEF. Read-only, derived on every call, and identical for anyone
 * entitled to see it: the owner and the rows are its only inputs.
 */
export function shopBriefForOwner(ownerId, { day = null, now = new Date() } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : (Date.parse(now) || Date.now());
  const { day: want, isToday } = resolveDay(day, nowMs);
  const { vendor, spaces, spaceIds, inShop } = shopRows(ownerId);
  const spaceNameById = new Map(spaces.map((s) => [s.id, s.name]));

  const base = {
    ok: true,
    day: want,
    dayLabel: dayLabel(want),
    isToday,
    asOf: new Date(nowMs).toISOString(),
    // There is no brief table to stamp, so the read says what it is.
    stored: false,
    shop: {
      vendorId: vendor?.id ?? null,
      name: vendor?.displayName || vendor?.name || 'Your shop',
      ownerId
    },
    basis: {
      in: 'orders marked paid or settled, on the day their own row says they moved',
      out: 'expenses you recorded and dated that day — nothing is imported',
      net: 'marked in minus recorded out, not profit',
      views: 'opens of a space’s public page; your own opens are left out'
    }
  };

  if (spaces.length === 0) {
    return {
      ...base,
      empty: true,
      reason: 'no_spaces',
      // `null`, not 0. A business with no space has not "sold nothing" — it has
      // nothing that could be sold, and a zero on a screen is a claim.
      spaces: [],
      quietSpaces: [],
      money: null,
      orders: null,
      people: [],
      views: null,
      flags: [],
      unassigned: null
    };
  }

  // ---- the day's orders, bucketed by the rule that already governs space money
  const scopes = spaces.map((space) => ({ space, scope: spaceBookScope(space) }));
  const perSpace = new Map(scopes.map(({ space }) => [space.id, {
    placed: [], marked: [], open: [], expenses: [], views: 0, inKes: 0, outKes: 0
  }]));
  const totals = { placed: 0, marked: 0, markedKes: 0, open: 0, unstamped: 0 };
  const unassigned = { orders: 0, inKes: 0, evidenceIds: [] };
  const movedByStatus = {};
  const aged = [];

  for (const order of store.all('orders').filter(inShop)) {
    const moment = moneyMoment(order);
    const placedDay = dayBucket(order.createdAt ?? order.updatedAt ?? nowMs);
    const markedDay = moment.at ? dayBucket(moment.at) : null;
    if (!moment.stamped && MOMENT_STATUSES.includes(order.status)) totals.unstamped++;

    for (const entry of (Array.isArray(order.history) ? order.history : [])) {
      if (entry?.at && dayBucket(entry.at) === want) {
        movedByStatus[entry.status] = (movedByStatus[entry.status] ?? 0) + 1;
      }
    }

    const homes = scopes.filter(({ scope }) => scope.belongsToOrder(order)).map(({ space }) => space.id);
    // Nobody's, and somebody else's: exactly the row the scoping rule refuses to
    // spread across spaces. It is counted once, for the business.
    const isUnassigned = homes.length === 0
      && scopes.some(({ scope }) => scope.unattachedOrder(order));
    const kes = Number(order.total) || 0;

    if (placedDay === want) {
      totals.placed++;
      for (const id of homes) perSpace.get(id).placed.push(order);
    }
    if (markedDay === want) {
      totals.marked++;
      totals.markedKes += kes;
      for (const id of homes) {
        const row = perSpace.get(id);
        row.marked.push(order);
        row.inKes += kes;
      }
      if (isUnassigned) {
        unassigned.orders++;
        unassigned.inKes += kes;
        unassigned.evidenceIds.push(order.id);
      }
    }
    if (OPEN_ORDER_STATUSES.includes(order.status) && placedDay <= want) {
      totals.open++;
      for (const id of homes) perSpace.get(id).open.push(order);
      if (placedDay < want) aged.push(order);
    }
  }

  // ---- expenses: the only outflow this store has rows for
  const expenseRows = store.filter('spaceExpenses', (e) => spaceIds.includes(e.spaceId));
  const expensesOfDay = expenseRows.filter((e) => (e.date || dayBucket(e.createdAt ?? nowMs)) === want);
  for (const e of expensesOfDay) {
    const row = perSpace.get(e.spaceId);
    if (!row) continue;
    row.expenses.push(e);
    row.outKes += Number(e.amountKes) || 0;
  }

  // ---- views: opens of the public pages, dated by when they happened
  let viewsCount = 0;
  let ownOpensExcluded = 0;
  for (const s of store.filter('signals', (row) => row.type === 'space_viewed'
    && row.metadata?.spaceId && spaceIds.includes(row.metadata.spaceId)
    && dayBucket(row.createdAt ?? '') === want)) {
    if (s.actorId && s.actorId === ownerId) { ownOpensExcluded++; continue; }
    viewsCount++;
    const row = perSpace.get(s.metadata.spaceId);
    if (row) row.views++;
  }

  // ---- the shelf: which counts moved, and how far
  const shopListings = store.filter('listings', (l) => (vendor ? l.vendorId === vendor.id : false)
    || (l.spaceId ? spaceIds.includes(l.spaceId) : false));
  const movements = movementsOnDay(shopListings.map((l) => l.id), want);

  // ---- who wrote something that day
  const activityRows = store.filter('spaceActivities', (a) => spaceIds.includes(a.spaceId)
    && dayBucket(a.createdAt ?? '') === want);
  const people = peopleFromActivity(activityRows, ownerId);

  // `totals.markedKes` already holds every marked order once, including the ones
  // no space can claim: `unassigned` is a BREAKDOWN of that figure, never an
  // addition to it. Summing both is how a dashboard double-counts a shilling.
  const moneyIn = totals.markedKes;
  const moneyOut = expensesOfDay.reduce((sum, e) => sum + (Number(e.amountKes) || 0), 0);
  // A shelf movement is a row for the day even when nothing was sold from it:
  // someone touched the count, and the brief exists to notice that.
  const empty = !(totals.placed || totals.marked || expensesOfDay.length || activityRows.length
    || viewsCount || movements.size);

  // ---- flags: each one a comparison of rows, each one pointing at its evidence
  const flags = [];
  flags.push(...stockFlagsFor({ listings: shopListings, movements, day: want, spaceNameById, ownerId }));

  if (aged.length > 0) {
    const oldest = aged.reduce((min, o) => (((o.createdAt ?? '') < (min.createdAt ?? '')) ? o : min), aged[0]);
    flags.push({
      id: `aged:${want}`,
      kind: 'orders_aged',
      spaceId: null,
      message: `${aged.length} order${aged.length === 1 ? '' : 's'} placed before ${dayLabel(want)} ${
        aged.length === 1 ? 'is' : 'are'} still open`,
      detail: `oldest placed ${dayLabel(dayBucket(oldest.createdAt ?? ''))} at ${clockInEat(oldest.createdAt) ?? '—'}`,
      evidenceIds: aged.map((o) => o.id),
      action: { label: 'Open the pipeline', surface: 'pipeline' }
    });
  }

  if (moneyIn > 0 && expensesOfDay.length === 0) {
    flags.push({
      id: `outflow:${want}`,
      kind: 'outflow_unrecorded',
      spaceId: null,
      message: `${formatKes(moneyIn)} marked in, and nothing was recorded out`,
      // Both branches close the same way. A day with no outflow rows is most
      // likely a day that simply had no outflow, and a brief that implies
      // otherwise teaches an owner to distrust the whole screen.
      detail: expensesEverRecorded(spaceIds)
        ? 'If nothing went out, that is correct. This asks; it does not accuse.'
        : 'No expense has ever been recorded on this business, so the outflow figure is empty by construction rather than by fact. '
          + 'This asks; it does not accuse. Each space’s Money tab is where one goes in.',
      evidenceIds: [],
      action: { label: 'Record what went out', surface: 'ledger' }
    });
  }

  if (unassigned.orders > 0) {
    flags.push({
      id: `unassigned:${want}`,
      kind: 'money_unattributed',
      spaceId: null,
      message: `${formatKes(unassigned.inKes)} (${unassigned.orders} order${
        unassigned.orders === 1 ? '' : 's'}) settled on an offer filed under no space`,
      detail: 'It is counted for the business and left out of every space, so the space figures add up to less than this one and say why.',
      evidenceIds: unassigned.evidenceIds,
      action: { label: 'See the offers', surface: 'catalog' }
    });
  }

  // ---- the per-space lines, and the names of the spaces that were quiet
  const spaceBriefs = [];
  const quietSpaces = [];
  for (const { space, scope } of scopes) {
    const row = perSpace.get(space.id);
    const hasRows = row.placed.length || row.marked.length || row.expenses.length || row.views > 0;
    if (!hasRows) { quietSpaces.push(space.name); continue; }
    spaceBriefs.push({
      id: space.id,
      name: space.name,
      slug: space.slug ?? null,
      mode: space.mode ?? null,
      modeLabel: modeLabel(space.mode),
      scope: scope.sole ? 'sole space of this business' : 'this space only',
      money: { inKes: row.inKes, outKes: row.outKes, netKes: row.inKes - row.outKes },
      orders: { placed: row.placed.length, marked: row.marked.length, open: row.open.length },
      views: row.views
    });
  }

  return {
    ...base,
    empty,
    reason: empty ? 'quiet_day' : null,
    money: {
      inKes: moneyIn,
      outKes: moneyOut,
      netKes: moneyIn - moneyOut,
      currency: 'KES',
      // The figure an owner most wants and this store cannot give: no payment
      // rail is connected, so nothing has settled THROUGH Brief. `—`, not 0.
      railSettledKes: null
    },
    orders: {
      placed: totals.placed,
      marked: totals.marked,
      open: totals.open,
      cancelled: movedByStatus.cancelled ?? 0,
      disputed: movedByStatus.disputed ?? 0,
      unstamped: totals.unstamped,
      aged: aged.length,
      movedByStatus,
      statuses: MOMENT_STATUSES.slice()
    },
    spaces: spaceBriefs,
    quietSpaces,
    people,
    views: { count: viewsCount, ownOpensExcluded },
    flags: flags.map((f, i) => ({ ...f, index: i + 1 })),
    unassigned: {
      orders: unassigned.orders,
      inKes: unassigned.inKes,
      evidenceIds: unassigned.evidenceIds,
      note: 'money no space claims, counted for the business only'
    }
  };
}

function expensesEverRecorded(spaceIds) {
  return store.all('spaceExpenses').some((e) => spaceIds.includes(e.spaceId));
}

/**
 * Activity rows, grouped by the actor the row already names.
 *
 * A name is printed only when a user row carries one. There is no team table
 * and no role attached to a space, so a person with no user row is reported as
 * an actor with `name: null` — never as an invented "Grace" — and no flag can
 * claim someone was expected and did not turn up, because nothing here knows who
 * was expected.
 */
function peopleFromActivity(rows, ownerId) {
  const byActor = new Map();
  for (const a of rows) {
    const who = a.actorId ?? 'unattributed';
    const bucket = byActor.get(who) ?? {
      actorId: a.actorId ?? null, name: null, isOwner: Boolean(a.actorId) && a.actorId === ownerId,
      actions: 0, lastAt: null, kinds: new Set()
    };
    bucket.actions++;
    bucket.kinds.add(a.kind);
    if (!bucket.lastAt || (a.createdAt ?? '') > bucket.lastAt) bucket.lastAt = a.createdAt ?? null;
    byActor.set(who, bucket);
  }
  const out = [];
  for (const bucket of byActor.values()) {
    if (bucket.actorId) {
      const user = store.find('users', (u) => u.id === bucket.actorId);
      bucket.name = user?.displayName || user?.handle || null;
    }
    out.push({
      actorId: bucket.actorId,
      name: bucket.name,
      isOwner: bucket.isOwner,
      actions: bucket.actions,
      lastAt: bucket.lastAt,
      lastClock: clockInEat(bucket.lastAt),
      kinds: Array.from(bucket.kinds).slice(0, 6)
    });
  }
  out.sort((a, b) => b.actions - a.actions || ((a.lastAt ?? '') < (b.lastAt ?? '') ? -1 : 1));
  return out;
}

/**
 * The shelf flag, built only from `stockChanges` rows (see stockLog.js).
 *
 * The formula the briefs keep asking for — `declared - sold < expectedRemaining`
 * — cannot be computed: `expectedRemaining` exists nowhere in this tree, and
 * neither does a waste log. This version needs no unknown:
 *
 *     start = the `from` of the day's first movement for that offer
 *     sold  = units the day's ORDERS took
 *     end   = the `to` of the day's last movement
 *     gap   = end - (start - sold)
 *
 * `gap > 0` is units appearing with no sale behind them; `gap < 0` is units
 * leaving beyond what was sold. Either way the rows say whose keystroke moved
 * the count and when, so the flag points at its own evidence instead of
 * accusing anybody. A genuine restock looks identical in these rows, because
 * there is no restock note to tell them apart — the message says that rather
 * than picking a side.
 */
function stockFlagsFor({ listings, movements, day, spaceNameById, ownerId }) {
  if (!listings.length || movements.size === 0) return [];
  const flags = [];
  for (const listing of listings) {
    const m = movements.get(listing.id);
    if (!m || m.sold <= 0) continue;
    if (m.startCount === null || m.endCount === null) continue;
    const allowed = m.startCount - m.sold;
    const gap = m.endCount - allowed;
    if (gap === 0) continue;                        // shelf and sales agree

    const editors = Array.from(new Set(m.edits.map((r) => r.actorId).filter(Boolean)));
    const editorLabel = editors.length === 1
      ? (editors[0] === ownerId ? 'you' : (store.find('users', (u) => u.id === editors[0])?.displayName ?? null))
      : null;
    const lastEdit = m.edits.length ? m.edits[m.edits.length - 1] : null;
    const when = lastEdit ? clockInEat(lastEdit.at) : null;
    const units = Math.abs(gap);
    const typed = editorLabel
      ? `the count was last typed by ${editorLabel}${when ? ` at ${when}` : ''}`
      : 'the count was re-typed by hand';
    const title = listing.title || 'an offer';
    flags.push({
      id: `stock:${listing.id}:${day}`,
      kind: 'stock_recount',
      listingId: listing.id,
      offerTitle: title,
      spaceName: listing.spaceId ? (spaceNameById.get(listing.spaceId) ?? null) : null,
      spaceId: listing.spaceId ?? null,
      direction: gap > 0 ? 'up' : 'down',
      message: gap > 0
        ? `${title}: ${m.sold} sold, and the count ended at ${m.endCount} where the sales leave ${allowed}`
        : `${title}: ${m.sold} sold, and the count ended at ${m.endCount} — ${units} below what the sales explain`,
      detail: `${units} unit${units === 1 ? '' : 's'} ${gap > 0
        ? 'appeared on the shelf that no sale put there'
        : 'left the shelf with no order behind them'}, ${typed}. A ${
        gap > 0 ? 'restock' : 'write-off'} looks exactly like this here, because nothing records which it was.`,
      counts: { start: m.startCount, sold: m.sold, allowed, end: m.endCount, gap },
      // The shelf rows are the evidence; the orders they came from are named
      // separately, so a tap can land on the sale rather than on a log line.
      evidenceIds: m.rows.map((r) => r.id),
      orderIds: m.sales.map((r) => r.orderId).filter(Boolean),
      action: { label: 'Open the catalog', surface: 'catalog' }
    });
  }
  return flags;
}

// ---------------------------------------------------------------------------
// THE MORNING DELIVERY — opt-in, at the hour the owner named, silent on a day
// with nothing to say.
//
// No hour is stored by default and nothing is sent to an owner who never asked.
// A daily ping at a time nobody chose is how a product gets uninstalled, and a
// row reading `hour: 6` that the owner never set would be the app claiming a
// preference on somebody's behalf.
// ---------------------------------------------------------------------------

function prefsRow(ownerId) {
  return store.find('shopBriefPrefs', (p) => p.ownerId === ownerId) ?? null;
}

export function getBriefPrefs(ownerId) {
  const row = prefsRow(ownerId);
  const hour = Number.isInteger(row?.hour) ? row.hour : null;
  return {
    ownerId,
    enabled: Boolean(row?.enabled),
    // null until saved: the control shows a suggested hour, the row does not.
    hour,
    hourLabel: hour === null ? null : `${String(hour).padStart(2, '0')}:00 in Nairobi time`,
    lastBriefDay: row?.lastBriefDay ?? null,
    hourNow: hourInEat(Date.now()),
    willSendToday: Boolean(row?.enabled) && hour !== null && hourInEat(Date.now()) >= hour
      && row.lastBriefDay !== todayKey(),
    note: 'one brief per day at most, and nothing is sent for a day with no rows',
    timeZone: 'Africa/Nairobi'
  };
}

export function setBriefPrefs(ownerId, { enabled = false, hour = null } = {}) {
  if (!ownerId) throw new Error('a brief preference needs an owner');
  const want = Boolean(enabled);
  let wantHour = null;
  if (want) {
    // `Number(null)` is 0, and 0 is a legal hour — so an absent hour must be
    // caught as absence before it can be read as midnight. A preference that
    // silently became 00:00 would notify an owner at an hour they never named.
    const given = hour === null || hour === undefined || hour === '' ? null : Number(hour);
    const h = given;
    if (!Number.isInteger(h) || h < HOUR_RANGE.min || h > HOUR_RANGE.max) {
      const e = new Error(`pick the hour you want it at, between ${HOUR_RANGE.min} and ${HOUR_RANGE.max} in Nairobi time — nothing is sent at a time you have not chosen`);
      e.status = 400;
      throw e;
    }
    wantHour = h;
  }
  const now = new Date().toISOString();
  const existing = prefsRow(ownerId);
  if (existing) {
    store.update('shopBriefPrefs', existing.id, { enabled: want, hour: wantHour, updatedAt: now });
  } else {
    store.insert('shopBriefPrefs', {
      id: newId('sbp'),
      ownerId,
      enabled: want,
      hour: wantHour,
      lastBriefDay: null,
      createdAt: now,
      updatedAt: now
    });
  }
  return getBriefPrefs(ownerId);
}

/** The words the notification carries — every figure read back off the brief. */
export function briefNotificationText(brief) {
  const lines = [
    `${formatKes(brief.money.inKes)} in · ${formatKes(brief.money.outKes)} out · ${formatKes(brief.money.netKes)} net`,
    `${brief.orders.marked} marked in · ${brief.orders.open} still open`
  ];
  if (brief.orders.aged > 0) {
    lines.push(`${brief.orders.aged} older order${brief.orders.aged === 1 ? '' : 's'} still open`);
  }
  if (brief.unassigned.orders > 0) {
    lines.push(`${formatKes(brief.unassigned.inKes)} belongs to no space`);
  }
  if (brief.flags.length > 0) {
    lines.push(`${brief.flags.length} flag${brief.flags.length === 1 ? '' : 's'} to read`);
  }
  return { title: `${brief.shop.name} · ${brief.dayLabel}`, body: lines.join('\n') };
}

/**
 * One pass for the whole deployment: for every owner who asked for a brief, at
 * or after the hour they named, at most once per day.
 *
 * A day is marked read whether or not it had anything in it: a quiet morning is
 * not retried into an evening notification. Anything recorded after the sweep —
 * an expense dated to yesterday, for instance — still shows in the app, because
 * the brief is a read over rows and not a saved report.
 */
export function morningSweep({ now = new Date() } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : (Date.parse(now) || Date.now());
  const today = dayBucket(nowMs);
  const hourNow = hourInEat(nowMs);
  const out = { looked: 0, sent: 0, quiet: 0, notYet: 0, blocked: 0 };

  for (const pref of store.all('shopBriefPrefs')) {
    if (!pref?.enabled || !pref.ownerId) continue;
    if (!Number.isInteger(pref.hour) || hourNow < pref.hour) { out.notYet++; continue; }
    if (pref.lastBriefDay === today) continue;
    out.looked++;

    const brief = shopBriefForOwner(pref.ownerId, { day: previousDay(today), now: nowMs });
    if (brief.empty) {
      store.update('shopBriefPrefs', pref.id, { lastBriefDay: today, updatedAt: new Date(nowMs).toISOString() });
      out.quiet++;
      continue;
    }
    const { title, body } = briefNotificationText(brief);
    const result = notify(pref.ownerId, {
      type: 'shop_brief',
      title,
      body,
      priority: brief.flags.length > 0 ? 'important' : 'normal',
      // Where tapping it goes: the street of the owner's own shopfronts, which
      // is the surface the brief is printed on. An unknown dest would be a dead
      // notification, so it names the target the shell already routes to.
      dest: 'shopbrief',
      dedupeKey: `shop_brief:${brief.shop.vendorId ?? pref.ownerId}:${brief.day}`,
      metadata: { day: brief.day, vendorId: brief.shop.vendorId, flags: brief.flags.length }
    });
    // `notify` answers null when the owner has switched the whole alerts
    // category off, and `{created:false}` when the day's line was already sent.
    // Neither counts as delivered, so the day is not marked read on their account.
    if (!result?.created) { out.blocked++; continue; }
    store.update('shopBriefPrefs', pref.id, { lastBriefDay: today, updatedAt: new Date(nowMs).toISOString() });
    out.sent++;
  }
  return out;
}

/** The same unref'd-timer discipline the calendar and workflow sweeps use. */
export function installSweep({ intervalMs = 15 * 60 * 1000 } = {}) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
  const timer = setInterval(() => {
    try { morningSweep(); } catch { /* a scheduler failure must not crash Brief */ }
  }, intervalMs);
  timer.unref?.();
  return timer;
}

export const __testing = { previousDay, hourInEat, moneyMoment, clockInEat, dayLabel };
