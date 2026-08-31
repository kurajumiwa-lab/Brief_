// ---------------------------------------------------------------------------
// PUBLIC FEED PROJECTION
//
// The feed route is intentionally open to anonymous consumers. This module is
// the boundary between the internal object graph and that public contract:
// only public objects are accepted, and internal provenance, publication state,
// ownership and extraction fields are never serialized.
// ---------------------------------------------------------------------------

import * as feed from './feed.js';
import { store } from '../store.js';

const PUBLIC_METADATA_KEYS = [
  'price',
  'currency',
  'deadline',
  'capacity',
  'attendeesCount',
  'operatingHours',
  'rating',
  'reviewsCount',
  'distanceKm',
  'statusBadge',
  // Extracted locality + event facts: safe discovery fields that already
  // exist on the row, useful to cards and filters.
  'area',
  'county',
  'landmark',
  'venue',
  'organizer',
  'dateCanonical',
  'eventStart',
  'eventEnd',
  'deadlineCanonical',
  'dayOfWeek',
  'recurrence'
];
function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function publicMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const out = {};
  for (const key of PUBLIC_METADATA_KEYS) {
    const value = metadata[key];
    if (value !== undefined && value !== null) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function publicMedia(media, objectId) {
  if (!media || typeof media !== 'object') return null;

  // A Telegram (or provider) image reference we hold but have not resolved to a
  // URL yet. Project it as a server-side resolve path rather than dropping the
  // image: the resolve endpoint turns the file_id into bytes at render time and
  // the bot token never appears in this payload. The path is ROOT-relative --
  // the client prefixes it with the ingestion proxy exactly like an upload.
  if (media.needsResolution && typeof media.reference === 'string' && objectId) {
    return {
      url: `/api/media/telegram/${objectId}`,
      alt: stringOrNull(media.alt),
      attribution: stringOrNull(media.attribution)
    };
  }

  if (typeof media.url !== 'string' || !media.url.trim()) return null;
  return {
    url: media.url,
    alt: stringOrNull(media.alt),
    attribution: stringOrNull(media.attribution)
  };
}

/**
 * Collect the object's REAL source images, in a stable order, with public
 * URLs. Telegram file references cannot be exposed as URLs, so each one
 * resolves to `/api/media/telegram/:objectId/:index` and the resolve endpoint
 * scans with this SAME function — the index always points at the same photo.
 * Deduplicated by reference/url so one photo never renders twice.
 */
export function collectObjectImages(objectId) {
  const sourceRows = store.filter('objectSources', (s) => s.objectId === objectId);
  const seen = new Set();
  const out = [];
  for (const s of sourceRows) {
    const raw = s.rawItemId ? store.find('rawItems', (r) => r.id === s.rawItemId) : null;
    const mediaList = Array.isArray(raw?.media) ? raw.media : [];
    for (const entry of mediaList) {
      if (entry?.kind !== 'image') continue;
      const key = typeof entry.reference === 'string' && entry.reference
        ? `ref:${entry.reference}`
        : (typeof entry.url === 'string' && entry.url ? `url:${entry.url}` : null);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        reference: typeof entry.reference === 'string' && entry.reference ? entry.reference : null,
        url: typeof entry.url === 'string' && entry.url.trim() ? entry.url : null,
        alt: stringOrNull(entry.caption ?? entry.alt),
        attribution: stringOrNull(entry.attribution)
      });
      if (out.length >= 5) break;
    }
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * A gallery of the object's REAL source images, when more than one exists.
 * Built from the raw items its provenance points at (Telegram posts and web
 * pages can carry several photos); the same resolve rule as the cover image.
 * Absent when there is only one image — the cover already shows it.
 */
function publicGallery(objectId) {
  const images = collectObjectImages(objectId);
  if (images.length < 2) return null;
  return images.map((img, index) => ({
    url: img.url ?? `/api/media/telegram/${objectId}/${index}`,
    alt: img.alt,
    attribution: img.attribution
  }));
}

function publicAction(object) {
  const allowedTypes = new Set(['internal', 'external', 'phone', 'map']);
  const type = allowedTypes.has(object?.actionType) ? object.actionType : null;
  const rawUrl = stringOrNull(object?.actionUrl);
  const url = rawUrl && /^(https?:\/\/|tel:)/i.test(rawUrl) ? rawUrl : null;
  const label = stringOrNull(object?.actionLabel);
  if (!type && !url && !label) return null;
  return {
    type,
    url,
    label
  };
}

function temporaryTestContent(row) {
  if (row?.seedBatch !== 'nairobi-demo-v1') return null;
  return {
    label: 'Test preview',
    expiresAt: typeof row.seedExpiresAt === 'string' ? row.seedExpiresAt : null
  };
}

/** A public object contains useful discovery fields, never the object row. */
export function publicObject(object) {
  if (!object || object.publication !== 'public') return null;

  const temporal = object.temporal;
  const temporalOut = temporal && typeof temporal === 'object'
    ? {
        status: typeof temporal.status === 'string' ? temporal.status : 'current',
        startsAt: temporal.startsAt ?? null,
        endsAt: temporal.endsAt ?? null,
        deadlineAt: temporal.deadlineAt ?? null,
        expiresAt: temporal.expiresAt ?? null,
        ...(typeof temporal.dayOfWeek === 'string' ? { dayOfWeek: temporal.dayOfWeek } : {}),
        ...(temporal.recurring === true ? { recurring: true } : {})
      }
    : null;

  const sourceNames = Array.isArray(object.sourceNames)
    ? object.sourceNames.filter((s) => typeof s === 'string').slice(0, 3)
    : [];
  const sourcePlatforms = Array.isArray(object.sourcePlatforms)
    ? object.sourcePlatforms.filter((s) => typeof s === 'string').slice(0, 3)
    : [];

  const gallery = publicGallery(object.id);

  // The original link the item came from: the first provenance row's stated
  // URL, else the source's own homepage. This is the honest "Read original"
  // target — an external URL, never an internal id.
  const sourceRows = store.filter('objectSources', (s) => s.objectId === object.id);
  let sourceUrl = null;
  for (const s of sourceRows) {
    if (typeof s.sourceUrl === 'string' && /^https?:\/\//i.test(s.sourceUrl)) { sourceUrl = s.sourceUrl; break; }
    const src = s.sourceId ? store.find('sources', (x) => x.id === s.sourceId) : null;
    if (src && typeof src.url === 'string' && /^https?:\/\//i.test(src.url)) { sourceUrl = src.url; break; }
  }

  return {
    id: object.id,
    type: object.type,
    title: object.title,
    category: stringOrNull(object.category),
    summary: typeof object.summary === 'string' ? object.summary : '',
    locationName: stringOrNull(object.locationName),
    sourceUrl,
    verificationStatus: stringOrNull(object.verificationStatus),
    lastVerifiedAt: object.lastVerifiedAt ?? null,
    validityWindowDays: Number.isFinite(object.validityWindowDays) ? object.validityWindowDays : null,
    metadata: publicMetadata(object.metadata),
    media: publicMedia(object.media, object.id),
    gallery,
    action: publicAction(object),
    createdAt: object.createdAt ?? null,
    // When the story was first published anywhere in its provenance.
    publishedAt: typeof object.publishedAt === 'string' ? object.publishedAt : null,
    // Discovery intelligence projection (additive, safe): the temporal
    // lifecycle and the visible provenance count. Internal scores never leave
    // the server.
    temporal: temporalOut,
    sourceNames: sourceNames.length ? sourceNames : null,
    sourceCount: Number.isInteger(object.sourceCount) && object.sourceCount > 0 ? object.sourceCount : null,
    sourcePlatforms: sourcePlatforms.length ? sourcePlatforms : null,
    clusterSize: Number.isInteger(object.clusterSize) && object.clusterSize > 1 ? object.clusterSize : null,
    ...(temporaryTestContent(object) ? { testContent: temporaryTestContent(object) } : {})
  };
}

/** Feed cards need the article title and teaser, not the full article body. */
export function publicArticle(article) {
  if (!article || typeof article !== 'object') return null;
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    dek: typeof article.dek === 'string' ? article.dek : '',
    category: stringOrNull(article.category),
    location: stringOrNull(article.location),
    heroImage: stringOrNull(article.heroImage),
    images: Array.isArray(article.images)
      ? article.images.filter((image) => typeof image === 'string').slice(0, 20)
      : [],
    author: stringOrNull(article.author),
    source: stringOrNull(article.source),
    sourceUrl: stringOrNull(article.sourceUrl),
    readingTime: Number.isFinite(article.readingTime) ? article.readingTime : null,
    publishedAt: article.publishedAt ?? null,
    expiresAt: article.expiresAt ?? null,
    createdAt: article.createdAt ?? null,
    tags: Array.isArray(article.tags)
      ? article.tags.filter((tag) => typeof tag === 'string').slice(0, 20)
      : [],
    ...(temporaryTestContent(article) ? { testContent: temporaryTestContent(article) } : {})
  };
}

/**
 * Compose and project the public feed. `objects` must already be restricted to
 * publication === 'public' and media-enriched by the route.
 */
export function composePublicFeed({ objects = [], tea = [], limit = 50 } = {}) {
  const safeObjects = objects.map(publicObject).filter(Boolean);
  const composed = feed.composeFeed({
    objects: safeObjects,
    tea,
    heroLimit: Math.min(1, limit),
    discoveryLimit: Math.min(4, limit),
    opportunityLimit: Math.min(3, limit)
  });

  return {
    hero: composed.hero,
    discovery: composed.discovery,
    opportunities: composed.opportunities,
    more: composed.more,
    tea: publicArticle(composed.tea),
    moreTea: composed.moreTea.map(publicArticle).filter(Boolean),
    counts: composed.counts
  };
}
