// ---------------------------------------------------------------------------
// MEDIA ASSOCIATION — the reusable visual layer (home-feed master build, Phase 6)
//
// One place decides what image (if any) represents a content object, following
// a strict, honest fallback chain. The master-build rule is absolute:
//
//   1. Exact image the object itself carries (ingestion media / editorial)
//   2. Venue / organiser image (the vendor or place it is attached to)
//   3. Location image (the place it happens at)
//   4. Category image (an editorial library image for its category)
//   5. NOTHING — never a random unrelated image just to fill space
//
// Every resolution records which level was used (imageSourceType) and the
// attribution, so the system can later upgrade to a real image without losing
// the provenance of what it is showing now.
//
// IMAGE PROVIDERS: a provider abstraction (fetch/transform an image from a
// configured source). With no provider configured, the resolver works only on
// images already in the store — and reports exactly that. It never fabricates
// a stock photo, and it never scrapes a site in a way that violates its terms.
// ---------------------------------------------------------------------------

import { store } from '../store.js';

// ---------------------------------------------------------------------------
// IMAGE PROVIDER ABSTRACTION
// ---------------------------------------------------------------------------

/**
 * A provider exposes `isConfigured()` and `status()`. A configured provider
 * can be asked to resolve an image URL for a search intent; an unconfigured
 * one is reported, not pretended to be live. The registry is deliberately
 * empty until a real, credentialed provider is registered — there is no
 * provider that works without credentials.
 */
export const IMAGE_PROVIDERS = {};

export function providerStatus() {
  const providers = Object.fromEntries(
    Object.entries(IMAGE_PROVIDERS).map(([k, v]) => [k, v.status()])
  );
  const configured = Object.values(IMAGE_PROVIDERS).filter((p) => p.isConfigured()).length;
  return {
    configured: configured > 0,
    count: Object.keys(IMAGE_PROVIDERS).length,
    providers,
    reason: configured === 0
      ? 'No image provider is configured. Media resolution uses only images ' +
        'already in the store (ingestion media / editorial uploads); nothing ' +
        'is fetched from a third party and nothing is fabricated.'
      : null
  };
}

// ---------------------------------------------------------------------------
// FALLBACK CHAIN
// ---------------------------------------------------------------------------

/** The ordered source types, strongest first. */
export const SOURCE_LEVELS = ['exact', 'venue', 'location', 'category', 'none'];

/** Read the exact image an object already carries, if any. */
function exactImage(object) {
  const url = object?.imageUrl ?? object?.heroImage ?? null;
  if (url) {
    return {
      url,
      level: 'exact',
      sourceType: 'exact',
      alt: object?.imageAlt ?? object?.title ?? null,
      attribution: object?.imageAttribution ?? null,
      confidence: typeof object?.imageConfidence === 'number' ? object.imageConfidence : 0.9
    };
  }
  // A Telegram file_id (or any provider reference) is an exact image we hold
  // but have not yet resolved to a URL. Report it honestly: the level is
  // still 'exact', the reference is preserved, and `needsResolution` says a
  // server-side fetch is required before it can be rendered. We never present
  // the file id as a URL.
  const ref = object?.imageReference ?? null;
  if (ref) {
    return {
      url: null,
      reference: ref,
      level: 'exact',
      sourceType: object?.imageSourceType ?? 'telegram',
      alt: object?.imageAlt ?? object?.title ?? null,
      attribution: object?.imageAttribution ?? null,
      confidence: typeof object?.imageConfidence === 'number' ? object.imageConfidence : 0.9,
      needsResolution: object?.imageNeedsResolution !== false
    };
  }
  return null;
}

/** The venue/organiser image — the vendor or provider the object is attached to. */
function venueImage(object) {
  const vendorId = object?.providerObjectId ?? object?.metadata?.vendorId;
  if (!vendorId) return null;
  const vendor = store.find('vendors', (v) => v.id === vendorId);
  const url = vendor?.imageUrl ?? null;
  if (!url) return null;
  return {
    url,
    level: 'venue',
    sourceType: 'venue',
    alt: vendor.displayName ?? object.title ?? null,
    attribution: vendor.displayName ?? null,
    confidence: 0.8
  };
}

/** The location image — the place the object happens at. */
function locationImage(object) {
  const locId = object?.locationObjectId;
  if (!locId) return null;
  const loc = store.find('objects', (o) => o.id === locId);
  const url = loc?.imageUrl ?? null;
  if (!url) return null;
  return {
    url,
    level: 'location',
    sourceType: 'location',
    alt: loc.title ?? object.title ?? null,
    attribution: loc.title ?? null,
    confidence: 0.7
  };
}

/** A category image from the editorial media library, if one is approved. */
function categoryImage(object) {
  const cat = object?.category ?? null;
  if (!cat) return null;
  const row = store.find('mediaLibrary', (m) => m.kind === 'category' && m.key === cat && m.status === 'approved');
  if (!row?.url) return null;
  return {
    url: row.url,
    level: 'category',
    sourceType: 'category',
    alt: row.alt ?? `${cat} in Brief`,
    attribution: row.attribution ?? null,
    confidence: 0.6
  };
}

/**
 * Resolve the best image for an object, or null (level 'none') when there is
 * nothing honest to show. The result always names the level used, so the
 * caller can render an appropriate non-photo fallback instead of a wrong image.
 */
export function resolveMedia(object) {
  if (!object) return { level: 'none', image: null, provider: null };
  for (const fn of [exactImage, venueImage, locationImage, categoryImage]) {
    const hit = fn(object);
    if (hit) return { level: hit.level, image: hit, provider: null };
  }
  return { level: 'none', image: null, provider: null };
}

/** Enrich a list of objects with their resolved media, once, for the feed. */
export function enrichObjects(objects) {
  return objects.map((o) => {
    const media = resolveMedia(o);
    return { ...o, media: media.image, mediaLevel: media.level };
  });
}

// ---------------------------------------------------------------------------
// EDITORIAL MEDIA LIBRARY
// ---------------------------------------------------------------------------

/**
 * A category/editorial image is recorded here (kind 'category', key = category
 * name, status draft/approved). Only approved rows are used by the resolver.
 * The library is empty until an editor uploads — nothing is pre-fabricated.
 */
export function recordMediaLibraryImage({ kind, key, url, alt = null, attribution = null, status = 'draft' }) {
  if (kind !== 'category' && kind !== 'editorial') throw new Error('invalid media kind');
  if (!key || !String(key).trim()) throw new Error('key is required');
  if (!url || !String(url).trim()) throw new Error('url is required');
  const existing = store.find('mediaLibrary', (m) => m.kind === kind && m.key === key);
  if (existing) {
    return store.update('mediaLibrary', existing.id, { url, alt, attribution, status, updatedAt: new Date().toISOString() });
  }
  return store.insert('mediaLibrary', {
    id: `media_${kind}_${String(key).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    kind, key: String(key).trim(), url, alt, attribution, status,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
}
