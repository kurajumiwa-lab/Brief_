// ---------------------------------------------------------------------------
// LOCAL ACTIVITY GRAPH ROUTES
//
// Public, like entity pages: location pages are shareable (/explore/kilimani)
// and expose only the public projection. Nearby honours real coordinates only.
// The object graph endpoint is a public read over public objects (404 for
// anything else — no private row ever crosses this boundary).
// ---------------------------------------------------------------------------
import * as graph from '../domain/graph.js';
import { requireFeature } from '../features.js';

function textParam(value, max) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length <= max ? s : null;
}

export function register(app) {
  app.use('/api/locations', requireFeature('objects'));
  app.use('/api/graph', requireFeature('objects'));
  app.use('/api/nearby', requireFeature('objects'));

  /** The explore index: every location with live content, most active first. */
  app.get('/api/locations', (req, res) => {
    res.json({ locations: graph.locationIndex(new Date()) });
  });

  /** A public location page: hierarchy + activity + sections + map data. */
  app.get('/api/locations/:name', (req, res) => {
    const name = String(req.params.name ?? '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: 'location name required' });
    const now = new Date();
    const activity = graph.locationActivity(name, now);
    if (!activity) return res.status(404).json({ error: 'unknown location' });
    const sections = graph.locationSections(name, now);
    const nearby = graph.nearbyForLocation(name, 10, now);
    res.json({
      location: activity.location,
      activity: {
        counts: activity.counts,
        happeningNow: activity.activity.happeningNow,
        today: activity.activity.today,
        comingUp: activity.activity.comingUp,
        latest: activity.activity.latest
      },
      sections: sections ?? {},
      map: activity.map,
      nearby
    });
  });

  /** Related content for one object — the detail-page graph. */
  app.get('/api/graph/object/:id', (req, res) => {
    const id = String(req.params.id ?? '').slice(0, 120);
    const result = graph.objectGraph(id, new Date());
    if (!result) return res.status(404).json({ error: 'object not found' });
    res.json(result);
  });

  /** Nearby discovery — distance only over genuinely stored coordinates. */
  app.get('/api/nearby', (req, res) => {
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : null;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : null;
    const radiusKm = req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : 10;
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 200) {
      return res.status(400).json({ error: 'invalid radiusKm' });
    }
    if (req.query.area) {
      const name = textParam(req.query.area, 80);
      if (!name) return res.status(400).json({ error: 'invalid area' });
      return res.json(graph.nearbyForLocation(name, radiusKm, new Date()));
    }
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    res.json(graph.nearbyObjects({ lat, lng, radiusKm }, new Date()));
  });
}
