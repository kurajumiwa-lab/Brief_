// ---------------------------------------------------------------------------
// ENTITIES — the followable layer (DISCOVER → FOLLOW → RECEIVE → ACT).
//
// An entity is NEVER a new duplicated record. Every entity is a DERIVED
// projection over records Brief already persists:
//
//   business  → an object with type 'business' or 'identity' (a named actor,
//               e.g. a vendor, shop, studio) — the object IS the entity.
//   venue     → an object with type 'place' (named place/landmark, e.g.
//               "Kilimani Studio", "Sarit Centre Expo") — the object IS the
//               entity. Areas/neighbourhoods are NOT venues: they are
//               locations, not followable entities.
//   organizer → derived from object metadata.organizer / metadata.hostedBy
//               on event/experience/announcement objects. Carries the
//               objects they organize.
//   publisher → derived from sources: a channel/feed/website that publishes
//               Brief objects. Only sources with a real name/url are exposed.
//   community → derived from a Circle (circle.js), which itself derives from
//               a source. Circles are the durable group container.
//
// Kinds map onto the brief's language:
//   Places (venue), Businesses (business), Publishers (publisher),
//   Organizers (organizer), Communities (community).
//
// A single entityKey per kind keeps identity stable (e.g. an organizer name
// is the key; a venue id is the key). Follow rows reference (kind, entityKey)
// and the projection is recomputed live, so entities never drift from the
// objects that define them.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import * as discovery from './discovery.js';
import * as circleDomain from './circle.js';
import * as sourceTrust from './sourceTrust.js';
import { scanLocations, classifyLocation } from '../pipeline/gazetteer.js';

/** Public-facing entity kinds, in the order the Following surface groups them. */
export const ENTITY_KINDS = ['venue', 'business', 'publisher', 'organizer', 'community'];

export const KIND_LABELS = {
  venue: 'Place',
  business: 'Business',
  publisher: 'Publisher',
  organizer: 'Organizer',
  community: 'Community'
};

export const KIND_GROUP_LABELS = {
  venue: 'Places',
  business: 'Businesses',
  publisher: 'Publishers',
  organizer: 'Organizers',
  community: 'Communities'
};

/** A venue entity must look like a real place, not a neighbourhood. */
const VENUE_NAME_RE = /(studio|market|centre|center|expo|fair|hall|garden|park|mall|gallery|club|hotel|lodge|camp|farm|stadium|arena|square|theatre|theater|museum|library|school|university|college|church|mosque|temple|factory|workshop|lab|kitchen|bakery|brewery|winery|farm|ranch|reserve|beach|island|creek|bay|hill|falls|springs|valley|conservancy|sanctuary|botanical|resort|spa|salon|barber|gym|studio|yard|site|field|course|court|pool|house|home|store|shop|restaurant|cafe|café|kiosk|office|tower|plaza|arcade|bazaar|market|mall|terminal|station|airport|port|dock|harbour|harbor|pier|lighthouse)/i;

/** Where one entity can be pinned to a location with real evidence. */
function localityOf(record) {
  const area = record?.metadata?.area;
  const county = record?.metadata?.county;
  if (typeof area === 'string' && area.trim()) return { area: area.trim(), county: null };
  if (typeof county === 'string' && county.trim()) return { area: null, county: county.trim() };
  const named = record?.locationName;
  if (typeof named === 'string' && named.trim() && classifyLocation(named.trim())) {
    const cls = classifyLocation(named.trim());
    if (cls.kind === 'area') return { area: cls.value, county: null };
    if (cls.kind === 'county') return { area: null, county: cls.value };
  }
  return null;
}

/** Objects that belong to an entity, public + non-stale, with temporal info. */
function entityObjects(objects) {
  return objects
    .filter((o) => o.publication === 'public')
    .filter((o) => !discovery.isStale(o, new Date()))
    .map((o) => ({ ...o, temporal: discovery.temporalFields(o, new Date()) }));
}

/**
 * Objects related to `o` through the EXISTING relationship graph
 * (relationships collection: has_vendor / appears_at / offers / ...) plus —
 * for named places — objects whose structured metadata names the venue
 * (metadata.venue / hostedBy / locationName). No keyword matching: only the
 * stored relationship rows and exact structured fields are used.
 */
function relatedObjectsOf(o) {
  const ids = new Set([o.id]);
  for (const r of store.filter('relationships', (r) => r.sourceId === o.id)) {
    if (typeof r.targetId === 'string' && r.targetId.startsWith('obj_')) ids.add(r.targetId);
  }
  for (const r of store.filter('relationships', (r) => r.targetId === o.id)) {
    if (typeof r.sourceId === 'string' && r.sourceId.startsWith('obj_')) ids.add(r.sourceId);
  }
  if (o.type === 'place') {
    const name = String(o.title || '').trim();
    if (name) {
      for (const x of store.all('objects')) {
        if (x.id === o.id) continue;
        const m = x.metadata ?? {};
        if (String(m.venue ?? '') === name || String(m.hostedBy ?? '') === name
          || String(x.locationName ?? '') === name) ids.add(x.id);
      }
    }
  }
  return [...ids];
}

/** Real proof an organizer name is not an artifact of the seed. */
function organizerIsReal(name) {
  const LOWER_PLACE_WORDS = ['market', 'festival', 'fair', 'expo', 'weekend', 'day', 'popup'];
  const n = String(name ?? '').trim();
  if (!n) return false;
  if (LOWER_PLACE_WORDS.includes(n.toLowerCase())) return false;
  // "Kilimani Studio" is the venue of the popup, not its organizer.
  if (VENUE_NAME_RE.test(n)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Resolve an entity from an id the client may send: "venue:obj_xxx",
// "business:obj_yyy", "publisher:src_zzz", "community:circle_www",
// or a bare object id (auto-detected kind).
// ---------------------------------------------------------------------------
export function parseEntityId(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const t = raw.trim();
  const m = /^([a-z]+):(.+)$/.exec(t);
  if (m && ENTITY_KINDS.includes(m[1])) return { kind: m[1], key: m[2] };
  if (/^src_/.test(t)) return { kind: 'publisher', key: t };
  if (/^circle_/.test(t)) return { kind: 'community', key: t };
  if (/^obj_/.test(t)) return { kind: null, key: t };
  return null;
}

/** True when the object can back a venue or business entity (the object IS it). */
export function isEntityObject(o) {
  return Boolean(
    o &&
    o.publication === 'public' &&
    (o.type === 'place' || o.type === 'business' || o.type === 'identity')
  );
}

/**
 * Resolve every entity reachable from the persisted rows.
 * Returns a map keyed by `${kind}:${entityKey}`.
 */
export function resolveEntities() {
  const entities = new Map();
  const put = (entity) => {
    if (!entity) return;
    const id = `${entity.kind}:${entity.entityKey}`;
    const prev = entities.get(id);
    if (prev && (prev.objects?.length || 0) >= (entity.objects?.length || 0)) return;
    entities.set(id, entity);
  };

  const objects = store.all('objects');
  const sources = store.all('sources');
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  // Venues + businesses: the object itself is the entity; related objects
  // come from the existing relationship graph + exact structured fields.
  for (const o of objects) {
    if (o.publication !== 'public') continue;
    if (o.type === 'place') {
      const name = String(o.title || '').trim();
      if (name && VENUE_NAME_RE.test(name)) {
        const relatedIds = new Set(relatedObjectsOf(o));
        put({
          kind: 'venue',
          entityKey: o.id,
          name,
          slug: o.id,
          summary: String(o.summary || o.dek || '').trim() || null,
          description: String(o.body || o.summary || o.dek || '').trim() || null,
          imageUrl: o.imageUrl || null,
          category: o.category || 'Place',
          location: localityOf(o),
          locationName: typeof o.locationName === 'string' ? o.locationName.trim() : null,
          objects: entityObjects(objects.filter((x) => relatedIds.has(x.id))),
          sourceIds: discovery.sourcesOf(o).map((s) => s.id),
          sourceNames: discovery.sourcesOf(o).map((s) => s.name).filter(Boolean),
          viaSourceId: null
        });
      }
    } else if (o.type === 'business' || o.type === 'identity') {
      const name = String(o.title || '').trim();
      if (name && name.toLowerCase() !== 'business') {
        const relatedIds = new Set(relatedObjectsOf(o));
        put({
          kind: 'business',
          entityKey: o.id,
          name,
          slug: o.id,
          summary: String(o.summary || o.dek || '').trim() || null,
          description: String(o.body || o.summary || o.dek || '').trim() || null,
          imageUrl: o.imageUrl || null,
          category: o.category || 'Business',
          location: localityOf(o),
          locationName: typeof o.locationName === 'string' ? o.locationName.trim() : null,
          objects: entityObjects(objects.filter((x) => relatedIds.has(x.id))),
          sourceIds: discovery.sourcesOf(o).map((s) => s.id),
          sourceNames: discovery.sourcesOf(o).map((s) => s.name).filter(Boolean),
          viaSourceId: null
        });
      }
    }
  }

  // Organizers: derived from structured metadata on event-ish objects.
  const organizerNames = new Map(); // name -> { objects: [], locations: Set }
  for (const o of objects) {
    if (o.publication !== 'public') continue;
    const meta = o.metadata ?? {};
    const name = String(meta.organizer || meta.hostedBy || '').trim();
    if (!name || !organizerIsReal(name)) continue;
    if (!['event', 'experience', 'announcement'].includes(o.type)) continue;
    let entry = organizerNames.get(name);
    if (!entry) {
      entry = { objects: [], locations: new Set() };
      organizerNames.set(name, entry);
    }
    entry.objects.push(o);
    const loc = localityOf(o);
    if (loc) entry.locations.add(JSON.stringify(loc));
  }
  for (const [name, entry] of organizerNames) {
    const locs = [...entry.locations].map((l) => JSON.parse(l));
    put({
      kind: 'organizer',
      entityKey: name,
      name,
      slug: `org:${name}`,
      summary: null,
      description: null,
      imageUrl: null,
      category: 'Organizer',
      location: locs[0] ?? null,
      locationName: null,
      objects: entityObjects(entry.objects),
      sourceIds: [],
      sourceNames: [],
      viaSourceId: null
    });
  }

  // Publishers: real named sources that produced public objects.
  const usedSourceIds = new Set();
  for (const os of store.all('objectSources')) usedSourceIds.add(os.sourceId);
  for (const s of sources) {
    if (!usedSourceIds.has(s.id)) continue;
    const name = String(s.name || '').trim();
    const url = typeof s.url === 'string' ? s.url.trim() : null;
    if (!name) continue;
    if (!url && s.accessType !== 'public') continue; // credentials-only source, not user-facing
    const owned = objects.filter((o) =>
      o.publication === 'public' && discovery.sourcesOf(o).some((so) => so.id === s.id)
    );
    if (owned.length === 0) continue;
    put({
      kind: 'publisher',
      entityKey: s.id,
      name,
      slug: s.id,
      summary: url || null,
      description: null,
      imageUrl: null,
      category: 'Publisher',
      location: null,
      locationName: null,
      objects: entityObjects(owned),
      sourceIds: [s.id],
      sourceNames: [name],
      viaSourceId: s.id
    });
  }

  // Communities: durable circles (which themselves derive from sources).
  for (const c of circleDomain.listCircles(null)) {
    const circleObjects = entityObjects(
      objects.filter((o) => discovery.sourcesOf(o).some((so) => so.id === c.sourceId))
    );
    if (circleObjects.length === 0 && c.type !== 'treasury') continue;
    const src = c.sourceId ? sourceById.get(c.sourceId) : null;
    const name = String(c.name || src?.name || '').trim();
    if (!name) continue;
    put({
      kind: 'community',
      entityKey: c.id,
      name,
      slug: c.id,
      summary: c.description || (src ? String(src.name || '') : null) || null,
      description: c.description || null,
      imageUrl: null,
      category: 'Community',
      location: null,
      locationName: null,
      objects: circleObjects,
      sourceIds: c.sourceId ? [c.sourceId] : [],
      sourceNames: src ? [String(src.name || '')] : [],
      viaSourceId: c.sourceId ?? null
    });
  }

  return entities;
}

/** Public projection of one entity — never leaks credentials or private rows. */
export function publicEntity(entity, viewerId = null) {
  if (!entity) return null;
  const objects = (entity.objects || []).map((o) => ({
    id: o.id,
    type: o.type,
    title: o.title,
    summary: o.summary ?? o.dek ?? null,
    imageUrl: o.imageUrl ?? null,
    locationName: o.locationName ?? null,
    category: o.category ?? null,
    area: o.metadata?.area ?? null,
    county: o.metadata?.county ?? null,
    temporal: o.temporal ?? null,
    sourceNames: o.sourceNames ?? []
  }));
  return {
    kind: entity.kind,
    id: `${entity.kind}:${entity.entityKey}`,
    entityKey: entity.entityKey,
    name: entity.name,
    slug: entity.slug,
    summary: entity.summary,
    description: entity.description,
    imageUrl: entity.imageUrl,
    category: entity.category,
    location: entity.location,
    locationName: entity.locationName,
    sourceNames: (entity.sourceNames || []).slice(0, 3),
    // Trust: only ever derived from the existing source-trust infrastructure
    // (sourceTrust.js) — an operator decision about provenance standing,
    // never an invented verification badge. Degraded sources are flagged so
    // the page does not present them as highly authoritative; corroboration
    // (multiple independent provenance sources) is reported as a plain fact.
    trust: (() => {
      const statuses = (entity.sourceIds || [])
        .map((id) => store.find('sources', (x) => x.id === id))
        .filter(Boolean)
        .map((s) => sourceTrust.trustOf(s));
      // Corroboration is a fact about the entity's CONTENT: at least one of
      // its objects was independently seen by two or more provenance sources.
      const corroborated = (entity.objects || []).some((o) =>
        new Set(discovery.sourcesOf(o).map((s) => s.id)).size >= 2
      );
      return {
        degraded: statuses.some((st) => st === 'degraded'),
        disabled: statuses.length > 0 && statuses.every((st) => st === 'disabled'),
        corroborated
      };
    })(),
    isFollowed: Boolean(viewerId && store.find('entityFollows', (f) =>
      f.userId === viewerId && f.kind === entity.kind && f.entityKey === entity.entityKey
    )),
    followCount: store.filter('entityFollows', (f) =>
      f.kind === entity.kind && f.entityKey === entity.entityKey
    ).length,
    objects
  };
}

/**
 * The user's following feed: entities they follow, each with their recent
 * objects, ranked by the same discovery intelligence as the feed. Expired
 * content never appears as active — temporal status is projected on every row.
 */
export function followingFeed(viewerId, now = new Date()) {
  const follows = store
    .filter('entityFollows', (f) => f.userId === viewerId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const entities = resolveEntities();
  const sections = [];
  const seenObjects = new Set();

  for (const f of follows) {
    const entity = entities.get(`${f.kind}:${f.entityKey}`);
    if (!entity) continue;
    const objects = (entity.objects || [])
      .filter((o) => !seenObjects.has(o.id))
      .map((o) => ({ ...o, score: discovery.rankObject(o, { now }) }))
      .sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id))
      .slice(0, 6);
    for (const o of objects) seenObjects.add(o.id);
    sections.push({
      kind: f.kind,
      entityId: `${f.kind}:${f.entityKey}`,
      entityKey: f.entityKey,
      name: entity.name,
      category: entity.category,
      imageUrl: entity.imageUrl,
      location: entity.location,
      objects
    });
  }
  return sections;
}

/** Resolve one entity by public id (kind:key or bare object id), or null. */
export function getEntity(rawId, viewerId = null) {
  const parsed = parseEntityId(rawId);
  if (!parsed) return null;
  const entities = resolveEntities();
  if (parsed.kind) {
    const e = entities.get(`${parsed.kind}:${parsed.key}`);
    return e ? publicEntity(e, viewerId) : null;
  }
  // Bare object id: pick the strongest entity it backs.
  const o = store.find('objects', (x) => x.id === parsed.key);
  if (!o) return null;
  if (o.type === 'place') return publicEntity(entities.get(`venue:${o.id}`), viewerId);
  if (o.type === 'business' || o.type === 'identity') {
    return publicEntity(entities.get(`business:${o.id}`), viewerId);
  }
  return null;
}

/**
 * Entity search — extends the existing object search, never replaces it.
 * Returns entities whose name matches, ordered by strength of match, plus a
 * count so the caller can show entity hits alongside object hits.
 */
export function searchEntities(q, limit = 4) {
  const needle = String(q ?? '').trim().toLowerCase();
  if (!needle) return { entities: [], count: 0 };
  const out = [];
  for (const e of resolveEntities().values()) {
    if (!e.name) continue;
    const name = e.name.toLowerCase();
    let score = 0;
    if (name === needle) score = 100;
    else if (name.startsWith(needle)) score = 80;
    else if (name.includes(needle)) score = 50;
    else continue;
    // Prefer entities with live content behind them.
    score += Math.min(20, (e.objects?.length || 0) * 2);
    out.push({ score, entity: publicEntity(e) });
  }
  out.sort((a, b) => b.score - a.score || a.entity.name.localeCompare(b.entity.name));
  return { entities: out.slice(0, limit).map((x) => x.entity), count: out.length };
}

/** Entities whose follow-state should appear in a user's Following surface. */
export function listFollows(viewerId) {
  const entities = resolveEntities();
  const follows = store
    .filter('entityFollows', (f) => f.userId === viewerId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const out = [];
  for (const f of follows) {
    const entity = entities.get(`${f.kind}:${f.entityKey}`);
    if (!entity) continue;
    out.push({
      kind: f.kind,
      id: `${f.kind}:${f.entityKey}`,
      entityKey: f.entityKey,
      name: entity.name,
      category: entity.category,
      imageUrl: entity.imageUrl,
      location: entity.location,
      sourceNames: (entity.sourceNames || []).slice(0, 2),
      objectCount: (entity.objects || []).length,
      followedAt: f.createdAt ?? null
    });
  }
  return out;
}

/** Follow an entity. Idempotent; the row carries kind + entityKey only. */
export function followEntity(viewerId, kind, entityKey, at = new Date().toISOString()) {
  const existing = store.find('entityFollows', (f) =>
    f.userId === viewerId && f.kind === kind && f.entityKey === entityKey
  );
  if (existing) return { followed: true, already: true };
  store.insert('entityFollows', {
    id: `flw_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`,
    userId: viewerId,
    kind,
    entityKey,
    createdAt: at,
    updatedAt: at
  });
  return { followed: true, already: false };
}

/** Unfollow. Idempotent. */
export function unfollowEntity(viewerId, kind, entityKey) {
  const row = store.find('entityFollows', (f) =>
    f.userId === viewerId && f.kind === kind && f.entityKey === entityKey
  );
  if (!row) return { unfollowed: true, already: true };
  store.remove('entityFollows', row.id);
  return { unfollowed: true, already: false };
}

/** The live location of a venue/business entity, when there is real evidence. */
export function entityLocation(entity) {
  if (!entity) return null;
  if (entity.location && (entity.location.area || entity.location.county)) return entity.location;
  if (entity.locationName) {
    const cls = classifyLocation(entity.locationName);
    if (cls && cls.kind === 'area') return { area: cls.value, county: null };
    if (cls && cls.kind === 'county') return { area: null, county: cls.value };
  }
  return null;
}

/**
 * The entity keys an object belongs to (venue/business self, organizer from
 * metadata, publisher + community from provenance). Cheap per-object scan —
 * used by the Personal Brief ranking so an explicit entity follow boosts the
 * object's score exactly like the entity pages treat it.
 */
export function entityKeysOfObject(o) {
  if (!o?.id) return [];
  const keys = new Set();
  if (o.type === 'place') keys.add(`venue:${o.id}`);
  else if (o.type === 'business' || o.type === 'identity') keys.add(`business:${o.id}`);
  const meta = o.metadata ?? {};
  const org = String(meta.organizer || meta.hostedBy || '').trim();
  if (org && organizerIsReal(org)) keys.add(`organizer:${org}`);
  for (const s of discovery.sourcesOf(o)) {
    keys.add(`publisher:${s.id}`);
    const circle = store.find('circles', (c) => c.sourceId === s.id);
    if (circle) keys.add(`community:${circle.id}`);
  }
  // Structured-venue join (the SAME rule resolveEntities uses for entity
  // pages): an object whose metadata.venue / hostedBy / locationName exactly
  // names a public place belongs to that venue entity.
  const venueName = String(meta.venue || meta.hostedBy || o.locationName || '').trim();
  if (venueName) {
    for (const p of store.filter('objects', (x) => x.type === 'place' && x.publication === 'public')) {
      if (String(p.title || '').trim() === venueName) {
        keys.add(`venue:${p.id}`);
        break;
      }
    }
  }
  // Relationship traversal (the SAME rule resolveEntities uses): objects
  // linked through the relationship graph belong to the entity they touch.
  for (const r of store.filter('relationships', (r) => r.sourceId === o.id || r.targetId === o.id)) {
    const otherId = r.sourceId === o.id ? r.targetId : r.sourceId;
    const other = store.find('objects', (x) => x.id === otherId);
    if (!other || other.publication !== 'public') continue;
    if (other.type === 'place') keys.add(`venue:${other.id}`);
    else if (other.type === 'business' || other.type === 'identity') keys.add(`business:${other.id}`);
  }
  return [...keys];
}

/** Venue names found in structured object fields (venue/hostedBy/locationName). */
export function venueMentions() {
  const out = new Set();
  for (const o of store.all('objects')) {
    const meta = o.metadata ?? {};
    for (const v of [meta.venue, meta.hostedBy, o.locationName]) {
      const name = String(v ?? '').trim();
      if (name && VENUE_NAME_RE.test(name)) out.add(name);
    }
  }
  return [...out];
}

// Re-export the gazetteer helpers used by the routes for location joins.
export { scanLocations };
