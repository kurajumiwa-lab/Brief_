import * as moderation from '../domain/spaceModeration.js';
import { requireCap } from './helpers.js';

// Deliberately separate from object/source trust reports: those operations have
// different effects. Never route a public-page report into account moderation.
export function register(app) {
  const handle = fn => (req, res) => {
    const actorId = requireCap(req, res, 'moderate');
    if (!actorId) return;
    res.setHeader('Cache-Control', 'no-store');
    try { res.json(fn(req, actorId)); }
    catch (error) { res.status(error.status ?? 500).json({ error: error.status ? error.message : 'Moderation could not be saved. Retry with the same Idempotency-Key.', code: error.code ?? 'moderation_write_failed' }); }
  };
  app.get('/api/ops/space-reports', handle((_req, actorId) => moderation.moderationQueue(actorId)));
  app.post('/api/ops/space-reports/:id/review', handle((req, actorId) => moderation.reviewReport(req.params.id, {
    actorId, outcome: req.body?.outcome, reason: req.body?.reason, idempotencyKey: req.get('Idempotency-Key')
  })));
  app.post('/api/ops/spaces/:id/reinstate-page', handle((req, actorId) => moderation.reinstatePage(req.params.id, {
    actorId, holdId: req.body?.holdId, reason: req.body?.reason, idempotencyKey: req.get('Idempotency-Key')
  })));
}
