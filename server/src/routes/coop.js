// MSHIKANO ROUTES — the cooperation network surface (/api/mshikano/*).
// The app gate (index.js) already requires a session for every /api route
// outside the allowlist; these routes still name their caller explicitly.
import * as coop from '../domain/coop.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/mshikano', requireFeature('mshikano'));

  /** Post a HAVE / NEED / CAN HELP / LOOKING FOR. */
  app.post('/api/mshikano/posts', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const post = coop.createPost(me, req.body ?? {});
      res.status(201).json({ post: coop.postView(post, me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** The stream. Filters are honest: no matches -> empty array, never padding. */
  app.get('/api/mshikano/posts', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const rows = coop.listPosts({
      intent: req.query?.intent ?? null,
      q: req.query?.q ?? null,
      county: req.query?.county ?? null,
      mine: req.query?.mine === '1' ? me : null
    }, me);
    res.json({ posts: rows });
  });

  app.delete('/api/mshikano/posts/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      coop.removePost(me, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(e.message === 'post not found' ? 404 : 403).json({ error: String(e.message ?? e) });
    }
  });

  /** Complementary matches for one post, each with its reasons. */
  app.get('/api/mshikano/posts/:id/matches', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const matches = coop.matchesForPost(req.params.id, me);
      res.json({ matches });
    } catch (e) {
      res.status(e.message === 'post not found' ? 404 : 400).json({ error: String(e.message ?? e) });
    }
  });

  /** "We worked together" — a proposal until the partner confirms. */
  app.post('/api/mshikano/cooperations', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = coop.proposeCooperation(me, {
        postId: req.body?.postId ?? null,
        partnerUserId: req.body?.partnerUserId ?? null,
        summary: req.body?.summary ?? null
      });
      res.status(201).json({ cooperation: row });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/mshikano/cooperations', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json(coop.listCooperations(me));
  });

  app.post('/api/mshikano/cooperations/:id/respond', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = coop.respondToCooperation(me, req.params.id, Boolean(req.body?.accept));
      res.json({ cooperation: row });
    } catch (e) {
      const msg = String(e.message ?? e);
      res.status(msg.includes('only the named partner') ? 403 : msg.includes('not found') ? 404 : 400).json({ error: msg });
    }
  });

  app.post('/api/mshikano/cooperations/:id/recommend', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = coop.recommendPartner(me, req.params.id, req.body?.note ?? '');
      res.json({ cooperation: row });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** My cooperation graph: helped / received / repeat partners. */
  app.get('/api/mshikano/graph', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json(coop.graphFor(me));
  });

  /** Trust = evidence counted from confirmed rows. Public to any member. */
  app.get('/api/mshikano/trust/:userId', (req, res) => {
    requireAuth(req, res);
    if (res.writableEnded) return;
    res.json(coop.trustFor(req.params.userId));
  });

  /** The killer query: "who can help me with X?" — grouped, real rows only. */
  app.get('/api/mshikano/who-can-help', (req, res) => {
    requireAuth(req, res);
    if (res.writableEnded) return;
    try {
      res.json(coop.whoCanHelp(req.query?.q ?? ''));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
