// ---------------------------------------------------------------------------
// BRIEF ROUTER — one place that names every screen.
//
// Destinations stay four rooms. Overlays (menu, capture, object, tea,
// campaign) sit on the query string or a dedicated path so Android / Telegram
// back can close them without inventing a fifth tab.
//
// This module is pure. No React, no fetch, no window.
// ---------------------------------------------------------------------------

export type Destination = 'nearby' | 'arena' | 'mylayer' | 'workflows';

export type NearbySection = 'stream' | 'tea' | 'today' | 'pursuits' | 'quests' | 'market' | 'events' | 'mshikano';
export type MyLayerSection =
  | 'saved' | 'activity' | 'arena' | 'points' | 'circles' | 'groups' | 'campaigns'
  | 'mediakit' | 'opportunities' | 'messages' | 'subscriptions' | 'tickets'
  | 'verification';
export type WorkflowSection =
  | 'cockpit' | 'command' | 'active' | 'completed' | 'inbox'
  | 'sources' | 'money' | 'vault' | 'gate' | 'tea'
  | 'campaigns' | 'matches' | 'distribution' | 'calendar' | 'vendors' | 'shop' | 'ai' | 'engine'
  | 'groupbuy' | 'resale' | 'fees';
export type ArenaSection = 'lobby' | 'epl' | 'challenges' | 'tournaments' | 'leaderboard';

export type BriefRoute = {
  dest: Destination;
  nearby: NearbySection;
  mylayer: MyLayerSection;
  workflow: WorkflowSection;
  arena: ArenaSection;
  objectId: string | null;
  teaSlug: string | null;
  campaignId: string | null;
  /** A followable entity (venue/business/publisher/organizer/community) page. */
  entityId: string | null;
  /** A public location discovery page (/explore/kilimani). */
  locationName: string | null;
  /** A shared personal collection page (/collections/:id). */
  collectionId: string | null;
  capture: boolean;
  menu: boolean;
  /** The Following surface overlay (feed + follow management). */
  following: boolean;
  /** The personal Collections surface overlay. */
  collections: boolean;
  /** Operator desk overlay (F4) — not a consumer destination. */
  admin: boolean;
  /** True when the user landed on this URL (share / reload), not via in-app push. */
  landed: boolean;
};

export const DEFAULT_ROUTE: BriefRoute = {
  dest: 'nearby',
  nearby: 'stream',
  mylayer: 'saved',
  workflow: 'active',
  arena: 'lobby',
  objectId: null,
  teaSlug: null,
  campaignId: null,
  entityId: null,
  locationName: null,
  collectionId: null,
  capture: false,
  menu: false,
  following: false,
  collections: false,
  admin: false,
  landed: false
};

const NEARBY: NearbySection[] = ['stream', 'tea', 'today', 'pursuits', 'quests', 'market', 'events', 'mshikano'];
const MYLAYER: MyLayerSection[] = [
  'saved', 'activity', 'arena', 'points', 'circles', 'groups', 'campaigns',
  'mediakit', 'opportunities', 'messages', 'subscriptions', 'verification'
];
const WORKFLOW: WorkflowSection[] = [
  'cockpit', 'command', 'active', 'completed', 'inbox',
  'sources', 'money', 'vault', 'gate', 'tea',
  'campaigns', 'matches', 'distribution', 'calendar', 'vendors', 'shop', 'ai', 'engine', 'groupbuy', 'fees'
];
const ARENA: ArenaSection[] = ['lobby', 'epl', 'challenges', 'tournaments', 'leaderboard'];

function isOne<T extends string>(list: T[], value: string): value is T {
  return (list as string[]).includes(value);
}

function decodePart(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Parse a location into a route. Unknown paths fall back to Around. */
export function parsePath(pathname: string, search = ''): BriefRoute {
  const route: BriefRoute = { ...DEFAULT_ROUTE, landed: true };
  const path = (pathname || '/').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  if (q.get('menu') === '1') route.menu = true;
  if (q.get('admin') === '1') route.admin = true;
  if (q.get('capture') === '1') route.capture = true;
  if (q.get('following') === '1') route.following = true;
  if (q.get('collections') === '1') route.collections = true;
  const campaign = q.get('campaign');
  if (campaign) route.campaignId = campaign;

  const root = parts[0] ?? '';

  if (root === '' || root === 'around') {
    route.dest = 'nearby';
    if (parts[1] === 'o' && parts[2]) route.objectId = decodePart(parts[2]);
    else if (parts[1] === 't' && parts[2]) route.teaSlug = decodePart(parts[2]);
    else if (parts[1] && isOne(NEARBY, parts[1])) route.nearby = parts[1];
    return route;
  }

  if (root === 'o' && parts[1]) {
    route.dest = 'nearby';
    route.objectId = decodePart(parts[1]);
    return route;
  }

  if (root === 'play') {
    route.dest = 'arena';
    if (parts[1] && isOne(ARENA, parts[1])) route.arena = parts[1];
    return route;
  }

  if (root === 'saved') {
    route.dest = 'mylayer';
    if (parts[1] && isOne(MYLAYER, parts[1])) route.mylayer = parts[1];
    return route;
  }

  if (root === 'actions') {
    route.dest = 'workflows';
    if (parts[1] && isOne(WORKFLOW, parts[1])) route.workflow = parts[1];
    return route;
  }


  // Public campaign pages are a server route. The SPA still boots; leave dest
  // as Around so a missing campaign does not invent a fifth room.
  if (root === 'c') {
    return route;
  }

  // Public entity pages: /e/<entityId> where entityId is "kind:key" — the
  // stable shareable URL for a venue/business/publisher/organizer/community.
  if (root === 'e' && parts[1]) {
    route.entityId = decodePart(parts[1]);
    return route;
  }

  // Public location discovery pages: /explore/<location> (e.g. kilimani).
  if (root === 'explore' && parts[1]) {
    route.locationName = decodePart(parts[1]);
    return route;
  }

  // Shared personal collection pages: /collections/<id>. The id is a
  // server-side random id — never guessable from a name.
  if (root === 'collections' && parts[1]) {
    route.collectionId = decodePart(parts[1]);
    return route;
  }

  return route;
}

/** Serialise a route. Overlays that are not places stay on the query string. */
export function toPath(route: BriefRoute): string {
  let path = '/around';

  if (route.entityId) {
    path = `/e/${encodeURIComponent(route.entityId)}`;
  } else if (route.locationName) {
    path = `/explore/${encodeURIComponent(route.locationName)}`;
  } else if (route.collectionId) {
    path = `/collections/${encodeURIComponent(route.collectionId)}`;
  } else if (route.dest === 'arena') {
    path = route.arena === 'lobby' ? '/play' : `/play/${route.arena}`;
  } else if (route.dest === 'mylayer') {
    path = route.mylayer === 'saved' ? '/saved' : `/saved/${route.mylayer}`;
  } else if (route.dest === 'workflows') {
    path = route.workflow === 'active' ? '/actions' : `/actions/${route.workflow}`;
  } else if (route.objectId) {
    path = `/o/${encodeURIComponent(route.objectId)}`;
  } else if (route.teaSlug) {
    path = `/around/t/${encodeURIComponent(route.teaSlug)}`;
  } else if (route.nearby !== 'stream') {
    path = `/around/${route.nearby}`;
  }

  const q = new URLSearchParams();
  if (route.menu) q.set('menu', '1');
  if (route.admin) q.set('admin', '1');
  if (route.capture) q.set('capture', '1');
  if (route.following) q.set('following', '1');
  if (route.collections) q.set('collections', '1');
  if (route.campaignId) q.set('campaign', route.campaignId);
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

export function objectPath(id: string): string {
  return `/o/${encodeURIComponent(id)}`;
}

/** Stable public path for an entity page (id = "kind:key"). */
export function entityPath(id: string): string {
  return `/e/${encodeURIComponent(id)}`;
}

/** Public path for a location discovery page (/explore/kilimani). */
export function explorePath(name: string): string {
  return `/explore/${encodeURIComponent(name)}`;
}

/** Stable public path for a shared collection page (/collections/:id). */
export function collectionPath(id: string): string {
  return `/collections/${encodeURIComponent(id)}`;
}

/** Absolute share URL for a shared collection, or null without an origin. */
export function collectionShareUrl(origin: string | null, id: string): string | null {
  if (!origin) return null;
  return `${origin.replace(/\/+$/, '')}${collectionPath(id)}`;
}

/** Absolute share URL, or null when Brief has no origin to name. */
export function objectShareUrl(origin: string | null, id: string): string | null {
  if (!origin) return null;
  return `${origin.replace(/\/+$/, '')}${objectPath(id)}`;
}

/** Absolute share URL for an entity page, or null without an origin. */
export function entityShareUrl(origin: string | null, id: string): string | null {
  if (!origin) return null;
  return `${origin.replace(/\/+$/, '')}${entityPath(id)}`;
}

export function samePlace(a: BriefRoute, b: BriefRoute): boolean {
  return toPath({ ...a, landed: false }) === toPath({ ...b, landed: false });
}

export function isBriefRoute(value: unknown): value is BriefRoute {
  if (!value || typeof value !== 'object') return false;
  const r = value as BriefRoute;
  return r.dest === 'nearby' || r.dest === 'arena' || r.dest === 'mylayer' || r.dest === 'workflows';
}
