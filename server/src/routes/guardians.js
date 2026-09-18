// GUARDIAN ROUTES — a member's network, the shop's answer, and the sweep.
//
// All of it is session-scoped: an attribution is a claim a named person makes
// about a relationship, so an anonymous one is worthless. There is deliberately
// no payout route here — a guardian converts points through the referral rails
// (`/api/referrals/*`), which are pool-capped and finance-confirmed, so this
// module cannot become a second queue for money.
import { store } from '../store.js';
import { callerId } from '../identity.js';
import * as guardians from '../domain/guardians.js';
import * as referrals from '../domain/referrals.js';
import { requireAuthMw, requireCap } from './helpers.js';

const handle = (res, fn) => {
  try {
    return fn();
  } catch (err) {
    return res.status(err.status ?? 400).json({ error: String(err.message ?? err), code: err.code ?? null });
  }
};

/** The raw row, because the hydrated read computes owner-only economics that no
 *  authority check should ever be built on top of. */
const rawSpace = (id) => store.find('spaces', (s) => s.id === id) ?? null;

const isGuardianOf = (spaceId, userId) => Boolean(store.find('attributions', (a) =>
  a.spaceId === spaceId && a.actorId === userId && ['pending_owner', 'active'].includes(a.status)));

export function register(app) {
  // The guardian's own view. Never anybody else's: the rows contain another
  // person's claim about your shop.
  // The network, plus the CONVERSION FACTS the guardian is owed: what a point is
  // worth, the minimum, and how much the pool actually holds right now. Stated
  // where the earning is shown, because "1,240 points" without a rate is a
  // scoreboard, and a rate without the pool balance is a promise that may not be
  // payable. Assembled in the route so the two domains do not import each other.
  app.get('/api/guardians/mine', requireAuthMw, (req, res) =>
    handle(res, () => {
      const me = callerId(req);
      const network = guardians.networkFor(me);
      const pool = referrals.rewardPool();
      const balance = referrals.pointsBalance(me);
      res.json({
        network: {
          ...network,
          conversion: {
            ptsToKes: referrals.CONVERSION.ptsToKes,
            minPoints: referrals.CONVERSION.minPoints,
            pointsAvailable: balance.available,
            poolAvailableKes: pool.availableKes,
            poolBackingKes: pool.backingKes,
            note: 'Cash only ever comes from confirmed service-fee revenue. Above the pool, a conversion is refused rather than advanced.'
          }
        }
      });
    }));

  // "I introduced that shop." Stored pending: it credits nothing until the shop
  // confirms, which is the whole defence against farming.
  app.post('/api/guardians/claim', requireAuthMw, (req, res) =>
    handle(res, () => {
      const out = guardians.claimSpace({
        actorId: callerId(req),
        spaceId: (req.body ?? {}).spaceId,
        note: (req.body ?? {}).note
      });
      res.status(201).json(out);
    }));

  // The shop's side of the same fact, to the two parties only. A stranger is
  // told nothing, because who introduced a shop is not public information.
  app.get('/api/spaces/:id/guardian', requireAuthMw, (req, res) => {
    const me = callerId(req);
    const space = rawSpace(req.params.id);
    if (!space) return res.status(404).json({ error: 'no such space', code: 'not_found' });
    if (space.ownerId !== me && !isGuardianOf(space.id, me)) {
      return res.status(403).json({ error: 'only the shop or its guardian can read this', code: 'not_party' });
    }
    return res.json(guardians.forSpace(space.id));
  });

  app.post('/api/guardians/:id/confirm', requireAuthMw, (req, res) =>
    handle(res, () => res.json(guardians.confirmClaim({ actorId: callerId(req), attributionId: req.params.id }))));

  app.post('/api/guardians/:id/dispute', requireAuthMw, (req, res) =>
    handle(res, () => res.json(guardians.disputeClaim({
      actorId: callerId(req), attributionId: req.params.id, reason: (req.body ?? {}).reason
    }))));

  app.post('/api/guardians/:id/revoke', requireAuthMw, (req, res) =>
    handle(res, () => res.json(guardians.revokeClaim({
      actorId: callerId(req), attributionId: req.params.id, reason: (req.body ?? {}).reason
    }))));

  // The complaint sweep: notifies guardians, freezes a credit past the
  // threshold, escalates to operators. It does NOT take a shop down, and the
  // response says so rather than implying a moderation pipeline exists.
  app.post('/api/ops/guardians/review', (req, res) => {
    if (!requireCap(req, res, 'moderate')) return undefined;
    return handle(res, () => res.json(guardians.reviewLinks()));
  });
}
