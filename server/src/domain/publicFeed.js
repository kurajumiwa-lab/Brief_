// ---------------------------------------------------------------------------
// PUBLIC FEED PROJECTION
//
// The feed route is intentionally open to anonymous consumers. This module is
// the boundary between the internal object graph and that public contract:
// only public objects are accepted, and internal provenance, publication state,
// ownership and extraction fields are never serialized.
// ---------------------------------------------------------------------------

import * as feed from './feed.js';

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
  'statusBadge'
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
  return {
    id: object.id,
    type: object.type,
    title: object.title,
    category: stringOrNull(object.category),
    summary: typeof object.summary === 'string' ? object.summary : '',
    locationName: stringOrNull(object.locationName),
    verificationStatus: stringOrNull(object.verificationStatus),
    lastVerifiedAt: object.lastVerifiedAt ?? null,
    validityWindowDays: Number.isFinite(object.validityWindowDays) ? object.validityWindowDays : null,
    metadata: publicMetadata(object.metadata),
    media: publicMedia(object.media, object.id),
    action: publicAction(object),
    createdAt: object.createdAt ?? null,
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
