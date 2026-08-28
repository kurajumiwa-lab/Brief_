// TRIAGE ROUTES — the one "waiting on you" queue.
//
// Deliberately its own namespace. `/api/inbox` already means the per-contact
// conversation projection (see domain/inbox.js), and overloading it would
// silently change the meaning of an existing contract.
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';
import * as triage from '../domain/triage.js';

export function register(app) {
  app.use('/api/triage', requireFeature('triage'));

  /**
   * GET /api/triage
   *
   * Everything currently blocked on the caller: the circle tasks they hold,
   * the orders on their shelf, the events they are running, and the inbound
   * messages awaiting review.
   *
   * Auth is required and is not optional: the queue is a per-person answer,
   * so an anonymous caller has no queue -- not an empty one they might mistake
   * for "nothing is waiting".
   */
  app.get('/api/triage', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;

    // The look-ahead window decides whether an event counts as imminent. It is
    // caller-supplied but clamped: an unbounded window would let a client ask
    // for the whole future, and a zero window would mean "already started".
    const raw = Number(req.query.withinHours);
    const withinHours = Number.isFinite(raw) ? Math.min(336, Math.max(1, raw)) : 48;

    res.json(triage.waitingFor(me, { withinHours }));
  });
}
