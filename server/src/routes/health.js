// HEALTH ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { store } from '../store.js';
import { queueStats } from '../queue.js';
import { callerId, authStatus } from '../identity.js';
import * as ops from '../ops.js';
import * as ledger from '../domain/ledger.js';
import * as settlement from '../domain/settlement.js';
import * as payment from '../domain/payment.js';
import * as compliance from '../domain/compliance.js';
import * as telegram from '../connectors/telegram.js';
import * as web from '../connectors/web.js';
import * as whatsapp from '../connectors/whatsapp.js';
import * as outbound from '../outbound.js';
import * as features from '../features.js';
import { requireAuth, now } from './helpers.js';

export function register(app) {
// --- Health / capabilities ---------------------------------------------------


app.get('/api/health', (_req, res) => {
  res.json({ ok: true, at: now(), queue: queueStats() });
});


// Favicon: the brand mark, served as SVG so `/favicon.ico` never 404s (browsers
// request it automatically; a 404 here is noise, not a failure). Self-contained
// — no file, no network, no cache-busting surprises.
const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#090B10"/><circle cx="16" cy="16" r="10" fill="#43D17A" opacity="0.18"/><circle cx="16" cy="16" r="5" fill="#43D17A"/></svg>';

app.get('/favicon.ico', (_req, res) => {
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(FAVICON_SVG);
});


/**
 * Readiness, as distinct from liveness. Checks the store is writable and that
 * the economic reconcilers still balance -- a ledger that stopped reconciling
 * is a reason to pull the instance out of rotation.
 */

app.get('/api/ready', (_req, res) => {
  const result = ops.readiness({
    store,
    reconcilers: [
      { name: 'settlement', run: () => settlement.reconcile() },
      { name: 'payments', run: () => payment.reconcileIntents() }
    ]
  });
  res.status(result.ok ? 200 : 503).json(result);
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
    },
    // Economic + regulatory capability, reported rather than implied. The
    // client uses these to state plainly what Brief cannot currently do.
    payments: ledger.providerStatus(),
    arenaMoney: compliance.arenaMoneyStatus(),
    auth: authStatus(),
    // Outbound messaging: which channels can Brief actually SEND on. Honest
    // per-channel configured state, so the client never implies a reply rail
    // that has no provider.
    outbound: outbound.status(),
    // The feature registry (§4.2): one table of what is enabled, what is
    // configured, and what is therefore actually available.
    features: features.status()
  });
});



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


// ---------------------------------------------------------------------------
/**
 * Client-visible configuration. Deliberately tiny and deliberately NOT a
 * secrets endpoint: only values the browser must know to build correct links.
 *
 * `publicOrigin` is null unless BRIEF_PUBLIC_ORIGIN is set. The frontend then
 * reports "no public link configured" instead of fabricating a URL from
 * whatever host the creator happens to be browsing.
 */

app.get('/api/config', (_req, res) => {
  const origin = process.env.BRIEF_PUBLIC_ORIGIN || null;
  res.json({
    publicOrigin: origin ? String(origin).replace(/\/+$/, '') : null,
    campaignPathPrefix: '/c/'
  });
});
}

