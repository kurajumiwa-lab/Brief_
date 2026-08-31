// FEED ROUTES — the composed feed, available to anonymous consumers.
import * as discovery from '../domain/discovery.js';
import * as tea from '../domain/tea.js';
import * as media from '../domain/media.js';
import * as publicFeed from '../domain/publicFeed.js';
import { requireFeature } from '../features.js';

const DEFAULT_RADIUS_KM = 40;
const MAX_LIMIT = 50;
const VALID_LATITUDE = [-90, 90];
const VALID_LONGITUDE = [-180, 180];
const MAX_AREA_LENGTH = 60;

function numberParam(req, name) {
  const value = req.query[name];
  if (value === undefined) return null;
  if (Array.isArray(value) || String(value).trim() === '') return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Validate the small, stable query surface exposed to public consumers. */
function readQuery(req) {
  const hasLat = req.query.lat !== undefined;
  const hasLng = req.query.lng !== undefined;
  if (hasLat !== hasLng) {
    return { error: 'lat and lng must be provided together' };
  }

  const lat = hasLat ? numberParam(req, 'lat') : null;
  const lng = hasLng ? numberParam(req, 'lng') : null;
  if (hasLat && (Number.isNaN(lat) || lat < VALID_LATITUDE[0] || lat > VALID_LATITUDE[1])) {
    return { error: 'lat must be a number between -90 and 90' };
  }
  if (hasLng && (Number.isNaN(lng) || lng < VALID_LONGITUDE[0] || lng > VALID_LONGITUDE[1])) {
    return { error: 'lng must be a number between -180 and 180' };
  }

  const rawRadius = req.query.radiusKm;
  const radiusKm = rawRadius === undefined ? DEFAULT_RADIUS_KM : numberParam(req, 'radiusKm');
  if (Number.isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 200) {
    return { error: 'radiusKm must be greater than 0 and no more than 200' };
  }
  if (!hasLat && rawRadius !== undefined) {
    return { error: 'radiusKm requires lat and lng' };
  }

  // A named locality (county/area/landmark/venue) ranks local content up
  // WITHOUT coordinates. It is always caller-supplied — never invented, never
  // defaulted to a city.
  const rawArea = req.query.area;
  let area = null;
  if (rawArea !== undefined) {
    if (Array.isArray(rawArea) || typeof rawArea !== 'string') {
      return { error: 'area must be a single text value' };
    }
    area = rawArea.trim();
    if (area.length === 0 || area.length > MAX_AREA_LENGTH) {
      return { error: `area must be between 1 and ${MAX_AREA_LENGTH} characters` };
    }
  }

  // A content-type filter for the discovery categories. Only types the
  // pipeline actually writes are accepted; anything else is an invalid query.
  const rawType = req.query.type;
  let type = null;
  if (rawType !== undefined) {
    if (Array.isArray(rawType) || typeof rawType !== 'string') {
      return { error: 'type must be a single text value' };
    }
    type = rawType.trim().toLowerCase();
    if (!discovery.CONTENT_TYPES.has(type)) {
      return { error: `type must be one of: ${[...discovery.CONTENT_TYPES].join(', ')}` };
    }
  }

  const rawLimit = req.query.limit;
  const limit = rawLimit === undefined ? MAX_LIMIT : numberParam(req, 'limit');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `limit must be an integer between 1 and ${MAX_LIMIT}` };
  }

  // Pagination is offset-based over the same ranked stream. Offset 0 (the
  // default) preserves the original behaviour exactly.
  const rawOffset = req.query.offset;
  const offset = rawOffset === undefined ? 0 : numberParam(req, 'offset');
  if (!Number.isInteger(offset) || offset < 0) {
    return { error: 'offset must be a non-negative integer' };
  }

  return {
    lat,
    lng,
    near: hasLat ? { lat, lng } : null,
    radiusKm: hasLat ? radiusKm : null,
    area,
    type,
    limit,
    offset
  };
}

function cacheHeaders(res) {
  // Feed rows are public and derived from persisted content. A short shared
  // cache keeps embeds inexpensive without making a newly published item stale
  // for long; callers can request again after 60 seconds.
  res.setHeader('cache-control', 'public, max-age=60, stale-while-revalidate=300');
  res.setHeader('x-api-version', '1');
}

function handleFeed(req, res) {
  const query = readQuery(req);
  if (query.error) {
    return res.status(400).json({ error: query.error, code: 'invalid_query' });
  }

  // Public means publication === public. Never use a caller identity or expose
  // source_members/private rows through this endpoint.
  const stream = discovery.discoverableStream({
    near: query.near,
    radiusKm: query.radiusKm,
    area: query.area,
    type: query.type,
    limit: query.limit,
    offset: query.offset,
    publication: 'public'
  });
  const objects = media.enrichObjects(stream.objects);
  const articles = tea.listPublished({ limit: 4 });
  const provider = media.providerStatus();

  cacheHeaders(res);
  return res.json({
    feed: publicFeed.composePublicFeed({ objects, tea: articles, limit: query.limit }),
    meta: {
      apiVersion: '1',
      generatedAt: new Date().toISOString(),
      location: query.near
        ? { lat: query.lat, lng: query.lng, radiusKm: query.radiusKm }
        : null,
      area: query.area ?? null,
      type: query.type ?? null,
      limit: query.limit,
      offset: query.offset,
      total: stream.total,
      hasMore: query.offset + stream.objects.length < stream.total
    },
    // Keep only the public capability bit; provider internals stay server-side.
    mediaProvider: { configured: Boolean(provider.configured) }
  });
}

export function register(app) {
  app.use('/api/feed', requireFeature('feed'));
  app.use('/api/public/feed', requireFeature('feed'));

  // /api/feed is retained for the first-party client. /api/public/feed is the
  // explicit stable URL for websites, bots and other anonymous consumers.
  app.get('/api/feed', handleFeed);
  app.get('/api/public/feed', handleFeed);
}
