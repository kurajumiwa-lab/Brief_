// OBJECTS ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { store } from '../store.js';
import { callerId, authStatus, canGovernObject } from '../identity.js';
import * as discovery from '../domain/discovery.js';
import * as trust from '../domain/trust.js';
import * as signals from '../domain/signal.js';
import * as notifications from '../domain/notifications.js';
import * as campaigns from '../domain/campaign.js';
import { requireAuth, CURRENT_USER } from './helpers.js';

import { requireFeature } from '../features.js';

export function register(app) {
app.use('/api/objects', requireFeature('objects'));
app.use('/api/notifications', requireFeature('objects'));
// --- Objects + provenance (spec 4, 33, 35) -----------------------------------


app.get('/api/objects', (req, res) => {
  const { publication } = req.query;
  const nearLat = req.query.lat !== undefined ? Number(req.query.lat) : null;
  const nearLng = req.query.lng !== undefined ? Number(req.query.lng) : null;
  const radiusKm = req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : null;

  // Ranked discovery when a location is given (or always, for freshness/trust).
  const near = nearLat !== null && nearLng !== null && Number.isFinite(nearLat) && Number.isFinite(nearLng)
    ? { lat: nearLat, lng: nearLng }
    : null;
  const useRanking = near || req.query.rank === '1';

  let objects;
  if (useRanking) {
    objects = discovery.discoverable({
      near: near && radiusKm ? near : null,
      radiusKm: near && radiusKm ? radiusKm : null,
      limit: req.query.limit !== undefined ? Number(req.query.limit) : 50
    });
    if (publication) objects = objects.filter((o) => o.publication === publication);
  } else {
    objects = store.all('objects');
    if (publication) objects = objects.filter((o) => o.publication === publication);
  }

  const enriched = objects.map((o) => {
    const provenance = store.filter('objectSources', (s) => s.objectId === o.id).map((s) => {
      const src = store.find('sources', (x) => x.id === s.sourceId);
      const membership = src
        ? store.find('sourceMemberships', (m) => m.sourceId === src.id && m.userId === CURRENT_USER)
        : null;
      return {
        sourceId: s.sourceId,
        sourceName: src?.name ?? 'Unknown source',
        sourceType: src?.type ?? null,
        platform: src?.platform ?? null,
        accessType: src?.accessType ?? null,
        sourceUrl: s.sourceUrl,
        sourcePublishedAt: s.sourcePublishedAt,
        sourceAuthor: s.sourceAuthor,
        sourceRetrievedAt: s.sourceRetrievedAt,
        sourceConfidence: s.sourceConfidence,
        extractionConfidence: s.extractionConfidence,
        userHasAccess: Boolean(membership?.accessGranted)
      };
    });
    const rels = store.filter('relationships', (r) => r.sourceId === o.id).map((r) => ({
      verb: r.verb,
      targetId: r.targetId,
      target: store.find('objects', (t) => t.id === r.targetId)?.title ?? null
    }));
    return {
      ...o,
      provenance,
      relationships: rels,
      sourceCount: new Set(provenance.map((p) => p.sourceId)).size,
      verificationStatus: trust.verificationLevel(o.id),
      confirmationCount: trust.confirmationCount(o.id)
    };
  });

  res.json({ objects: enriched });
});


// --- Trust & integrity ------------------------------------------------------

/** Confirm an object as accurate (idempotent per actor). */

app.post('/api/objects/:id/confirm', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { confirmation, reused } = trust.confirmObject(req.params.id, me);
    if (!reused) {
      signals.emitSignal({ type: 'object_confirmed', actorId: me, objectId: req.params.id, metadata: { objectId: req.params.id } });
      // Tell the contributor their report is gaining corroboration — a real,
      // derived notification, not a broadcast.
      const object = store.find('objects', (o) => o.id === req.params.id);
      if (object?.capturedBy && object.capturedBy !== me) {
        notifications.notify(object.capturedBy, {
          kind: 'confirmed',
          title: 'Someone confirmed your information',
          body: `"${String(object.title).slice(0, 60)}" now has ${trust.confirmationCount(req.params.id)} confirmation${trust.confirmationCount(req.params.id) === 1 ? '' : 's'}.`,
          objectId: req.params.id
        });
      }
    }
    res.status(reused ? 200 : 201).json({ confirmation, reused, verificationStatus: trust.verificationLevel(req.params.id), confirmationCount: trust.confirmationCount(req.params.id) });
  } catch (e) {
    res.status(404).json({ error: String(e.message ?? e) });
  }
});


/** Report an object as wrong/spam/offensive (a request for review, not a removal). */

app.post('/api/objects/:id/report', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { report, reused } = trust.reportObject({
      objectId: req.params.id, actorId: me, reason: req.body?.reason ?? 'wrong', note: req.body?.note ?? null
    });
    if (!reused) {
      signals.emitSignal({ type: 'object_reported', actorId: me, objectId: req.params.id, metadata: { objectId: req.params.id, reason: report.reason } });
    }
    res.status(reused ? 200 : 201).json({ report, reused });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});


/** Record a view (engagement signal). Rate-limited; a view is a real event. */

app.post('/api/objects/:id/view', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  if (!store.find('objects', (o) => o.id === req.params.id)) return res.status(404).json({ error: 'object not found' });
  signals.emitSignal({ type: 'object_viewed', actorId: me, objectId: req.params.id, metadata: { objectId: req.params.id } });
  res.json({ ok: true });
});


// --- Notifications (in-app inbox) -------------------------------------------


app.get('/api/notifications', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({
    notifications: notifications.listNotifications(me, { unreadOnly: req.query.unread === '1' }),
    unread: notifications.unreadCount(me)
  });
});



app.post('/api/notifications/read', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  if (req.body?.all) {
    res.json(notifications.markAllRead(me));
    return;
  }
  const n = notifications.markRead(me, req.body?.id);
  if (!n) return res.status(404).json({ error: 'notification not found' });
  res.json({ notification: n });
});




/**
 * A single object. Respects the same visibility rule the list route applies:
 * a private object is only readable by someone with granted membership on one
 * of its sources. Returns 404 (not 403) so existence is not disclosed.
 */

app.get('/api/objects/:id', (req, res) => {
  const object = store.find('objects', (o) => o.id === req.params.id);
  if (!object || object.publication === 'discarded') {
    return res.status(404).json({ error: 'object not found' });
  }
  if (object.publication !== 'public' && !campaigns.mayAttachObject(callerId(req), object)) {
    return res.status(404).json({ error: 'object not found' });
  }
  res.json({ object });
});



app.post('/api/objects/:id/publish', (req, res) => {
  const object = store.find('objects', (o) => o.id === req.params.id);
  if (!object) return res.status(404).json({ error: 'object not found' });

  // SECURITY (IDOR). This route previously changed ANY object's visibility for
  // ANY caller, so an anonymous request could flip a private object to public.
  // Authority derives from the existing provenance chain -- see
  // canGovernObject() -- rather than a new owner column.
  if (!canGovernObject(store, req, object.id)) {
    return res.status(403).json({
      error: 'only a member of a source this object came from may change its visibility'
    });
  }

  const { publication } = req.body ?? {};
  const VALID = ['private', 'source_members', 'public', 'discarded'];
  if (!VALID.includes(publication)) {
    return res.status(400).json({ error: `publication must be one of ${VALID.join(', ')}` });
  }
  res.json({ object: store.update('objects', object.id, { publication }) });
});



app.get('/api/raw-items', (req, res) => {
  const { sourceId, status } = req.query;
  let items = store.all('rawItems');
  if (sourceId) items = items.filter((r) => r.sourceId === sourceId);
  if (status) items = items.filter((r) => r.processingStatus === status);
  res.json({ rawItems: items });
});



app.get('/api/errors', (_req, res) => res.json({ errors: store.all('errors').slice(-50) }));

app.get('/api/auth/status', (_req, res) => {
  res.json(authStatus());
});
}

