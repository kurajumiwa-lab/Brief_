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
  const { text, sourceUrl, sourceName, title: customTitle, type: customType, category: customCat, locationName: customLoc } = req.body ?? {};
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

  let result = duplicate ? { ok: true, duplicate: true, reason: 'already captured' } : processRawItem(row.id);

  // processRawItem rejected this as "not object worthy". For an EXPLICIT
  // manual save the words are still kept: the client's preview and the
  // server's extractor can disagree, and silently discarding text someone
  // just typed is worse than keeping it. What is NOT kept is the pretence.
  //
  // The row used to claim 0.85 extraction confidence over text from which
  // nothing had been extracted, and to publish itself straight to the
  // anonymous public feed -- while an object-worthy capture from this very
  // source took the source's own default. It now records the confidence
  // extraction actually earned, says what it did and did not find, and
  // takes the same publication default as its sibling branch.
  if (!duplicate && !result.created && !result.merged) {
    const title = (customTitle && String(customTitle).trim()) ||
      (result.fields?.title) ||
      String(text).split('\n')[0].replace(/^[^A-Za-z0-9]+/, '').slice(0, 80) ||
      'Captured Post';
    const type = customType || result.fields?.type || 'knowledge';
    const category = customCat || result.fields?.categories?.[0] || (type === 'knowledge' ? 'Note' : 'Post');
    const locationName = customLoc || result.fields?.locationName || null;

    const found = result.fields ? Object.keys(result.fields) : [];
    const extractedConfidence = Number.isFinite(result.confidence) ? result.confidence : 0;
    const evidence = found.length
      ? `manual capture, kept as written. Extraction found only: ${found.join(', ')}.`
      : 'manual capture, kept as written. No structured fields were extracted.';
    const metadata = result.fields ? { ...result.fields } : {};
    // Fields not established are named as unknown rather than omitted, so a
    // reader can tell "not stated" from "not asked" -- the same rule the
    // pipeline branch follows.
    const unknown = ['dateText', 'timeRange', 'locationName', 'price']
      .filter((k) => metadata[k] === undefined);
    if (unknown.length) metadata.unknownFields = unknown;

    const object = store.insert('objects', {
      id: newId('obj'),
      type,
      title,
      category,
      summary: String(text).replace(/\s+/g, ' ').trim().slice(0, 240),
      locationName,
      metadata,
      isFixture: false,
      publication: source.accessType === 'public' ? 'public' : 'source_members',
      verificationStatus: 'unverified',
      extractionConfidence: extractedConfidence,
      extractionEvidence: evidence,
      createdAt: now(),
      updatedAt: now()
    });

    store.insert('objectSources', {
      id: newId('osrc'),
      objectId: object.id,
      sourceId: source.id,
      rawItemId: row.id,
      sourceExternalId: row.externalId,
      sourceMessageId: row.messageId,
      sourcePublishedAt: row.publishedAt,
      sourceAuthor: row.author,
      sourceRetrievedAt: row.retrievedAt,
      sourceUrl: row.rawUrl,
      sourceConfidence: source.confidence ?? 0.5,
      extractionConfidence: extractedConfidence,
      createdAt: now()
    });

    store.update('rawItems', row.id, {
      processingStatus: 'processed',
      objectId: object.id,
      rejectionReason: null
    });

    result = { ok: true, created: true, objectId: object.id, object };
  }

  // The route's own contract says the object is attributed to the caller via
  // `capturedBy`. For captures that entered through the shared manual source
  // this stamp was missing, so the 'confirmed' notification (and the
  // capturer-governs rule) silently found nobody to attach to. Stamped ONLY
  // on objects this request created -- a duplicate belongs to whoever
  // captured it first.
  if (!duplicate && result?.objectId) {
    const stamped = store.update('objects', result.objectId, { capturedBy: callerId(req) });
    if (result.object) result.object = stamped;
  }

  res.json({ ok: true, rawItemId: row.id, duplicate, result });
});
}

