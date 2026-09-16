// ---------------------------------------------------------------------------
// SPACE AUDIENCE — followers, broadcasts, insights, templates.
//
// This is what turns a space from a report into a shopfront with a high
// street: people can follow it, the owner can tell them something, and both
// sides can see what actually happened afterwards.
//
// The honesty contract, stated because every one of these numbers is the kind
// a product is tempted to make up:
//
//   * FOLLOWERS are rows a person wrote by tapping follow on a PUBLIC space.
//     No follower is inferred, seeded, or "rounded to look alive". You cannot
//     follow a private or unlisted space, because an audience you cannot reach
//     is not an audience.
//   * VIEWS are rows written when a space's public page was really opened. The
//     owner's own opens are EXCLUDED from the count the owner is shown — your
//     peeking at your own shopfront is not demand — and the read says so. There
//     is no "142 people viewed this" unless 142 view rows exist.
//   * CONVERSION is arithmetic between two counts that exist. When the
//     denominator is zero it is null and the UI shows an em dash. A SECTOR
//     BENCHMARK is always null: Brief holds no industry averages, so
//     "(sector avg 3.4%)" would be a fabricated comparator, and this module
//     refuses to produce the field with a number in it.
//   * BROADCASTS expire. A 24-hour update is stored with its real expiry and
//     drops out of the live rail by itself, on read. Nothing "views this
//     story" is invented either: there is no story-view signal, so the read
//     reports who it was SENT to (notification rows that were actually created)
//     and says the rest is unknown rather than implied.
//   * TEMPLATES are the vendor's own words, stored per space, capped. They
//     prefill a message; they do not send anything on their own.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { emitSignal } from './signal.js';
import { notify } from './notifications.js';

const HOUR = 3600000;
const DAY = 24 * HOUR;

export const BROADCAST_TTL_HOURS = 24;
export const BROADCAST_KINDS = ['update', 'stock', 'hours', 'drop'];
export const TEMPLATE_MAX = 12;
export const FEATURED_MAX = 3;
export const INSIGHT_WINDOW_DAYS = 7;

const now = () => new Date().toISOString();
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const err = (message, status = 400) => ({ error: message, status });

const slugify = (value) =>
  clean(value, 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/**
 * The URL name. Derived from the space's own name, and made unique with a short
 * numeric tail when somebody already has it — never a random cute word that
 * implies a brand nobody chose. Written once, then stable: a link a vendor has
 * printed on a sticker must not change because they renamed the space.
 */
export function ensureSlug(space) {
  if (space.slug) return space.slug;
  const base = slugify(space.name) || 'space';
  let slug = base;
  let n = 1;
  while (store.find('spaces', (s) => s.slug === slug && s.id !== space.id)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  store.update('spaces', space.id, { slug });
  return slug;
}

// ---------------------------------------------------------------------------
// FOLLOWERS
// ---------------------------------------------------------------------------

export function followSpace(spaceId, viewerId) {
  if (!viewerId) return err('a session is required to follow a space', 401);
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) return err('space not found', 404);
  if (space.ownerId === viewerId) return err('this is your own space', 403);
  if (space.visibility !== 'public' || space.status !== 'active') {
    return err('only a public, active space can be followed', 409);
  }
  const existing = store.find('spaceFollowers', (f) => f.spaceId === spaceId && f.userId === viewerId);
  if (existing) return { following: true, reused: true, followers: followerCount(spaceId) };
  store.insert('spaceFollowers', {
    id: newId('spf'),
    spaceId,
    userId: viewerId,
    createdAt: now(),
    // Why they followed is not asked and not stored. A follow is a fact, not a
    // funnel stage, and inventing the reason would be the start of a scoreboard.
    via: null
  });
  return { following: true, reused: false, followers: followerCount(spaceId) };
}

export function unfollowSpace(spaceId, viewerId) {
  if (!viewerId) return err('a session is required', 401);
  const rows = store.filter('spaceFollowers', (f) => f.spaceId === spaceId && f.userId === viewerId);
  for (const r of rows) store.remove('spaceFollowers', r.id);
  return { following: false, removed: rows.length, followers: followerCount(spaceId) };
}

export function followerCount(spaceId) {
  return store.filter('spaceFollowers', (f) => f.spaceId === spaceId).length;
}

export function isFollowing(spaceId, viewerId) {
  if (!viewerId) return false;
  return Boolean(store.find('spaceFollowers', (f) => f.spaceId === spaceId && f.userId === viewerId));
}

/**
 * The spaces a person follows, as public cards. A follow they wrote is a fact
 * they may read back; nothing beyond the public projection is attached, so
 * this can never leak a private space's economics to a follower.
 */
export function followedSpaces(userId, { limit = 20 } = {}) {
  if (!userId) return [];
  const rows = store
    .filter('spaceFollowers', (f) => f.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
  const out = [];
  for (const f of rows) {
    const space = store.find('spaces', (x) => x.id === f.spaceId);
    if (!space) continue;
    // Unfollowed-by-deletion aside: a space that went private after you followed
    // it stops appearing here, rather than showing you a stale card.
    if (space.visibility !== 'public' || space.status !== 'active') continue;
    out.push({ followedAt: f.createdAt, space });
  }
  return out;
}

/** Who follows it — never exposed publicly. Only the owner may ask. */
export function followersOf(spaceId) {
  return store
    .filter('spaceFollowers', (f) => f.spaceId === spaceId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((f) => {
      const u = store.find('users', (x) => x.id === f.userId);
      return {
        userId: f.userId,
        displayName: u?.displayName ?? u?.handle ?? 'A follower',
        since: f.createdAt
      };
    });
}

// ---------------------------------------------------------------------------
// VIEWS — a row written when the public page was opened, or nothing
// ---------------------------------------------------------------------------

export function recordView(spaceId, { viewerId = null, ref = null } = {}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) return false;
  // A private space has no page to view; counting a fetch of its API row as a
  // "view" would be padding the number.
  if (space.visibility !== 'public' || space.status !== 'active') return false;
  emitSignal({
    type: 'space_viewed',
    actorId: viewerId,
    metadata: {
      spaceId,
      // A coarse reference for "how many distinct visitors", never an identity:
      // the same logic campaigns use for viewers.
      viewerRef: ref ? clean(ref, 64) : null
    }
  });
  return true;
}

/**
 * Views in a window, with the owner's own opens left out, plus the distinct
 * visitor count when the rows carried a reference. `viewers` is null rather
 * than 0 when no row had a reference — "we cannot tell" is the answer.
 */
export function viewsFor(spaceId, { windowDays = INSIGHT_WINDOW_DAYS, nowMs = Date.now(), excludeUserId = null } = {}) {
  const cutoff = nowMs - windowDays * DAY;
  const rows = store.filter('signals', (s) =>
    s.type === 'space_viewed' && s.metadata?.spaceId === spaceId && Date.parse(s.createdAt ?? '') >= cutoff);
  const mine = excludeUserId ? rows.filter((s) => s.actorId !== excludeUserId) : rows;
  const refs = new Set(mine.map((s) => s.metadata?.viewerRef).filter(Boolean));
  return {
    views: mine.length,
    ownViewsExcluded: rows.length - mine.length,
    viewers: refs.size > 0 ? refs.size : null,
    since: new Date(cutoff).toISOString()
  };
}

// ---------------------------------------------------------------------------
// BROADCASTS — the 24-hour update, with real delivery facts
// ---------------------------------------------------------------------------

/**
 * Post an update to the space's followers. The text is the vendor's; the expiry
 * is a real timestamp the read respects; the fan-out counts notification rows
 * that were actually created. No SMS, no WhatsApp — none is wired.
 */
export function postBroadcast(spaceId, { actorId, text, kind = 'update' } = {}) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) return err('space not found', 404);
  if (actorId && space.ownerId !== actorId) return err('only the owner can broadcast from this space', 403);
  const body = clean(text, 280);
  if (body.length < 3) return err('say something your followers can act on');
  if (!BROADCAST_KINDS.includes(kind)) return err(`kind must be one of ${BROADCAST_KINDS.join(', ')}`);

  const at = now();
  const row = store.insert('spaceBroadcasts', {
    id: newId('spb'),
    spaceId,
    kind,
    text: body,
    createdAt: at,
    expiresAt: new Date(Date.now() + BROADCAST_TTL_HOURS * HOUR).toISOString(),
    deletedAt: null
  });

  const audience = store.filter('spaceFollowers', (f) => f.spaceId === spaceId);
  let delivered = 0;
  let muted = 0;
  for (const f of audience) {
    const n = notifyQuiet(f.userId, {
      type: 'broadcast',
      title: `${space.name}: ${kindLabel(kind)}`,
      body,
      priority: 'normal',
      dedupeKey: `broadcast:${row.id}:${f.userId}`,
      metadata: { spaceId, broadcastId: row.id, kind }
    });
    if (n) delivered++;
    else muted++;
  }

  return {
    broadcast: row,
    delivery: {
      audience: audience.length,
      notified: delivered,
      mutedByPreference: muted,
      channels: { inApp: 'created', sms: 'not_configured', whatsapp: 'not_configured' },
      note: audience.length === 0
        ? 'Nobody follows this space yet, so nothing was sent. A broadcast reaches followers, not an imagined crowd.'
        : `An in-app notification was created for ${delivered} follower${delivered === 1 ? '' : 's'}. No read receipt exists, so how many opened it is not known.`
    }
  };
}

function kindLabel(kind) {
  return { update: 'an update', stock: 'stock news', hours: 'a change of hours', drop: 'a drop' }[kind] ?? 'an update';
}

/** Live by default: an expired broadcast is history, not a story ring. */
export function broadcastsFor(spaceId, { nowMs = Date.now(), includeExpired = false } = {}) {
  return store
    .filter('spaceBroadcasts', (b) => b.spaceId === spaceId && !b.deletedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((b) => ({ ...b, live: Date.parse(b.expiresAt) > nowMs }))
    .filter((b) => includeExpired || b.live);
}

export function deleteBroadcast(broadcastId, { actorId } = {}) {
  const row = store.find('spaceBroadcasts', (b) => b.id === broadcastId);
  if (!row) return err('broadcast not found', 404);
  const space = store.find('spaces', (s) => s.id === row.spaceId);
  if (actorId && space && space.ownerId !== actorId) return err('only the owner can remove that update', 403);
  store.update('spaceBroadcasts', broadcastId, { deletedAt: now() });
  return { removed: true, id: broadcastId };
}

// ---------------------------------------------------------------------------
// TEMPLATES — the vendor's own repeated sentences
// ---------------------------------------------------------------------------

export function templatesFor(spaceId) {
  return store
    .filter('spaceTemplates', (t) => t.spaceId === spaceId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export function createTemplate(spaceId, { actorId, label, body }) {
  const space = store.find('spaces', (s) => s.id === spaceId);
  if (!space) return err('space not found', 404);
  if (actorId && space.ownerId !== actorId) return err('only the owner can add templates here', 403);
  const l = clean(label, 40);
  const b = clean(body, 300);
  if (!l) return err('a template needs a short label');
  if (b.length < 4) return err('a template needs the message itself');
  if (templatesFor(spaceId).length >= TEMPLATE_MAX) return err(`${TEMPLATE_MAX} templates is the cap — keep them useful`);
  return { template: store.insert('spaceTemplates', { id: newId('spt'), spaceId, label: l, body: b, createdAt: now(), updatedAt: now() }) };
}

export function updateTemplate(templateId, { actorId, label, body }) {
  const row = store.find('spaceTemplates', (t) => t.id === templateId);
  if (!row) return err('template not found', 404);
  const space = store.find('spaces', (s) => s.id === row.spaceId);
  if (actorId && space && space.ownerId !== actorId) return err('only the owner can edit that template', 403);
  const patch = {};
  if (label !== undefined) {
    const l = clean(label, 40);
    if (!l) return err('a template needs a short label');
    patch.label = l;
  }
  if (body !== undefined) {
    const b = clean(body, 300);
    if (b.length < 4) return err('a template needs the message itself');
    patch.body = b;
  }
  patch.updatedAt = now();
  return { template: store.update('spaceTemplates', templateId, patch) };
}

export function deleteTemplate(templateId, { actorId } = {}) {
  const row = store.find('spaceTemplates', (t) => t.id === templateId);
  if (!row) return err('template not found', 404);
  const space = store.find('spaces', (s) => s.id === row.spaceId);
  if (actorId && space && space.ownerId !== actorId) return err('only the owner can remove that template', 403);
  store.remove('spaceTemplates', row.id);
  return { removed: true, id: row.id };
}

// ---------------------------------------------------------------------------
// INSIGHTS — operational, not vanity, and silent where there is no row
// ---------------------------------------------------------------------------

const sumMoney = (rows) => {
  const currencies = new Set(rows.map((o) => o.currency).filter(Boolean));
  const value = rows.reduce((n, o) => n + (Number(o.total) || 0), 0);
  return { value, currency: currencies.size === 1 ? [...currencies][0] : null };
};

/**
 * Every figure below is a count over rows in the window, with the window and
 * the sample size attached so a vendor can check it. Anything Brief cannot
 * measure is null, and the read states what it deliberately does not have:
 * no sector benchmark, no "buyers you missed", no profile-viewer identity.
 */
export function insightsFor(space, { nowMs = Date.now(), windowDays = INSIGHT_WINDOW_DAYS } = {}) {
  const cutoff = nowMs - windowDays * DAY;
  const inWindow = (v) => Date.parse(v ?? '') >= cutoff;
  const since = new Date(cutoff).toISOString();

  const conversations = store.filter('spaceConversations', (c) => c.spaceId === space.id && inWindow(c.createdAt));
  const openInquiries = store.filter('spaceConversations', (c) =>
    c.spaceId === space.id && ['new', 'active', 'replied'].includes(c.status));
  const orders = store.filter('orders', (o) =>
    (o.spaceId === space.id || o.vendorId === space.vendorId) && inWindow(o.createdAt));
  const settled = store.filter('orders', (o) =>
    (o.spaceId === space.id || o.vendorId === space.vendorId) && o.status === 'settled');
  const views = viewsFor(space.id, { windowDays, nowMs, excludeUserId: space.ownerId });
  const followers = store.filter('spaceFollowers', (f) => f.spaceId === space.id);
  const newFollowers = followers.filter((f) => inWindow(f.createdAt));
  const broadcasts = broadcastsFor(space.id, { nowMs });
  const moneyTaken = sumMoney(settled);

  // Conversion is only ever the ratio of two counts that exist.
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  const totalFollowers = followers.length;
  const delivered = store
    .filter('spaceBroadcasts', (b) => b.spaceId === space.id && inWindow(b.createdAt))
    .map((b) => b.id);
  const notified = delivered.length
    ? store.filter('notifications', (n) => n.metadata?.spaceId === space.id && n.metadata?.broadcastId && inWindow(n.createdAt ?? n.readAt ?? '')).length
    : 0;

  return {
    windowDays,
    since,
    views: { count: views.views, distinctViewers: views.viewers, ownOpensExcluded: views.ownViewsExcluded },
    follows: { newInWindow: newFollowers.length, total: totalFollowers },
    inquiries: { newInWindow: conversations.length, awaitingYourReply: openInquiries.length },
    orders: { newInWindow: orders.length, total: store.filter('orders', (o) => o.spaceId === space.id || o.vendorId === space.vendorId).length },
    takeHome: { value: moneyTaken.value, currency: moneyTaken.currency },
    conversion: {
      viewsToOrdersPct: pct(orders.length, views.views),
      inquiriesToOrdersPct: pct(orders.length, conversations.length),
      note: 'A ratio of two counts on this screen. It is null when the denominator has no rows.'
    },
    broadcasts: { liveNow: broadcasts.length, sentInWindow: delivered.length, notificationsCreated: notified },
    // Always absent, by rule: Brief holds no industry averages, so a comparator
    // here would be an invented number wearing somebody else\u2019s authority.
    benchmark: null,
    unavailable: [
      'sector or category averages — no such data exists in Brief',
      'buyers who looked and left — there is no per-view browse log to count',
      'who viewed your space — view rows carry no identity'
    ],
    note: 'Derived from rows in the window. A count of zero means no rows; an em dash means nothing measurable exists yet.'
  };
}

/** Everything the owner's audience panel needs, in one read. */
export function audienceView(space, { viewerId = null, nowMs = Date.now() } = {}) {
  return {
    slug: ensureSlug(space),
    followers: followerCount(space.id),
    followerList: space.ownerId === viewerId ? followersOf(space.id) : [],
    iAmFollowing: isFollowing(space.id, viewerId),
    broadcasts: broadcastsFor(space.id, { nowMs }),
    pastBroadcasts: store.filter('spaceBroadcasts', (b) => b.spaceId === space.id && !b.deletedAt && Date.parse(b.expiresAt) <= nowMs).length,
    templates: templatesFor(space.id),
    insights: insightsFor(space, { nowMs }),
    canManage: Boolean(viewerId) && space.ownerId === viewerId,
    followable: space.visibility === 'public' && space.status === 'active' && space.ownerId !== viewerId
  };
}

/** The public page's extra facts: what a stranger may see, and nothing else. */
export function publicExtras(space) {
  return {
    slug: ensureSlug(space),
    followers: followerCount(space.id),
    broadcasts: broadcastsFor(space.id),
    templates: undefined // never part of a stranger's view
  };
}

function notifyQuiet(userId, opts) {
  try {
    return notify(userId, opts);
  } catch {
    return null;
  }
}

