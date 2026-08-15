// ---------------------------------------------------------------------------
// BRIEF INGESTION SERVER
//
// Secrets live here and only here (spec 28). The client never sees a bot
// token, an app secret or a webhook signing key -- it talks to these routes.
// ---------------------------------------------------------------------------

import express from 'express';
import crypto from 'node:crypto';
import { store, newId } from './store.js';
import { enqueue, queueStats, allow, withBackoff } from './queue.js';
import { storeRawItem, processRawItem, previewText } from './pipeline/ingest.js';
import * as telegram from './connectors/telegram.js';
import * as web from './connectors/web.js';
import * as whatsapp from './connectors/whatsapp.js';

const app = express();

// Raw body retained for webhook signature verification -- the HMAC must be
// computed over the exact bytes Meta sent, not a re-serialized object.
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use((_req, res, next) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type,x-telegram-bot-api-secret-token,x-hub-signature-256');
  res.setHeader('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
  next();
});
app.options('*', (_req, res) => res.sendStatus(204));

const now = () => new Date().toISOString();
const CURRENT_USER = 'usr_me'; // single-user deployment; auth slots in here

function recordError(scope, sourceId, message) {
  store.insert('errors', { id: newId('err'), scope, sourceId: sourceId ?? null, message, at: now() });
}

// --- Health / capabilities ---------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, at: now(), queue: queueStats() });
});

app.get('/api/capabilities', (_req, res) => {
  res.json({
    telegram: { ...telegram.capabilities, configured: telegram.isConfigured() },
    web: web.capabilities.web,
    rss: web.capabilities.rss,
    whatsapp: { ...whatsapp.capabilities, configured: whatsapp.isConfigured() },
    manual: {
      connector: 'manual',
      authenticate: 'n/a',
      receive: 'yes - pasted text',
      notes: 'Always available. The fallback for any platform Brief cannot integrate with.'
    }
  });
});

// --- Sources (spec 2) --------------------------------------------------------

app.get('/api/sources', (_req, res) => {
  const sources = store.all('sources').map((s) => {
    const raws = store.filter('rawItems', (r) => r.sourceId === s.id);
    const objs = new Set(
      store.filter('objectSources', (o) => o.sourceId === s.id).map((o) => o.objectId)
    );
    const membership = store.find(
      'sourceMemberships',
      (m) => m.sourceId === s.id && m.userId === CURRENT_USER
    );
    return {
      ...s,
      itemsProcessed: raws.filter((r) => r.processingStatus === 'processed').length,
      itemsPending: raws.filter((r) => r.processingStatus === 'pending').length,
      itemsRejected: raws.filter((r) => r.processingStatus === 'rejected').length,
      objectsCreated: objs.size,
      membership: membership ?? null
    };
  });
  res.json({ sources });
});

app.post('/api/sources', (req, res) => {
  const { name, type, url, description, accessType, externalId, ownerName } = req.body ?? {};
  const VALID = ['telegram_channel', 'telegram_group', 'whatsapp_channel', 'whatsapp_group',
                 'webpage', 'website', 'rss', 'manual', 'api', 'business', 'event_feed'];
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  if (!VALID.includes(type)) return res.status(400).json({ error: `type must be one of ${VALID.join(', ')}` });

  if (url) {
    const v = web.validateUrl(url);
    if (!v.ok) return res.status(400).json({ error: v.error });
  }

  // A source is never born "connected". Connection is proved by a connector,
  // not asserted by whoever created the row (spec 2).
  const source = store.insert('sources', {
    id: newId('src'),
    name,
    type,
    platform: type.split('_')[0],
    url: url ?? null,
    externalId: externalId ?? null,
    description: description ?? null,
    ownerName: ownerName ?? null,
    accessType: accessType ?? 'public',
    connectionStatus: type === 'manual' ? 'connected' : 'needs_authorization',
    confidence: 0.5,
    lastSyncedAt: null,
    lastMessageAt: null,
    createdAt: now(),
    updatedAt: now()
  });
  res.status(201).json({ source });
});

app.delete('/api/sources/:id', (req, res) => {
  const ok = store.remove('sources', req.params.id);
  res.json({ ok });
});

// --- Source membership (spec 3) ---------------------------------------------
// "From your groups" may only ever render from a row created here.

app.post('/api/sources/:id/membership', (req, res) => {
  const source = store.find('sources', (s) => s.id === req.params.id);
  if (!source) return res.status(404).json({ error: 'source not found' });

  const { membershipStatus, accessMethod } = req.body ?? {};
  const VALID = ['member', 'admin', 'owner', 'authorized', 'unknown'];
  if (!VALID.includes(membershipStatus)) {
    return res.status(400).json({ error: `membershipStatus must be one of ${VALID.join(', ')}` });
  }

  const existing = store.find(
    'sourceMemberships',
    (m) => m.sourceId === source.id && m.userId === CURRENT_USER
  );
  const row = existing
    ? store.update('sourceMemberships', existing.id, {
        membershipStatus,
        accessGranted: membershipStatus !== 'unknown',
        accessMethod: accessMethod ?? 'declared'
      })
    : store.insert('sourceMemberships', {
        id: newId('mem'),
        userId: CURRENT_USER,
        sourceId: source.id,
        membershipStatus,
        accessGranted: membershipStatus !== 'unknown',
        accessMethod: accessMethod ?? 'declared',
        connectedAt: now()
      });
  res.json({ membership: row });
});

// --- Telegram (spec 10-12) ---------------------------------------------------

app.get('/api/connectors/telegram/verify', async (_req, res) => {
  const result = await telegram.verify();
  if (!result.ok) return res.status(result.unconfigured ? 503 : 502).json(result);
  res.json(result);
});

app.post('/api/connectors/telegram/webhook-config', async (req, res) => {
  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ error: 'url is required' });
  let secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    secret = crypto.randomBytes(24).toString('hex');
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;
  }
  const result = await telegram.setWebhook(url, secret);
  // The secret is NOT returned to the client.
  res.status(result.ok ? 200 : 502).json({ ok: result.ok, error: result.error ?? null });
});

/**
 * Telegram push endpoint. Verifies the secret header, stores the raw item,
 * returns 200 immediately, and extracts on the queue (spec 29).
 */
app.post('/api/webhooks/telegram', (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.get('x-telegram-bot-api-secret-token');
    if (got !== secret) {
      recordError('telegram', null, 'webhook secret mismatch');
      return res.status(401).json({ error: 'bad secret token' });
    }
  }

  const gate = allow('tg-webhook', 240, 60);
  if (!gate.ok) return res.status(429).json({ error: 'rate limited' });

  const norm = telegram.normalizeUpdate(req.body ?? {});
  if (!norm) return res.json({ ok: true, ignored: 'no usable text' });

  // Resolve the source by chat id, creating it on first contact. accessType is
  // 'member_access' because the bot only sees this chat by having been added.
  let source = store.find('sources', (s) => s.externalId === String(norm.chat.id));
  if (!source) {
    source = store.insert('sources', {
      id: newId('src'),
      name: norm.chat.title || `Telegram ${norm.chat.id}`,
      type: norm.chat.type === 'channel' ? 'telegram_channel' : 'telegram_group',
      platform: 'telegram',
      url: norm.chat.username ? `https://t.me/${norm.chat.username}` : null,
      externalId: String(norm.chat.id),
      description: null,
      ownerName: null,
      accessType: norm.chat.username ? 'public' : 'member_access',
      connectionStatus: 'connected',
      confidence: 0.6,
      lastSyncedAt: now(),
      lastMessageAt: norm.publishedAt,
      createdAt: now(),
      updatedAt: now()
    });
  } else {
    store.update('sources', source.id, {
      connectionStatus: 'connected',
      lastSyncedAt: now(),
      lastMessageAt: norm.publishedAt
    });
  }

  const { row, duplicate } = storeRawItem({ ...norm, sourceId: source.id });
  if (!duplicate) enqueue(`tg:${row.id}`, () => processRawItem(row.id));

  res.json({ ok: true, rawItemId: row.id, duplicate });
});

/** Pull mode, for when no public webhook URL is available. */
app.post('/api/connectors/telegram/sync', async (req, res) => {
  const gate = allow('tg-sync', 20, 5);
  if (!gate.ok) return res.status(429).json({ error: 'rate limited', retryAfterMs: gate.retryAfterMs });

  const offset = Number(req.body?.offset ?? 0) || undefined;
  const result = await withBackoff(() => telegram.fetchUpdates(offset));
  if (!result.ok) {
    recordError('telegram', null, result.error);
    return res.status(result.unconfigured ? 503 : 502).json(result);
  }

  let stored = 0;
  let lastUpdateId = null;
  for (const update of result.updates) {
    lastUpdateId = update.update_id;
    const norm = telegram.normalizeUpdate(update);
    if (!norm) continue;
    let source = store.find('sources', (s) => s.externalId === String(norm.chat.id));
    if (!source) {
      source = store.insert('sources', {
        id: newId('src'),
        name: norm.chat.title || `Telegram ${norm.chat.id}`,
        type: norm.chat.type === 'channel' ? 'telegram_channel' : 'telegram_group',
        platform: 'telegram',
        url: norm.chat.username ? `https://t.me/${norm.chat.username}` : null,
        externalId: String(norm.chat.id),
        accessType: norm.chat.username ? 'public' : 'member_access',
        connectionStatus: 'connected',
        confidence: 0.6,
        lastSyncedAt: now(),
        lastMessageAt: norm.publishedAt,
        createdAt: now(),
        updatedAt: now()
      });
    }
    const { row, duplicate } = storeRawItem({ ...norm, sourceId: source.id });
    if (!duplicate) { enqueue(`tg:${row.id}`, () => processRawItem(row.id)); stored++; }
  }

  store.insert('syncRuns', {
    id: newId('sync'), connector: 'telegram', at: now(),
    received: result.updates.length, stored
  });
  res.json({ ok: true, received: result.updates.length, stored, nextOffset: lastUpdateId ? lastUpdateId + 1 : null });
});

// --- WhatsApp (spec 13) ------------------------------------------------------

app.get('/api/webhooks/whatsapp', (req, res) => {
  const result = whatsapp.verifySubscription(req.query);
  if (!result.ok) return res.status(result.status).send(result.error);
  res.status(200).send(String(result.challenge));
});

app.post('/api/webhooks/whatsapp', (req, res) => {
  const sig = whatsapp.verifySignature(req.rawBody ?? Buffer.from(''), req.get('x-hub-signature-256'));
  if (!sig.ok) {
    recordError('whatsapp', null, `rejected webhook: ${sig.error}`);
    return res.status(401).json({ error: sig.error });
  }

  const messages = whatsapp.normalizeWebhook(req.body ?? {});
  let stored = 0;
  for (const msg of messages) {
    let source = store.find('sources', (s) => s.externalId === `wa:${msg.phoneNumberId}`);
    if (!source) {
      source = store.insert('sources', {
        id: newId('src'),
        name: `WhatsApp Business ${msg.phoneNumberId ?? ''}`.trim(),
        type: 'business',
        platform: 'whatsapp',
        url: null,
        externalId: `wa:${msg.phoneNumberId}`,
        accessType: 'owner_authorized',
        connectionStatus: 'connected',
        confidence: 0.7,
        lastSyncedAt: now(),
        lastMessageAt: msg.publishedAt,
        createdAt: now(),
        updatedAt: now()
      });
    }
    const { row, duplicate } = storeRawItem({ ...msg, sourceId: source.id });
    if (!duplicate) { enqueue(`wa:${row.id}`, () => processRawItem(row.id)); stored++; }
  }
  res.json({ ok: true, received: messages.length, stored });
});

// --- Web + RSS (spec 14-15) --------------------------------------------------

app.post('/api/connectors/web/fetch', async (req, res) => {
  const { url, sourceId } = req.body ?? {};
  if (!url) return res.status(400).json({ error: 'url is required' });

  const gate = allow(`web:${new URL(url.startsWith('http') ? url : `https://${url}`).hostname}`, 20, 5);
  if (!gate.ok) return res.status(429).json({ error: 'rate limited for this host', retryAfterMs: gate.retryAfterMs });

  const page = await web.fetchPage(url);
  if (!page.ok) {
    recordError('web', sourceId, page.error);
    return res.status(422).json(page);
  }

  let source = sourceId ? store.find('sources', (s) => s.id === sourceId) : null;
  if (!source) {
    source = store.insert('sources', {
      id: newId('src'),
      name: page.extracted.siteName || new URL(page.finalUrl).hostname,
      type: 'webpage',
      platform: 'web',
      url: page.finalUrl,
      externalId: page.finalUrl,
      accessType: 'public',
      connectionStatus: 'connected',
      confidence: 0.5,
      lastSyncedAt: now(),
      lastMessageAt: page.extracted.publishedAt,
      createdAt: now(),
      updatedAt: now()
    });
  } else {
    store.update('sources', source.id, { connectionStatus: 'connected', lastSyncedAt: now() });
  }

  // Feed the page's own words to the same extractor every other connector uses.
  const text = [page.extracted.title, page.extracted.description, page.text]
    .filter(Boolean).join('\n');

  const { row, duplicate } = storeRawItem({
    sourceId: source.id,
    externalId: page.finalUrl,
    messageId: null,
    author: page.extracted.siteName ?? null,
    text,
    media: page.extracted.image ? [{ kind: 'image', reference: page.extracted.image }] : [],
    publishedAt: page.extracted.publishedAt,
    rawUrl: page.finalUrl
  });
  const result = duplicate ? { ok: true, duplicate: true } : processRawItem(row.id);
  res.json({ ok: true, source, page: page.extracted, robots: page.robots, rawItemId: row.id, duplicate, result });
});

app.post('/api/connectors/rss/sync', async (req, res) => {
  const { url, sourceId, limit } = req.body ?? {};
  const target = url ?? store.find('sources', (s) => s.id === sourceId)?.url;
  if (!target) return res.status(400).json({ error: 'url or a sourceId with a url is required' });

  const gate = allow(`rss:${target}`, 12, 4);
  if (!gate.ok) return res.status(429).json({ error: 'rate limited', retryAfterMs: gate.retryAfterMs });

  const feed = await web.fetchFeed(target);
  if (!feed.ok) {
    recordError('rss', sourceId, feed.error);
    return res.status(422).json(feed);
  }

  let source = sourceId ? store.find('sources', (s) => s.id === sourceId) : null;
  if (!source) {
    source = store.find('sources', (s) => s.url === target && s.type === 'rss');
  }
  if (!source) {
    source = store.insert('sources', {
      id: newId('src'),
      name: feed.feedTitle || new URL(target).hostname,
      type: 'rss',
      platform: 'rss',
      url: target,
      externalId: target,
      accessType: 'public',
      connectionStatus: 'connected',
      confidence: 0.55,
      lastSyncedAt: now(),
      lastMessageAt: null,
      createdAt: now(),
      updatedAt: now()
    });
  } else {
    store.update('sources', source.id, { connectionStatus: 'connected', lastSyncedAt: now() });
  }

  const items = feed.items.slice(0, Number(limit) || 10);
  let stored = 0;
  for (const item of items) {
    const { row, duplicate } = storeRawItem({
      sourceId: source.id,
      externalId: item.guid,
      messageId: null,
      author: feed.feedTitle ?? null,
      text: [item.title, item.description].filter(Boolean).join('\n'),
      media: [],
      publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
      rawUrl: item.link
    });
    if (!duplicate) { enqueue(`rss:${row.id}`, () => processRawItem(row.id)); stored++; }
  }

  store.insert('syncRuns', { id: newId('sync'), connector: 'rss', at: now(), received: feed.items.length, stored });
  res.json({ ok: true, source, received: feed.items.length, stored });
});

// --- Brief It / manual (spec 16-17) ------------------------------------------

/** Preview only. Nothing is written -- the user decides (spec 16). */
app.post('/api/brief-it/preview', (req, res) => {
  const { text } = req.body ?? {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });
  res.json({ ok: true, preview: previewText(String(text)) });
});

/** Explicit save. Only now does anything enter the graph. */
app.post('/api/brief-it/save', (req, res) => {
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

// --- Objects + provenance (spec 4, 33, 35) -----------------------------------

app.get('/api/objects', (req, res) => {
  const { publication } = req.query;
  let objects = store.all('objects');
  if (publication) objects = objects.filter((o) => o.publication === publication);

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
        // Drives "From your groups" -- true only with a real membership row.
        userHasAccess: Boolean(membership?.accessGranted)
      };
    });
    const rels = store.filter('relationships', (r) => r.sourceId === o.id).map((r) => ({
      verb: r.verb,
      targetId: r.targetId,
      target: store.find('objects', (t) => t.id === r.targetId)?.title ?? null
    }));
    return { ...o, provenance, relationships: rels, sourceCount: new Set(provenance.map((p) => p.sourceId)).size };
  });

  res.json({ objects: enriched });
});

app.post('/api/objects/:id/publish', (req, res) => {
  const object = store.find('objects', (o) => o.id === req.params.id);
  if (!object) return res.status(404).json({ error: 'object not found' });
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

app.get('/api/status', (_req, res) => {
  const sources = store.all('sources');
  res.json({
    sources: sources.length,
    connected: sources.filter((s) => s.connectionStatus === 'connected').length,
    rawItems: store.all('rawItems').length,
    objects: store.all('objects').length,
    relationships: store.all('relationships').length,
    errors: store.all('errors').length,
    queue: queueStats(),
    lastSyncRuns: store.all('syncRuns').slice(-5)
  });
});

// A failing connector must never take Brief down (spec 30).
app.use((err, _req, res, _next) => {
  recordError('server', null, String(err?.message ?? err));
  res.status(500).json({ error: 'internal error' });
});

const PORT = process.env.PORT || 8787;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Brief ingestion server on :${PORT}`);
    console.log(`telegram configured: ${telegram.isConfigured()}  whatsapp configured: ${whatsapp.isConfigured()}`);
  });
}

export default app;
