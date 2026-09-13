// ---------------------------------------------------------------------------
// EVENTS HUB (Tikiti T4)
//
// One honest browsing surface over the events that actually exist: published
// campaigns (with their types as categories) + calendar entries. It creates
// NO second event table -- a category is a campaign type, popularity is
// counted registrations, "featured" is an explicit organiser choice. Filters
// that match nothing return nothing, with counts the caller can trust.
//
// T4 detail model: the rich detail screen needs context that is DERIVED, never
// stored -- a host's other events, related events, and series occurrences are
// all scanned from real campaign rows on read. There is no `host` table, no
// `series` table, no `eventContext` cache. See `relatedEvents`,
// `hostEvents` and `seriesOccurrences` below.
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

// ---------------------------------------------------------------------------
// TABLE-BANKING OVERLAP (derived, per viewer)
//
// "3 from your Circle going" is computed by scanning the viewer's own groups
// against the registrations of the event. It is never stored and never seeded;
// an anonymous viewer (or a viewer in no group) gets null, because no overlap
// can be honestly computed.
// ---------------------------------------------------------------------------

/** tableBankingId -> Set(userId), built once for a viewer. Null when none. */
function tableBankingMemberIdsFor(viewerId) {
  if (!viewerId) return null;
  const map = new Map();
  for (const grp of store.filter('tableBanking', (c) => c.members.some((m) => m.userId === viewerId))) {
    map.set(grp.id, new Set((grp.members ?? []).map((m) => m.userId)));
  }
  return map.size > 0 ? map : null;
}

function overlapOf(campaignId, map) {
  if (!map) return null;
  const regs = store.filter('registrations', (r) => r.campaignId === campaignId && r.userId && r.status !== 'cancelled');
  const out = [];
  for (const [tableBankingId, memberSet] of map) {
    const count = regs.filter((r) => memberSet.has(r.userId)).length;
    if (count > 0) {
      const grp = store.find('tableBanking', (c) => c.id === tableBankingId);
      out.push({ tableBankingId, tableBankingName: grp?.name ?? null, memberCount: count });
    }
  }
  return out.length ? out : null;
}

/** The overlap for a single campaign, resolved from a server-derived viewer. */
export function tableBankingOverlapFor(campaignId, viewerId) {
  return overlapOf(campaignId, tableBankingMemberIdsFor(viewerId));
}

/**
 * The public listing identity of a campaign. This is the ONE shape a feed
 * card, a related-events rail and a host rail all share -- the internal id
 * never appears, and popularity is always a counted number.
 */
export function listingView(campaign) {
  return {
    slug: campaign.publicSlug,
    title: campaign.title,
    description: campaign.description ?? null,
    // A cover image is surfaced only when it actually exists; the client
    // derives a deterministic gradient fallback, never renders an empty box.
    coverImageUrl: campaign.metadata?.image ?? null,
    category: campaign.type,
    categoryLabel: CATEGORY_LABELS[campaign.type] ?? campaign.type,
    location: campaign.location ?? null,
    startsAt: campaign.startsAt ?? null,
    endsAt: campaign.endsAt ?? null,
    price: campaign.price,
    currency: campaign.currency,
    goalAmount: campaign.goalAmount ?? null,
    featured: campaign.metadata?.featured === true,
    popularity: registrationsOf(campaign.id),
    // No overlap here: it is a per-viewer fact, attached by the caller.
    tableBankingOverlap: null
  };
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

  // Table-banking overlap: the viewer's own groups, and how many of their
  // members have registered for each event. DERIVED by scanning real rows —
  // the viewer is resolved from the auth token server-side, never a client
  // claim. Anonymous viewers get null (no overlap can be honestly computed).
  const memberMap = tableBankingMemberIdsFor(viewerId);

  const views = rows.map((c) => ({ ...listingView(c), tableBankingOverlap: overlapOf(c.id, memberMap) }));

  if (sort === 'popularity') views.sort((a, b) => b.popularity - a.popularity);
  else views.sort((a, b) => String(a.startsAt ?? '9999').localeCompare(String(b.startsAt ?? '9999')));

  return { events: views.slice(0, Math.min(limit, 100)), total: views.length };
}

/**
 * RELATED EVENTS — derived, never seeded. A related event is one that shares
 * the event's category, or shares its exact location, and is itself public.
 * Empty when there genuinely are none.
 */
export function relatedEvents(campaign, limit = 6) {
  if (!campaign) return [];
  const same = (c) =>
    (c.status === 'published' || c.status === 'live') &&
    c.id !== campaign.id &&
    (c.type === campaign.type || (campaign.location != null && c.location === campaign.location));
  return store.filter('campaigns', same)
    .sort((a, b) => String(a.startsAt ?? '9999').localeCompare(String(b.startsAt ?? '9999')))
    .slice(0, limit)
    .map(listingView);
}

/**
 * MORE FROM THIS HOST — the organiser's other events (past and upcoming),
 * scanned from real campaign rows. Never includes the event itself, never a
 * fabricated host. Most recent first.
 */
export function hostEvents(ownerId, excludeId, limit = 6) {
  if (!ownerId) return [];
  return store.filter('campaigns', (c) =>
    c.ownerId === ownerId &&
    c.id !== excludeId &&
    ['published', 'live', 'closed', 'completed'].includes(c.status)
  )
    .sort((a, b) => String(b.startsAt ?? '').localeCompare(String(a.startsAt ?? '')))
    .slice(0, limit)
    .map(listingView);
}

/**
 * SERIES OCCURRENCES — the other instalments of a recurring series. Derived
 * from the `seriesId` an organiser sets; empty (honestly) until a series is
 * actually in use.
 */
export function seriesOccurrences(seriesId, excludeId, limit = 12) {
  if (!seriesId) return [];
  return store.filter('campaigns', (c) =>
    c.seriesId === seriesId &&
    c.id !== excludeId &&
    ['published', 'live', 'closed', 'completed'].includes(c.status)
  )
    .sort((a, b) => String(a.startsAt ?? '').localeCompare(String(b.startsAt ?? '')))
    .slice(0, limit)
    .map(listingView);
}

/** The organiser's explicit choice; never derived, never seeded. */
export function setFeatured(ownerId, campaignId, featured) {
  const c = store.find('campaigns', (x) => x.id === campaignId);
  if (!c) throw new Error('campaign not found');
  if (c.ownerId !== ownerId) throw new Error('only the organiser may feature their event');
  const meta = { ...(c.metadata ?? {}), featured: Boolean(featured) };
  return store.update('campaigns', campaignId, { metadata: meta });
}
