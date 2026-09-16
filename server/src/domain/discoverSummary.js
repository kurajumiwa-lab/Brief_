// ---------------------------------------------------------------------------
// DISCOVER SUMMARY — the tiles' counts and the one thing worth a big card.
//
// Why this exists: the layout it feeds was previously a mock. The old
// screens (preview/src/screens/DiscoverScreen.tsx) shipped a hardcoded
// INITIAL_DISCOVER_POSTS array — "Kilimani Weekend Creators Market… Over 40
// verified creative vendors", an Unsplash photo of somebody else's market, a
// phone number that belongs to no one and a Telegram handle nobody runs. It
// looked full because it was fiction, and it was never reachable from the
// production entry (main.jsx mounts AppShell, not that shell).
//
// So this module supplies the same SHAPE from rows only:
//   * a tile's number is a count of rows that exist, and a zero is printed as a
//     zero — an empty Marketplace is a true fact about a young network, not a
//     bug to paper over;
//   * the featured slot is chosen by a stated rule, applied in order, and the
//     card says which rule fired. Not "highest-value" (that would be a price
//     judgement we have no right to make) but:
//       1. the seller pinned it to the front of their counter,
//       2. otherwise the active listing with the most SETTLED orders,
//       3. otherwise the newest active listing,
//       4. otherwise a published event with counted registrations,
//       5. otherwise nothing — and the client shows an honest empty hero.
//   * there is no "verified" badge here, because Brief verifies identity for
//     payment/compliance rails and nothing about a market stall's vibe;
//   * no refresh timer is implied: the read is a snapshot, stamped with the
//     newest row time it actually saw.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { listListings } from './listing.js';
import { browseEvents } from './events.js';
import { listCircles } from './circle.js';

const HOUR = 3600000;

/** A listing's own photo, resolved the way the media rail serves them. */
function mediaUrl(listing) {
  const first = (listing.media ?? [])[0] ?? listing.image ?? null;
  if (!first) return null;
  return /^https?:\/\//.test(first) || String(first).startsWith('/api/')
    ? String(first)
    : `/api/media/file/${first}`;
}

function newestTimestamp(values) {
  let best = null;
  for (const v of values) {
    const ms = Date.parse(v ?? '');
    if (Number.isFinite(ms) && (best === null || ms > best)) best = ms;
  }
  return best === null ? null : new Date(best).toISOString();
}

export function discoverSummary({ viewerId = null, now = Date.now() } = {}) {
  const listings = listListings({ status: 'active', limit: 200 });

  // Only spaces the owner pinned AND that are still active here. A pin pointing
  // at an archived offer is not promoted by a stale preference.
  const pinnedIds = new Set();
  for (const space of store.filter('spaces', (s) => s.status === 'active' && Array.isArray(s.featured))) {
    for (const id of space.featured) pinnedIds.add(id);
  }

  const settledCount = (listingId) =>
    store.filter('orders', (o) => o.listingId === listingId && o.status === 'settled').length;

  const picked =
    listings.find((l) => pinnedIds.has(l.id))
      ?? [...listings]
        .map((l) => ({ l, n: settledCount(l.id) }))
        .sort((a, b) => b.n - a.n || (a.l.createdAt < b.l.createdAt ? 1 : -1))
        .find((x) => x.n > 0)?.l
      ?? listings[0]
      ?? null;

  const events = browseEvents({ limit: 100, sort: 'date', viewerId });
  const circles = listCircles(viewerId);
  const joinable = circles.filter((c) => c.canJoin).length;
  const openErrands = store.filter('errands', (e) => e.status === 'open').length;

  let featured = null;
  let featuredFrom = null;

  if (picked) {
    const orders = settledCount(picked.id);
    const byPin = pinnedIds.has(picked.id);
    featured = {
      kind: 'listing',
      id: picked.id,
      title: picked.title,
      description: picked.description ?? null,
      price: picked.price,
      currency: picked.currency ?? 'KES',
      type: picked.type ?? 'product',
      location: picked.locationName ?? picked.vendor?.location ?? null,
      mediaUrl: mediaUrl(picked),
      seller: picked.vendor?.displayName ?? null,
      stock: picked.quantityAvailable ?? null,
      interest: { label: 'settled orders', count: orders },
      // The rule is printed on the card, so "featured" is never a mystery or a
      // claim about quality.
      why: byPin
        ? 'pinned by the seller'
        : orders > 0
          ? `${orders} settled order${orders === 1 ? '' : 's'} — the most on the board`
          : 'the newest listing, nothing has settled yet'
    };
    featuredFrom = byPin ? 'seller-pin' : orders > 0 ? 'settled-orders' : 'newest';
  } else if ((events.events ?? []).length > 0) {
    const e = [...events.events].sort((a, b) => b.popularity - a.popularity || (a.startsAt < b.startsAt ? -1 : 1))[0];
    featured = {
      kind: 'event',
      id: e.slug,
      title: e.title,
      description: e.description ?? null,
      price: e.price,
      currency: e.currency ?? 'KES',
      location: e.location ?? null,
      startsAt: e.startsAt ?? null,
      mediaUrl: e.coverImageUrl ?? null,
      interest: { label: 'registrations', count: e.popularity },
      why: e.popularity > 0
        ? `${e.popularity} registered — the busiest thing on`
        : 'the soonest event, nobody has registered yet',
      group: (e.tableBankingOverlap ?? [])[0]?.memberCount
        ? `${e.tableBankingOverlap[0].memberCount} from ${e.tableBankingOverlap[0].tableBankingName ?? 'your circle'}`
        : null
    };
    featuredFrom = e.popularity > 0 ? 'registrations' : 'soonest';
  }

  const tiles = [
    { key: 'marketplace', label: 'Marketplace', count: listings.length, unit: 'live offer' },
    { key: 'events', label: 'Events', count: (events.total ?? events.events?.length) ?? 0, unit: 'published' },
    { key: 'circles', label: 'Circles', count: joinable, unit: 'you could join' },
    { key: 'errands', label: 'Errands', count: openErrands, unit: 'open' }
  ];

  return {
    tiles,
    featured,
    featuredFrom,
    counts: {
      listings: listings.length,
      events: events.total ?? (events.events ?? []).length,
      circles: joinable,
      errands: openErrands
    },
    asOf: newestTimestamp([
      ...listings.map((l) => l.updatedAt ?? l.createdAt),
      ...(events.events ?? []).map((e) => e.publishedAt ?? e.startsAt),
      ...store.all('errands').map((e) => e.updatedAt ?? e.createdAt)
    ]),
    note:
      'Every number here is a count of rows, computed on read. A zero is shown as a zero: nothing is seeded, no "verified" badge is attached to a '
      + 'seller, and no popularity is implied without a registrations or orders row behind it. This is a snapshot with the newest row time stamped on it, '
      + 'not a live feed — there is no socket and none is claimed.'
  };
}
