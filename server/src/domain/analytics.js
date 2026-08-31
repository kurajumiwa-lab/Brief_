// ---------------------------------------------------------------------------
// ANALYTICS — product intelligence, derived from real rows
//
// Answers "what makes users come back?" with numbers that are DERIVED from the
// store and the signal log, never from a stored counter or a guessed funnel.
//
//   ACTIVATION  — first location selection, first save, first contribution,
//                 first Arena interaction, per user, from recorded signals.
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
    firstArena: distinctActors('arena_challenge_opened'),
    firstArenaBeta: distinctActors('arena_beta_joined')
  };
}

function engagementCounts() {
  return {
    views: signalMeta('object_viewed').length,
    saves: signalMeta('object_saved').length,
    shares: signalMeta('object_shared').length,
    betaSignups: signalMeta('arena_beta_joined').length,
    challengesCreated: signalMeta('arena_challenge_opened').length,
    matchesCompleted: signalMeta('arena_result_confirmed').length,
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

export function dashboard() {
  return {
    activation: activationEvents(),
    engagement: engagementCounts(),
    retention: retention(),
    quality: quality(),
    // Collection sizes, so the operator sees the system is alive.
    counts: {
      users: store.all('users').length,
      objects: store.all('objects').length,
      campaigns: store.all('campaigns').length,
      banners: store.all('campaignBanners').length,
      vaults: store.all('vaults').length,
      betaSignups: store.all('arenaBetaSignups').length,
      challenges: store.all('arenaChallenges').length,
      matches: store.all('arenaMatches').length,
      notifications: store.all('notifications').length
    }
  };
}
