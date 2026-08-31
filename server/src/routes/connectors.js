// CONNECTORS ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import crypto from 'node:crypto';
import { store, newId } from '../store.js';
import { callerId } from '../identity.js';
import { enqueue, allow, withBackoff } from '../queue.js';
import { storeRawItem, processRawItem } from '../pipeline/ingest.js';
import * as scheduler from '../pipeline/scheduler.js';
import { normalizeRssItem, normalizeWebPage } from '../pipeline/normalize.js';
import * as telegram from '../connectors/telegram.js';
import * as whatsapp from '../connectors/whatsapp.js';
import * as web from '../connectors/web.js';
import * as auth from '../domain/auth.js';
import * as person from '../domain/person.js';
import { requireAuth, requireCap, recordAudit, now, recordError, CURRENT_USER } from './helpers.js';

import { requireFeature } from '../features.js';

export function register(app) {
app.use('/api/connectors/web', requireFeature('connectors'));
app.use('/api/connectors/rss', requireFeature('connectors'));
app.use('/api/connectors/telegram', requireFeature('telegram'));
app.use('/api/telegram', requireFeature('telegram'));
app.use('/api/webhooks/telegram', requireFeature('telegram'));
app.use('/api/webhooks/whatsapp', requireFeature('whatsapp'));

/**
 * MINI APP AUTH — exchange verified initData for a Brief session.
 *
 * A Mini App opened inside Telegram presents signed initData. This route
 * verifies the HMAC (so only Telegram can have produced it), then binds the
 * Telegram user id to a Brief account and returns a session token. From here
 * the client is an ordinary authenticated Brief client — it can post, save,
 * register, etc. — because its identity is now real, not a local fallback.
 *
 * The account is a `tg_<id>` handle with a random, never-exposed password: the
 * user signs in via initData on every open, never by typing a password.
 */
app.post('/api/telegram/init', (req, res) => {
  const verified = telegram.verifyInitData(req.body?.initData);
  if (!verified.ok) {
    return res.status(401).json({ error: 'invalid telegram initData', reason: verified.reason });
  }

  const handle = `tg_${verified.user.id}`;
  let user = auth.getUserByHandle(handle);
  if (!user) {
    // A random server-side password the user never sees; auth is via initData.
    const password = crypto.randomBytes(32).toString('hex');
    user = auth.createUser({
      handle,
      password,
      displayName: verified.user.firstName || verified.user.username || handle
    });
  }

  const { token: sessionToken, session } = auth.issueSession(user.id);
  const mine = person.ensurePersonForUser(user.id);
  try {
    person.bindTelegram(user.id, verified.user.id);
  } catch {
    // Already bound to this person is fine; a clash is refused below.
  }
  res.json({
    ok: true,
    token: sessionToken,
    expiresAt: session.expiresAt,
    user: { ...auth.publicUser(user), personId: mine.id }
  });
});
// --- Telegram (spec 10-12) ---------------------------------------------------


app.get('/api/connectors/telegram/verify', async (_req, res) => {
  const result = await telegram.verify();
  if (!result.ok) return res.status(result.unconfigured ? 503 : 502).json(result);
  res.json(result);
});


/**
 * Verified connector status (spec 2 / 4 / 12).
 *
 * This is the honest answer to "is Telegram genuinely working?" -- not
 * `Boolean(process.env.TELEGRAM_BOT_TOKEN)` but a real getMe + getWebhookInfo
 * round trip. `configured` means a token exists; `operational` means the Bot
 * API authenticates AND a webhook is installed and free of a persistent error.
 * Nothing here ever carries the token or the webhook secret.
 */
app.get('/api/connectors/telegram/status', async (_req, res) => {
  res.json(await telegram.status());
});


/**
 * Webhook inspection (spec 4). Reads the live getWebhookInfo without mutating
 * anything: URL, pending update count, and any persistent delivery error.
 * Exposed separately from `status` so an operator can check the delivery rail
 * without re-verifying the bot identity.
 */
app.get('/api/connectors/telegram/webhook-info', async (_req, res) => {
  const info = await telegram.getWebhookInfo();
  if (!info.ok) return res.status(info.unconfigured ? 503 : 502).json(info);
  const w = info.result ?? {};
  res.json({
    ok: true,
    url: w.url ?? null,
    hasCustomCertificate: Boolean(w.has_custom_certificate),
    pendingUpdateCount: Number.isFinite(w.pending_update_count) ? w.pending_update_count : null,
    lastErrorMessage: w.last_error_message ?? null,
    lastErrorDate: w.last_error_date ? new Date(w.last_error_date * 1000).toISOString() : null,
    maxConnections: w.max_connections ?? null,
    allowedUpdates: Array.isArray(w.allowed_updates) ? w.allowed_updates : null
  });
});



app.post('/api/connectors/telegram/webhook-config', async (req, res) => {
  // Operator: this rewrites the connector's live webhook configuration.
  const op = requireCap(req, res, 'ops.run');
  if (!op) return;
  recordAudit('connector.telegram.webhook_config', { actorId: op, objectType: 'connector', objectId: 'telegram' });
  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ error: 'url is required' });
  let secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    secret = crypto.randomBytes(24).toString('hex');
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;
  }

  // IDEMPOTENT REGISTRATION (spec 4). setWebhook on every call would reset the
  // pending-update counter and churn the secret, so first read the live state
  // and only call setWebhook when the URL actually differs. Re-registering an
  // identical URL is a no-op, never a second competing webhook.
  const current = await telegram.getWebhookInfo();
  const currentUrl = (current.ok && current.result?.url) ? current.result.url : null;
  if (currentUrl === url) {
    telegram.resetStatusCache();
    return res.json({ ok: true, changed: false, already: url });
  }

  const result = await telegram.setWebhook(url, secret);
  telegram.resetStatusCache();
  // The secret is NOT returned to the client.
  res.status(result.ok ? 200 : 502).json({ ok: result.ok, changed: result.ok, error: result.error ?? null });
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
  const op = requireCap(req, res, 'ops.run');
  if (!op) return;
  recordAudit('connector.telegram.sync', { actorId: op, objectType: 'connector', objectId: 'telegram' });
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
    if (sourceId) scheduler.markSourceHealth(sourceId, { ok: false, error: page.error });
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
      // A one-off manual fetch does not auto-enrol the page in recurring
      // polling; the owner opts in via PATCH /api/sources/:id.
      enabled: false,
      healthState: 'never',
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      confidence: 0.5,
      lastSyncedAt: now(),
      lastMessageAt: page.extracted.publishedAt,
      createdAt: now(),
      updatedAt: now()
    });
  } else {
    store.update('sources', source.id, { connectionStatus: 'connected', lastSyncedAt: now() });
    scheduler.markSourceHealth(source.id, { ok: true, lastMessageAt: page.extracted.publishedAt ?? null });
  }

  // Feed the page's own words to the same extractor every other connector uses.
  const payload = normalizeWebPage({ source, page, url: page.finalUrl });
  const { row, duplicate } = storeRawItem(payload);
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
    if (sourceId) scheduler.markSourceHealth(sourceId, { ok: false, error: feed.error });
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
      // A one-off manual sync does not auto-enrol the feed in recurring
      // polling; the owner opts in via PATCH /api/sources/:id.
      enabled: false,
      healthState: 'never',
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      confidence: 0.55,
      lastSyncedAt: now(),
      lastMessageAt: null,
      createdAt: now(),
      updatedAt: now()
    });
  } else {
    store.update('sources', source.id, { connectionStatus: 'connected', lastSyncedAt: now() });
    scheduler.markSourceHealth(source.id, { ok: true });
  }

  const items = feed.items.slice(0, Number(limit) || 10);
  let stored = 0;
  for (const item of items) {
    const { row, duplicate } = storeRawItem(normalizeRssItem({ source, item, feedTitle: feed.feedTitle }));
    if (!duplicate) { enqueue(`rss:${row.id}`, () => processRawItem(row.id)); stored++; }
  }

  store.insert('syncRuns', { id: newId('sync'), connector: 'rss', sourceId: source.id, at: now(), received: feed.items.length, stored });
  res.json({ ok: true, source, received: feed.items.length, stored });
});


// --- Automatic ingestion (scheduler-driven Web/RSS polling) -----------------

/**
 * Trigger a poll now: one source (body.sourceId) or every enabled RSS/Web
 * source. This is the same code path the recurring poller runs, so an operator
 * can force a catch-up without waiting for the interval. Authenticated +
 * ops.run: it makes outbound requests and writes objects.
 */
app.post('/api/connectors/ingest/poll', async (req, res) => {
  const op = requireCap(req, res, 'ops.run');
  if (!op) return;
  const { sourceId } = req.body ?? {};
  const result = sourceId
    ? await scheduler.pollSource(sourceId)
    : await scheduler.runPollRound();
  res.json(result);
});

/**
 * Real Web/RSS connector health. Reflects registered sources and the last real
 * fetch outcome, never a static flag. Public read (it names no credentials).
 */
app.get('/api/connectors/ingest/status', (_req, res) => {
  res.json({ web: scheduler.ingestStatus('web'), rss: scheduler.ingestStatus('rss') });
});
}

