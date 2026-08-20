// PEOPLE ROUTES — the person entity (§4.4).
//
// Public/self: a caller can see their own person and assert their own aliases
// (verified by the fact that they ARE the authenticated caller).
// Operator: merge is an explicit admin act, not something a consumer does.
import { callerId } from '../identity.js';
import * as person from '../domain/person.js';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';

export function register(app) {
  app.use('/api/person', requireFeature('people'));
  /** The caller's own person — find-or-create, so it always exists. */
  app.get('/api/person/me', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ person: person.ensurePersonForUser(me) });
  });

  /** A person by id. Operator-readable; existence is not disclosed widely. */
  app.get('/api/person/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const p = person.getPerson(req.params.id);
    if (!p) return res.status(404).json({ error: 'person not found' });
    res.json({ person: p });
  });

  /** A person's assembled timeline across the records Brief holds. */
  app.get('/api/person/:id/timeline', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const t = person.timeline(req.params.id, { limit: Number(req.query.limit) || 50 });
    if (!t) return res.status(404).json({ error: 'person not found' });
    res.json(t);
  });

  /**
   * Assert an alias. SELF-SCOPED: a caller may only bind an alias to their OWN
   * person (the one holding their user alias). An alias is marked verified
   * because the caller is asserting it about themselves — the one case that
   * does not require operator approval.
   */
  app.post('/api/person/me/aliases', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const my = person.ensurePersonForUser(me);
    try {
      const alias = person.linkAlias(my.id, req.body?.kind, req.body?.value, {
        verified: true,
        source: 'self'
      });
      res.status(201).json({ alias });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /** Operator merge: fold one person into another. Explicit, audited. */
  app.post('/api/ops/people/merge', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.json(person.mergePersons(req.body?.fromId, req.body?.intoId, me));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
