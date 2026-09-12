// ---------------------------------------------------------------------------
// EVENTS HUB (Tikiti T4)
//
// One honest browsing surface over the events that actually exist: published
// campaigns (with their types as categories) + calendar entries. It creates
// NO second event table -- a category is a campaign type, popularity is
// counted registrations, "featured" is an explicit organiser choice. Filters
// that match nothing return nothing, with counts the caller can trust.
// ---------------------------------------------------------------------------

import { store } from '../store.js';

export const EVENT_CATEGORIES = ['popup', 'session', 'drop', 'event', 'contribution'];

export const CATEGORY_LABELS = {
  popup: 'Popups & markets',
  session: 'Sessions & classes',
  drop: 'Drops',
  event: 'Events',
  contribution: 'Causes & pots'
};

function registrationsOf(campaignId) {
  return store.filter('registrations', (r) => r.campaignId === campaignId && r.status !== 'cancelled').length;
}

/**
 * Browse events. Filters: category (campaign type), location (substring,
 * case-insensitive), from/to (date window on startsAt), featured only.
 * Sort: 'popularity' (registrations) or 'date' (soonest first).
 */
export function browseEvents({
  category = null,
  location = null,
  from = null,
  to = null,
  featured = null,
  sort = 'date',
  limit = 50,
  viewerId = null
} = {}) {
  if (category != null && !EVENT_CATEGORIES.includes(category)) {
    throw new Error(`category must be one of ${EVENT_CATEGORIES.join(', ')}`);
  }
  let rows = store.filter('campaigns', (c) => c.status === 'published' || c.status === 'live');

  if (category != null) rows = rows.filter((c) => c.type === category);
  if (location != null) {
    const needle = String(location).trim().toLowerCase();
    rows = rows.filter((c) => String(c.location ?? '').toLowerCase().includes(needle));
  }
  if (from != null) {
    const t = Date.parse(from);
    if (Number.isFinite(t)) rows = rows.filter((c) => !c.startsAt || Date.parse(c.startsAt) >= t);
  }
  if (to != null) {
    const t = Date.parse(to);
    if (Number.isFinite(t)) rows = rows.filter((c) => !c.startsAt || Date.parse(c.startsAt) <= t);
  }
  if (featured === true) rows = rows.filter((c) => c.metadata?.featured === true);

  // Chama overlap: the viewer's own groups, and how many of their members have
  // registered for each event. DERIVED by scanning real rows — the viewer is
  // resolved from the auth token server-side, never a client claim. Anonymous
  // viewers get null (no overlap can be honestly computed).
  const chamaMemberIds = new Map(); // chamaId -> Set(userId)
  if (viewerId) {
    for (const ch of store.filter('chamas', (c) => c.members.some((m) => m.userId === viewerId))) {
      chamaMemberIds.set(ch.id, new Set((ch.members ?? []).map((m) => m.userId)));
    }
  }
  function overlapOf(campaign) {
    if (!viewerId || chamaMemberIds.size === 0) return null;
    const regs = store.filter('registrations', (r) => r.campaignId === campaign.id && r.userId && r.status !== 'cancelled');
    const out = [];
    for (const [chamaId, memberSet] of chamaMemberIds) {
      const count = regs.filter((r) => memberSet.has(r.userId)).length;
      if (count > 0) {
        const chama = store.find('chamas', (c) => c.id === chamaId);
        out.push({ chamaId, chamaName: chama?.name ?? null, memberCount: count });
      }
    }
    return out.length ? out : null;
  }

  const views = rows.map((c) => ({
    // The public identity of an event is its slug; internal ids stay private.
    slug: c.publicSlug,
    title: c.title,
    description: c.description ?? null,
    // A cover image is surfaced only when it actually exists; the client
    // derives a deterministic gradient fallback, never renders an empty box.
    coverImageUrl: c.metadata?.image ?? null,
    category: c.type,
    categoryLabel: CATEGORY_LABELS[c.type] ?? c.type,
    location: c.location ?? null,
    startsAt: c.startsAt ?? null,
    endsAt: c.endsAt ?? null,
    price: c.price,
    currency: c.currency,
    goalAmount: c.goalAmount ?? null,
    featured: c.metadata?.featured === true,
    // Popularity is COUNTED people, never a seeded number.
    popularity: registrationsOf(c.id),
    // "N from your chama" — derived, per-viewer, null when anonymous or none.
    chamaOverlap: overlapOf(c)
  }));

  if (sort === 'popularity') views.sort((a, b) => b.popularity - a.popularity);
  else views.sort((a, b) => String(a.startsAt ?? '9999').localeCompare(String(b.startsAt ?? '9999')));

  return { events: views.slice(0, Math.min(limit, 100)), total: views.length };
}

/** The organiser's explicit choice; never derived, never seeded. */
export function setFeatured(ownerId, campaignId, featured) {
  const c = store.find('campaigns', (x) => x.id === campaignId);
  if (!c) throw new Error('campaign not found');
  if (c.ownerId !== ownerId) throw new Error('only the organiser may feature their event');
  const meta = { ...(c.metadata ?? {}), featured: Boolean(featured) };
  return store.update('campaigns', campaignId, { metadata: meta });
}
