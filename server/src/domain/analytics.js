// ---------------------------------------------------------------------------
// ANALYTICS — product intelligence, derived from real rows
//
// Answers "what makes users come back?" with numbers that are DERIVED from the
// store and the signal log, never from a stored counter or a guessed funnel.
//
//   ACTIVATION  — first location selection, first save, first contribution,
//   ENGAGEMENT  — views / saves / shares / challenges / matches, aggregated.
//   RETENTION   — returning users (repeat actors) and location revisits.
//   QUALITY     — verification rate, confirmation rate, open reports.
//
// Everything here is a scan. There is no analytics table and no event dropped
// just to make a dashboard look active.
// ---------------------------------------------------------------------------

import { store } from '../store.js';

const signalMeta = (type) => store.filter('signals', (s) => s.type === type);

function distinctActors(type) {
  return new Set(signalMeta(type).map((s) => s.actorId).filter(Boolean)).size;
}

function activationEvents() {
  return {
    firstView: distinctActors('object_viewed'),
    firstSave: distinctActors('object_saved'),
    firstContribution: distinctActors('object_created'),
  };
}

function engagementCounts() {
  return {
    views: signalMeta('object_viewed').length,
    saves: signalMeta('object_saved').length,
    shares: signalMeta('object_shared').length,
    // Entity layer: exactly the five tracked acts from the following brief —
    // viewed, followed, unfollowed, entity object opened, source opened.
    entityViews: signalMeta('entity_viewed').length,
    entityFollows: signalMeta('entity_followed').length,
    entityUnfollows: signalMeta('entity_unfollowed').length,
    entityObjectOpens: signalMeta('entity_object_opened').length,
    sourceOpens: signalMeta('source_opened').length,
    // Collections layer: the five tracked acts from the collections brief —
    // created, opened, shared, item removed, plus saves (already counted
    // above as `saves`). No extra personal data is collected.
    collectionsCreated: signalMeta('collection_created').length,
    collectionsOpened: signalMeta('collection_opened').length,
    collectionsShared: signalMeta('collection_shared').length,
    collectionItemsRemoved: signalMeta('collection_item_removed').length,
    // Notifications: the four tracked acts from the return-loop brief. The
    // notification count itself lives in `counts` below; these are events.
    notificationsGenerated: signalMeta('notification_generated').length,
    notificationsOpened: signalMeta('notification_opened').length,
    notificationsRead: signalMeta('notification_marked_read').length,
    notificationPrefChanges: signalMeta('notification_pref_changed').length
  };
}

function retention() {
  // Returning users: actors with more than one distinct day of activity.
  const byActor = {};
  for (const s of store.all('signals')) {
    if (!s.actorId) continue;
    const day = String(s.createdAt).slice(0, 10);
    (byActor[s.actorId] ??= new Set()).add(day);
  }
  const returning = Object.values(byActor).filter((days) => days.size > 1).length;
  return { returning, activeUsers: Object.keys(byActor).length };
}

function quality() {
  const objects = store.all('objects').filter((o) => o.publication !== 'removed');
  const verified = objects.filter((o) => o.verificationStatus !== 'unverified').length;
  const confirmed = store.filter('confirmations', () => true).length;
  const openReports = store.filter('reports', (r) => r.status === 'open').length;
  return {
    objectCount: objects.length,
    verificationRate: objects.length ? verified / objects.length : null,
    confirmations: confirmed,
    openReports
  };
}

/**
 * SPACE HEALTH — the activation number the operator watches.
 *
 * "A space is activated when it has at least one offer." Derived by scanning
 * spaces against their linked listings (the SAME predicate hydrateSpace uses:
 * a listing belongs to a space by `spaceId` OR the space's vendor, and is not
 * archived). "Activated within 7 days" is the headline: the earliest offer's
 * createdAt sits inside the space's first week.
 *
 * Every figure is a scan of real rows — no stored counter, no guessed funnel.
 * Rates are null (not 0) when there are no spaces to measure, because an
 * unmeasured rate and a measured zero are different facts.
 */
function spaceHealth() {
  const spaces = store.all('spaces');
  const active = spaces.filter((s) => s.status === 'active');

  // "A space added an offer" means the space itself created it — which is the
  // only thing `spaceId` records. The `vendorId` fallback would let SIBLING
  // spaces (which share one vendor) claim each other's offers, double-counting
  // activation. Activation is precise: offers with spaceId === this space.
  const offersOf = (space) => store.filter('listings', (l) =>
    l.spaceId === space.id && l.status !== 'archived');

  const withOffer = active.filter((s) => offersOf(s).length > 0);
  const withOrder = active.filter((s) =>
    store.filter('orders', (o) => o.spaceId === s.id).length > 0);

  const activatedWithin7d = withOffer.filter((s) => {
    const earliest = offersOf(s).reduce(
      (min, o) => (o.createdAt < min ? o.createdAt : min),
      '9999-12-31T00:00:00.000Z'
    );
    const created = Date.parse(s.createdAt);
    const offerAt = Date.parse(earliest);
    // A space with no offer never reaches here (withOffer already filtered);
    // the guard just makes the arithmetic robust.
    return Number.isFinite(created) && Number.isFinite(offerAt)
      ? offerAt - created <= 7 * 86400000
      : false;
  });

  return {
    total: spaces.length,
    active: active.length,
    public: active.filter((s) => s.visibility === 'public').length,
    // THE activation metric: how many active spaces have ≥1 offer.
    withOffer: withOffer.length,
    activationRate: active.length ? withOffer.length / active.length : null,
    // The doc's headline: % that activated within their first week.
    activatedWithin7d: activatedWithin7d.length,
    activationRate7d: active.length ? activatedWithin7d.length / active.length : null,
    // Economic activity: spaces with ≥1 order.
    withOrder: withOrder.length,
    economicRate: active.length ? withOrder.length / active.length : null
  };
}

export function dashboard() {
  return {
    activation: activationEvents(),
    engagement: engagementCounts(),
    retention: retention(),
    quality: quality(),
    spaces: spaceHealth(),
    // Collection sizes, so the operator sees the system is alive.
    counts: {
      users: store.all('users').length,
      objects: store.all('objects').length,
      campaigns: store.all('campaigns').length,
      banners: store.all('campaignBanners').length,
      vaults: store.all('vaults').length,
      notifications: store.all('notifications').length
    }
  };
}
