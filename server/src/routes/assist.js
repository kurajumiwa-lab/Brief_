// ASSIST ROUTES — AI-assisted editorial drafting (provider-gated, honest).
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';
import * as assist from '../domain/assist.js';

export function register(app) {
  app.use('/api/assist', requireFeature('assist'));

  /** Provider status: whether an AI provider is configured (usually none). */
  app.get('/api/assist/status', (_req, res) => {
    res.json({ assist: assist.providerStatus() });
  });

  /**
   * Ask for editorial assistance (cluster/summarise/headlines/tags/image
   * query). Authenticated. Fails closed with a named reason when no provider
   * is configured — never a fabricated suggestion.
   */
  app.post('/api/assist', async (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const result = await assist.assist(req.body?.task, req.body?.input);
    if (!result.ok) return res.status(503).json(result);
    res.json(result);
  });
}
