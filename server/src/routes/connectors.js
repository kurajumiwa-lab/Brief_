// CONNECTORS ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import crypto from 'node:crypto';
import { store, newId } from '../store.js';
import { callerId } from '../identity.js';
import { enqueue, allow, withBackoff } from '../queue.js';
import { storeRawItem, processRawItem } from '../pipeline/ingest.js';
import * as telegram from '../connectors/telegram.js';
import * as whatsapp from '../connectors/whatsapp.js';
import * as web from '../connectors/web.js';
import { requireAuth, now, recordError, CURRENT_USER } from './helpers.js';

export function register(app) {
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
  // FAIL CLOSED. This guard previously ran only `if (secret)`, so an
  // unconfigured deployment skipped authentication entirely and any anonymous
  // caller could inject raw items and auto-create sources. An absent secret is
  // now a refusal, not a bypass -- the same model WhatsApp already uses.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    recordError('telegram', null, 'webhook rejected: TELEGRAM_WEBHOOK_SECRET not set');
    return res.status(401).json({ error: 'TELEGRAM_WEBHOOK_SECRET not set' });
  }
  const got = req.get('x-telegram-bot-api-secret-token');
  if (got !== secret) {
    recordError('telegram', null, 'webhook secret mismatch');
    return res.status(401).json({ error: 'bad secret token' });
  }

  const gate = allow('tg-webhook', 240, 60);
  if (!gate.ok) return res.status(429).json({ error: 'rate limited' });

  // A payload that can never succeed must be refused with 400, not 500.
  // Telegram and Meta retry on 5xx but not on 4xx, so returning 500 for
  // permanently-malformed input turns one bad message into a retry loop.
  const shape = telegram.validateUpdateShape(req.body);
  if (!shape.ok) {
    recordError('telegram', null, `malformed update: ${shape.error}`);
    return res.status(400).json({ error: shape.error });
  }

  let norm;
  try {
    norm = telegram.normalizeUpdate(req.body ?? {});
  } catch (e) {
    // Normalisation only throws on structurally impossible input, which is a
    // client defect rather than a server fault.
    recordError('telegram', null, `unnormalisable update: ${e?.message ?? e}`);
    return res.status(400).json({ error: 'malformed update payload' });
  }
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
/**
 * AUTHORIZATION: requires an identity. These endpoints make OUTBOUND network
 * requests and write objects into the store, so leaving them anonymous would
 * let an unauthenticated caller use Brief as a fetch proxy and fill the
 * database. Scoped to the caller, who must hold a membership on the source.
 */

app.post('/api/connectors/telegram/sync', async (req, res) => {
  if (!requireAuth(req, res)) return;
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

/** AUTHORIZATION: requires an identity -- outbound fetch, see above. */

app.post('/api/connectors/web/fetch', async (req, res) => {
  if (!requireAuth(req, res)) return;
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


/** AUTHORIZATION: requires an identity -- outbound fetch, see above. */

app.post('/api/connectors/rss/sync', async (req, res) => {
  if (!requireAuth(req, res)) return;
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
}

