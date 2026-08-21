// FEED ROUTES — the composed home feed (one magazine, deduped, ranked).
import { store } from '../store.js';
import * as discovery from '../domain/discovery.js';
import * as tea from '../domain/tea.js';
import * as media from '../domain/media.js';
import * as feed from '../domain/feed.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/feed', requireFeature('feed'));

  app.get('/api/feed', (req, res) => {
    const near = req.query.lat !== undefined && req.query.lng !== undefined
      ? { lat: Number(req.query.lat), lng: Number(req.query.lng) }
      : null;
    const radiusKm = req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : null;

    const objects = media.enrichObjects(
      discovery.discoverable({
        near: near && radiusKm ? near : null,
        radiusKm: near && radiusKm ? radiusKm : null,
        limit: 50
      })
    );
    const teaArticles = tea.listPublished({ limit: 4 });

    res.json({
      feed: feed.composeFeed({ objects, tea: teaArticles }),
      mediaProvider: media.providerStatus()
    });
  });
}
