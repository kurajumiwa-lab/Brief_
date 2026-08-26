// TEA ROUTES — public reading + editorial workflow (Tea Desk).
//
// Public: list published articles, read one by slug. No unpublished article is
// ever reachable here (domain.getBySlug / listPublished enforce it).
// Editorial: create/edit/transition. Gated by requireAuth; publishing is an
// explicit, authorised act, never available to an anonymous consumer.
import { callerId } from '../identity.js';
import * as tea from '../domain/tea.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/tea', requireFeature('tea'));
  app.use('/api/admin/tea', requireFeature('tea'));

  /** Public: published, ranked Tea. Category/location filters live here. */
  app.get('/api/tea', (req, res) => {
    res.json({
      tea: tea.listPublished({
        category: req.query.category ?? null,
        location: req.query.location ?? null,
        limit: Number(req.query.limit) || 20
      }),
      categories: tea.CATEGORIES
    });
  });

  /** The design vocabulary, so the editor renders presets from the server.
   *  Registered BEFORE /:slug so it is not captured as a slug. */
  app.get('/api/tea-design', (_req, res) => {
    res.json({ themes: tea.THEMES, layouts: tea.LAYOUTS, defaults: tea.DEFAULT_DESIGN });
  });

  /** Public: one article by slug (published only). Carries the viewer's own
   *  like state when they are signed in, so the reader renders honestly. */
  app.get('/api/tea/:slug', (req, res) => {
    const a = tea.getBySlug(req.params.slug, { viewerId: callerId(req) });
    if (!a) return res.status(404).json({ error: 'article not found' });
    res.json({ article: a });
  });

  // --- Likes (the public rating) --------------------------------------------
  // A like is a real recorded act by a signed-in reader; the count is derived
  // from the rows on every read, so it can never drift from the records.

  app.post('/api/tea/:id/like', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json(tea.likeArticle(req.params.id, me));
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });

  app.delete('/api/tea/:id/like', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json(tea.unlikeArticle(req.params.id, me));
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });



  // --- Tea Desk (editorial workflow) ----------------------------------------

  /** Full editorial list, including drafts (for the desk). */
  app.get('/api/admin/tea', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ articles: tea.listAll({ status: req.query.status ?? null }) });
  });

  /** Create a draft (or a ready article) — editor only. */
  app.post('/api/admin/tea', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const article = tea.createArticle({ ...req.body, author: req.body?.author ?? null });
      res.status(201).json({ article });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Edit an article. */
  app.patch('/api/admin/tea/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ article: tea.updateArticle(req.params.id, req.body ?? {}) });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });

  /** Drive a status transition: submit/approve/publish/schedule/…/archive. */
  app.post('/api/admin/tea/:id/:action', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json({ article: tea.transition(req.params.id, req.params.action) });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(/not found/.test(msg) ? 404 : 400).json({ error: msg });
    }
  });
}
