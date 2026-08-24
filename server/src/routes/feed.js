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

  const rawLimit = req.query.limit;
  const limit = rawLimit === undefined ? MAX_LIMIT : numberParam(req, 'limit');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { error: `limit must be an integer between 1 and ${MAX_LIMIT}` };
  }

  return {
    lat,
    lng,
    near: hasLat ? { lat, lng } : null,
    radiusKm: hasLat ? radiusKm : null,
    limit
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
  const objects = media.enrichObjects(
    discovery.discoverable({
      near: query.near,
      radiusKm: query.radiusKm,
      limit: query.limit,
      publication: 'public'
    })
  );
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
      limit: query.limit
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
