// ---------------------------------------------------------------------------
// ONBOARDING ROUTES — first-run state, the service ladder, and activation.
//
// Everything here is self-scoped: a caller reads and writes only their own
// onboarding. The one exception is `/api/onboarding/metrics`, which returns
// aggregates with no personal identifiers in them.
// ---------------------------------------------------------------------------

import * as onboarding from '../domain/onboarding.js';
import { requireAuth } from './helpers.js';

export function register(app) {
  /** The whole first-run state in one round trip: answers + derived ladder. */
  app.get('/api/onboarding', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    onboarding.ensureProfile(me);
    res.json(onboarding.stateFor(me));
  });

  /** The ladder alone — what is open, what follows what, and why. */
  app.get('/api/ladder', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ ladder: onboarding.ladderFor(me) });
  });

  /** The single segmentation question. One tap, and it is skippable. */
  app.post('/api/onboarding/goal', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      onboarding.setGoal(me, req.body?.goal);
      res.json(onboarding.stateFor(me));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e), goals: onboarding.GOALS });
    }
  });

  /** Where they are. A label the person chose or granted — never inferred. */
  app.post('/api/onboarding/place', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      onboarding.setPlace(me, req.body?.place);
      res.json(onboarding.stateFor(me));
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /**
   * A named thing the person did. The client reports the handful of steps that
   * leave no server row of their own (goal, place, first save, feed seen).
   * Unknown names are refused rather than silently stored.
   */
  app.post('/api/onboarding/event', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const row = onboarding.recordEvent(me, req.body?.name, req.body?.meta ?? {});
      res.status(201).json({ event: { name: row.name, at: row.at }, ladder: onboarding.ladderFor(me) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e), events: onboarding.EVENTS });
    }
  });

  /** Which link brought this person in (tiktok, whatsapp, x). First touch wins. */
  app.post('/api/onboarding/source', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    onboarding.setSource(me, req.body?.source);
    res.json(onboarding.stateFor(me));
  });

  /** Leave the first-run flow, by finishing it or by skipping it. */
  app.post('/api/onboarding/finish', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    onboarding.finish(me, { skipped: Boolean(req.body?.skipped) });
    res.json(onboarding.stateFor(me));
  });

  /**
   * Activation and drop-off. Scanned live, so it always matches the rows.
   * No personal identifiers: counts, a rate, and a median only.
   */
  app.get('/api/onboarding/metrics', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(onboarding.metrics());
  });
}
