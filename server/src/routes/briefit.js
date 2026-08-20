// BRIEFIT ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import crypto from 'node:crypto';
import { store, newId } from '../store.js';
import { callerId, canGovernObject } from '../identity.js';
import { storeRawItem, processRawItem, previewText } from '../pipeline/ingest.js';
import { requireAuth, now } from './helpers.js';

import { requireFeature } from '../features.js';

export function register(app) {
app.use('/api/brief-it', requireFeature('briefit'));
// --- Brief It / manual (spec 16-17) ------------------------------------------

/** Preview only. Nothing is written -- the user decides (spec 16). */
/** AUTHORIZATION: requires an identity. Parsing only, but it is not public. */

app.post('/api/brief-it/preview', (req, res) => {
  if (!requireAuth(req, res)) return;
  const { text } = req.body ?? {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });
  res.json({ ok: true, preview: previewText(String(text)) });
});


/** Explicit save. Only now does anything enter the graph. */
/**
 * AUTHORIZATION: requires an identity. SELF-SCOPED -- the captured object is
 * attributed to the caller via `capturedBy`, which is what later authorises
 * them (and only them) to publish it.
 */

app.post('/api/brief-it/save', (req, res) => {
  if (!requireAuth(req, res)) return;
  const { text, sourceUrl, sourceName } = req.body ?? {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });

  let source = store.find('sources', (s) => s.type === 'manual' && s.name === (sourceName || 'Captured by you'));
  if (!source) {
    source = store.insert('sources', {
      id: newId('src'),
      name: sourceName || 'Captured by you',
      type: 'manual',
      platform: 'manual',
      url: sourceUrl ?? null,
      externalId: null,
      accessType: 'manual',
      connectionStatus: 'connected',
      confidence: 0.4,
      lastSyncedAt: now(),
      lastMessageAt: now(),
      createdAt: now(),
      updatedAt: now()
    });
  }

  // The capturer holds a membership on their own manual source. Without this
  // the objects it produces have provenance but no governing member, so
  // canGovernObject() would (correctly) refuse to let anyone publish them --
  // including the person who captured them.
  if (!store.find('sourceMemberships', (m) => m.sourceId === source.id && m.userId === callerId(req))) {
    store.insert('sourceMemberships', {
      id: newId('mem'),
      userId: callerId(req),
      sourceId: source.id,
      membershipStatus: 'owner',
      accessGranted: true,
      accessMethod: 'captured',
      connectedAt: now()
    });
  }

  const { row, duplicate } = storeRawItem({
    sourceId: source.id,
    externalId: `manual:${crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 16)}`,
    messageId: null,
    author: null,
    text: String(text),
    media: [],
    publishedAt: now(),
    rawUrl: sourceUrl ?? null
  });

  const result = duplicate ? { ok: true, duplicate: true, reason: 'already captured' } : processRawItem(row.id);
  res.json({ ok: true, rawItemId: row.id, duplicate, result });
});
}

