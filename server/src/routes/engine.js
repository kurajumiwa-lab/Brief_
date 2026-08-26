// ---------------------------------------------------------------------------
// ENGINE ROUTES — the four premium surfaces over one architectural layer:
//
//   GET  /api/engine/status            tier + guardrail + router + version
//   POST /api/engine/sync              run the pipeline (tier-rate-guarded)
//   GET  /api/engine/routes            list routing rules (owner-scoped)
//   POST /api/engine/routes            create (tier cap enforced)
//   DELETE /api/engine/routes/:id      delete (owner-scoped)
//   POST /api/engine/routes/:id/test   dispatch a signed test payload
//   GET  /api/engine/deliveries        the dispatch ledger (recent first)
//   POST /api/engine/tier              upgrade attempt — honest refusal
//
// GUARDRAILS ARE SERVER-AUTHORITATIVE: the sync heartbeat is refused when it
// runs faster than the caller's tier allows (429 + retryAfterMs), and routing
// routes are capped per tier at creation. The client can only project these.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { callerId } from '../identity.js';
import { requireAuth, now, recordError } from './helpers.js';
import { requireFeature } from '../features.js';
import * as sync from '../domain/engine/sync.js';
import * as router from '../domain/engine/router.js';
import * as tiers from '../domain/engine/tiers.js';

const LAST_SYNC_TTL_MS = 10 * 60 * 1000; // forget idle callers after 10 min

export function register(app) {
  app.use('/api/engine', requireFeature('engine'));

  // --- status ---------------------------------------------------------------

  app.get('/api/engine/status', (req, res) => {
    const me = callerId(req);
    const manifest = sync.computeManifest({ includeRows: false });
    const guard = me ? tiers.guardrailFor(me) : null;
    res.json({
      engine: 'brief.engine/1',
      version: manifest.version,
      watermark: manifest.watermark,
      collections: Object.fromEntries(
        Object.entries(manifest.collections).map(([k, v]) => [k, v.count])
      ),
      guardrail: guard,
      router: router.routerStatus(),
      billingConfigured: false
    });
  });

  // --- the sync pipeline ------------------------------------------------------

  app.post('/api/engine/sync', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const guard = tiers.guardrailFor(me);

      // TIER GUARDRAIL: the heartbeat may not run faster than the tier allows.
      // The first beat is always allowed; a too-soon beat is refused with the
      // exact wait, so the client engine can schedule honestly.
      const last = store.filter('engineSyncs', (s) => s.callerId === me)
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
      if (last) {
        const age = Date.now() - new Date(last.at).getTime();
        if (age >= 0 && age < guard.caps.syncIntervalMs) {
          const retryAfterMs = guard.caps.syncIntervalMs - age;
          return res.status(429).json({
            error: 'sync interval guardrail',
            code: 'tier_interval',
            tier: guard.tier,
            retryAfterMs,
            lastSyncAt: last.at
          });
        }
      }

      const result = sync.runSync({ clientManifest: req.body?.manifest ?? null });

      // Audit trail: one row per beat, with the REAL timings + delta counts.
      store.insert('engineSyncs', {
        id: newId('esy'),
        callerId: me,
        tier: guard.tier,
        at: now(),
        inSync: result.inSync,
        deltaRows: result.deltaRows,
        stages: result.stages.map((s) => ({ id: s.id, ms: s.ms, detail: s.detail }))
      });
      // Prune idle caller rows so the audit stays bounded.
      const cutoff = new Date(Date.now() - LAST_SYNC_TTL_MS).toISOString();
      for (const s of store.filter('engineSyncs', (x) => x.callerId === me && x.at < cutoff)) {
        store.remove('engineSyncs', s.id);
      }

      res.json({
        inSync: result.inSync,
        version: result.version,
        stages: result.stages,
        deltas: Object.fromEntries(
          Object.entries(result.deltas).map(([name, d]) => [
            name,
            {
              added: d.added,
              updated: d.updated,
              removed: d.removed
            }
          ])
        ),
        deltaRows: result.deltaRows,
        manifest: {
          version: result.version,
          watermark: result.manifest.watermark,
          collections: Object.fromEntries(
            Object.entries(result.manifest.collections).map(([k, v]) => [k, { count: v.count, digest: v.digest, rows: v.rows }])
          )
        },
        guardrail: guard
      });
    } catch (e) {
      recordError('engine', null, `sync failed: ${String(e.message ?? e)}`);
      res.status(500).json({ error: 'engine sync failed' });
    }
  });

  app.get('/api/engine/syncs', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const rows = store.filter('engineSyncs', (s) => s.callerId === me)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 20);
    res.json({ syncs: rows });
  });

  // --- routing rules -----------------------------------------------------------

  app.get('/api/engine/routes', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ routes: router.listRoutes({ ownerId: me }) });
  });

  app.post('/api/engine/routes', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const guard = tiers.guardrailFor(me);
      const route = router.createRoute(
        {
          ownerId: me,
          name: req.body?.name,
          match: req.body?.match ?? {},
          channels: req.body?.channels ?? []
        },
        { maxRoutes: guard.caps.maxRoutes }
      );
      res.status(201).json({ route });
    } catch (e) {
      const status = e.code === 'tier_limit' ? 403 : 400;
      res.status(status).json({ error: String(e.message ?? e), code: e.code ?? null });
    }
  });

  app.delete('/api/engine/routes/:id', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      router.deleteRoute(req.params.id, me);
      res.json({ ok: true });
    } catch (e) {
      res.status(404).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/engine/routes/:id/test', async (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    const route = store.find('engineRoutes', (r) => r.id === req.params.id);
    if (!route || route.status === 'deleted' || route.ownerId !== me) {
      return res.status(404).json({ error: 'route not found' });
    }
    // A test dispatch uses a synthetic, clearly-labelled signal so the ledger
    // is honest about what was (and was not) a real event.
    const payload = {
      engine: 'brief.engine/1',
      id: `test_${Date.now().toString(36)}`,
      type: 'route_test',
      objectId: null,
      circleId: null,
      actorId: me,
      value: null,
      at: now()
    };
    const results = [];
    for (const channel of route.channels) {
      const r = await router.dispatchToChannel(channel, payload);
      // Attribute the ledger row to this route so the owner sees their own
      // test dispatches alongside real ones.
      if (r.delivery) store.update('engineDeliveries', r.delivery.id, { routeId: route.id });
      results.push(r);
    }
    res.json({
      ok: results.some((r) => r.ok),
      results: results.map((r) => ({
        channel: r.delivery?.channel,
        target: r.delivery?.target,
        status: r.delivery?.status,
        error: r.delivery?.error ?? null
      }))
    });
  });

  app.get('/api/engine/deliveries', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    // Owner-scoped: only deliveries from this caller's routes.
    const mine = new Set(router.listRoutes({ ownerId: me }).map((r) => r.id));
    const rows = router.listDeliveries({ limit: 200 })
      .filter((d) => d.routeId == null ? false : mine.has(d.routeId));
    res.json({ deliveries: rows.slice(0, 50) });
  });

  // --- the dynamic ticket bar (Package 3) --------------------------------------
  //
  // Derives the caller's ACTIVE event entry from real registration rows:
  // a ticket code, an entry state, and honest DELTAS (the campaign record
  // changed after the ticket was issued -> an inline alert, not a bulk email).

  app.get('/api/engine/ticket-bar', (req, res) => {
    const me = callerId(req);
    if (!me) return res.json({ active: false, reason: 'anonymous' });
    try {
      const regs = store.filter(
        'registrations',
        (r) => (r.userId === me || r.attendeeRef === me) &&
               (r.status === 'registered' || r.status === 'checked_in')
      );
      const candidates = [];
      for (const reg of regs) {
        const campaign = store.find('campaigns', (c) => c.id === reg.campaignId);
        if (!campaign) continue;
        if (!['published', 'live'].includes(campaign.status)) continue;
        candidates.push({ reg, campaign });
      }
      if (candidates.length === 0) return res.json({ active: false });

      // Nearest upcoming first; a checked-in or live event wins outright.
      candidates.sort((a, b) => {
        const rank = (x) => (x.reg.status === 'checked_in' ? 0 : x.campaign.status === 'live' ? 1 : 2);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        return String(a.campaign.startsAt ?? a.campaign.createdAt).localeCompare(
          String(b.campaign.startsAt ?? b.campaign.createdAt)
        );
      });
      const { reg, campaign } = candidates[0];

      // Deltas: what changed on the event after this ticket was issued.
      const deltas = [];
      if (campaign.updatedAt && reg.createdAt && campaign.updatedAt > reg.createdAt) {
        deltas.push({ kind: 'details_updated', at: campaign.updatedAt });
      }

      res.json({
        active: true,
        ticket: {
          eventTitle: campaign.title,
          ticketCode: reg.ticketCode,
          registrationId: reg.id,
          entryState: reg.status === 'checked_in' ? 'checked-in' : campaign.status === 'live' ? 'active' : 'upcoming',
          startsAt: campaign.startsAt ?? null,
          checkedIn: reg.status === 'checked_in'
        },
        deltas
      });
    } catch (e) {
      recordError('engine', null, `ticket-bar failed: ${String(e.message ?? e)}`);
      res.json({ active: false, reason: 'error' });
    }
  });

  // --- tier -------------------------------------------------------------------

  app.post('/api/engine/tier', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const attempt = tiers.requestUpgrade(me, req.body?.tier);
      if (!attempt.ok && attempt.reason === 'authentication required') {
        return res.status(401).json(attempt);
      }
      // The honest answer today is a 402-ish refusal: Payment Required, but
      // with the full picture rather than a paywall wall.
      res.status(402).json(attempt);
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
