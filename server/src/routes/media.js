// MEDIA ROUTES — provider status + editorial media library.
//
// Public: report whether an image provider is configured (honest, never
// implied). Editorial: record/approve a category image for the fallback chain.
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';
import * as media from '../domain/media.js';

export function register(app) {
  app.use('/api/media', requireFeature('media'));

  /** Provider status: which image providers are configured (usually none). */
  app.get('/api/media/status', (_req, res) => {
    res.json({ media: media.providerStatus() });
  });

  /** Record a category/editorial image (editor-only; the route gates auth). */
  app.post('/api/admin/media', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({
        image: media.recordMediaLibraryImage({
          kind: req.body?.kind,
          key: req.body?.key,
          url: req.body?.url,
          alt: req.body?.alt ?? null,
          attribution: req.body?.attribution ?? null,
          status: req.body?.status ?? 'draft'
        })
      });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
