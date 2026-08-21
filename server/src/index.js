// ---------------------------------------------------------------------------
// BRIEF INGESTION SERVER
//
// Secrets live here and only here (spec 28). The client never sees a bot
// token, an app secret or a webhook signing key -- it talks to these routes.
//
// ROUTING LAYOUT: this file owns app setup, middleware, frontend serving and
// boot. The 179 API routes live in server/src/routes/*.js -- one module per
// domain -- and are mounted below. A feature is independently integrable:
// add/remove a single mount line, and the module owns its own routes, imports
// and local guards.
// ---------------------------------------------------------------------------

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { store } from './store.js';
import * as auth from './domain/auth.js';
import * as ops from './ops.js';
import * as campaigns from './domain/campaign.js';
import * as ledger from './domain/ledger.js';
import * as telegram from './connectors/telegram.js';
import * as whatsapp from './connectors/whatsapp.js';
import * as compliance from './domain/compliance.js';
import { authStatus } from './identity.js';
import { recordError } from './routes/helpers.js';
import { register as authRoutes } from './routes/auth.js';
import { register as healthRoutes } from './routes/health.js';
import { register as opsRoutes } from './routes/ops.js';
import { register as arenaRoutes } from './routes/arena.js';
import { register as auctionRoutes } from './routes/auction.js';
import { register as fantasyRoutes } from './routes/fantasy.js';
import { register as sourcesRoutes } from './routes/sources.js';
import { register as connectorsRoutes } from './routes/connectors.js';
import { register as briefitRoutes } from './routes/briefit.js';
import { register as objectsRoutes } from './routes/objects.js';
import { register as circlesRoutes } from './routes/circles.js';
import { register as economicRoutes } from './routes/economic.js';
import { register as commerceRoutes } from './routes/commerce.js';
import { register as commandRoutes } from './routes/command.js';
import { register as campaignsRoutes } from './routes/campaigns.js';
import { register as vaultsRoutes } from './routes/vaults.js';
import { register as peopleRoutes } from './routes/people.js';
import { register as teaRoutes } from './routes/tea.js';
import { register as mediaRoutes } from './routes/media.js';
import { register as feedRoutes } from './routes/feed.js';
import { register as collectionsRoutes } from './routes/collections.js';
import { register as searchRoutes } from './routes/search.js';
import { register as assistRoutes } from './routes/assist.js';
import { register as poolsRoutes } from './routes/pools.js';
import { register as distributionRoutes } from './routes/distribution.js';
import { register as lobbyRoutes } from './routes/lobby.js';

const app = express();

// HTML-escape for meta-tag injection: a campaign title or description is
// user-authored and must never break out of an attribute/string context.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The compiled React/Vite frontend, served by Express in production. Resolved
// from THIS file's location (server/src) so it is correct regardless of the
// deployment working directory (/app, /app/server, or anywhere else): the
// build always lands at <repo>/preview/dist.
const FRONTEND_DIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), // server/src
  '..', '..', 'preview', 'dist'
);

// Raw body retained for webhook signature verification -- the HMAC must be
// computed over the exact bytes Meta sent, not a re-serialized object.
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use((_req, res, next) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type,authorization,x-telegram-bot-api-secret-token,x-hub-signature-256');
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  next();
});
app.options('*', (_req, res) => res.sendStatus(204));

// The production client calls the API under the /ingest prefix (the dev server
// strips it with a Vite proxy; in production Express serves the API directly).
// Strip the prefix here so /ingest/api/* resolves exactly like /api/*. This is
// a no-op for the dev server, whose proxy never forwards the prefix.
app.use((req, _res, next) => {
  if (req.url.startsWith('/ingest')) {
    req.url = req.url.slice('/ingest'.length) || '/';
  }
  next();
});

// Resolve the bearer token (or cookie) into a verified identity BEFORE any
// route runs. Sets req.auth, or req.authError when a token was presented and
// failed. Every authority check reads this through identity.callerId().
app.use(auth.authMiddleware);
// Structured request logs. Records method/route/status/duration/actor -- never
// bodies, tokens or query strings.
app.use(ops.requestLogger);

// ---------------------------------------------------------------------------
// ROUTE MOUNTS -- one per domain module.
// ---------------------------------------------------------------------------
authRoutes(app);
healthRoutes(app);
opsRoutes(app);
arenaRoutes(app);
auctionRoutes(app);
fantasyRoutes(app);
sourcesRoutes(app);
connectorsRoutes(app);
briefitRoutes(app);
objectsRoutes(app);
circlesRoutes(app);
economicRoutes(app);
commerceRoutes(app);
commandRoutes(app);
campaignsRoutes(app);
vaultsRoutes(app);
peopleRoutes(app);
teaRoutes(app);
mediaRoutes(app);
feedRoutes(app);
collectionsRoutes(app);
searchRoutes(app);
assistRoutes(app);
poolsRoutes(app);
distributionRoutes(app);
lobbyRoutes(app);

// --- Production frontend serving -------------------------------------------
//
// In production Express serves the compiled Vite build (FRONTEND_DIST) and
// falls back to index.html for client-side routes. This is a no-op when the
// build does not exist (development/test), so the API-only server behaves
// exactly as it always has.
// Serve the compiled frontend whenever the build exists.
//
// Deliberately NOT gated on NODE_ENV: Railway/nixpacks does not reliably set
// NODE_ENV=production, and gating on it silently disabled frontend serving so
// the deployed site returned 404 on '/'. The build's presence is the only
// honest signal — if the Vite output exists, serve it; if not, the API-only
// server behaves exactly as before.
const servingFrontend = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

if (servingFrontend) {
  const indexHtml = fs.readFileSync(path.join(FRONTEND_DIST, 'index.html'), 'utf8');

  // Open Graph / social preview injection.
  //
  // Link crawlers (WhatsApp, Telegram, X, Facebook) do NOT run JavaScript, so
  // the SPA's static index.html shows no preview. This route renders a small
  // HTML shell for /c/:slug with og:*/twitter:* meta filled from the campaign's
  // publicView, then still loads the same SPA bundle so a real browser gets the
  // full app. No private data is emitted: only the public projection.
  app.get('/c/:slug', (req, res) => {
    const c = campaigns.getPublicBySlug(req.params.slug);
    if (!c) {
      // Not found / not public: fall through to the SPA shell, which renders
      // its honest "not available" state.
      return res.type('html').send(indexHtml);
    }
    const pv = campaigns.publicView(c);
    const title = pv.title;
    const desc = pv.description || 'A gathering on Brief';
    const origin = process.env.BRIEF_PUBLIC_ORIGIN
      ? process.env.BRIEF_PUBLIC_ORIGIN.replace(/\/+$/, '')
      : null;
    const url = origin ? `${origin}/c/${pv.slug}` : null;
    const image = pv.image ?? null;

    const tags = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(desc)}" />`,
      `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
      `<meta name="twitter:description" content="${escapeHtml(desc)}" />`,
      ...(url ? [`<meta property="og:url" content="${escapeHtml(url)}" />`] : []),
      // Only a real image is emitted -- never a placeholder.
      ...(image ? [
        `<meta property="og:image" content="${escapeHtml(image)}" />`,
        `<meta name="twitter:image" content="${escapeHtml(image)}" />`
      ] : [])
    ].join('\n    ');

    const html = indexHtml.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(title)}</title>\n    ${tags}`
    );
    res.type('html').send(html);
  });

  // Static assets: JS/CSS bundles, images, etc. `index: false` so '/' is
  // handled by the explicit fallback below rather than a silent directory
  // serve, and so an asset miss is not masked by a directory index.
  app.use(express.static(FRONTEND_DIST, { index: false }));

  // SPA fallback: any GET that is neither the API nor a real asset resolves to
  // index.html, so client-side routes (e.g. /marketplace) do not 404.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next(); // API miss: 404 as API, never the SPA shell
    if (req.path.includes('.')) return next();       // a real asset request; 404 if absent
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// When no frontend build is present, '/' returns an actionable message instead
// of Express's bare "Cannot GET /" — the operator sees what is missing and how
// to fix it.
if (!servingFrontend) {
  app.get('/', (_req, res) => {
    res.status(503).type('text/plain').send(
      'Brief is running (API only). The frontend build is missing.\n' +
      `Expected at: ${FRONTEND_DIST}\n` +
      'Run `npm run build:client` at deploy time (railway.json buildCommand).\n'
    );
  });
}

// A failing connector must never take Brief down (spec 30).
app.use((err, _req, res, _next) => {
  // A body express could not parse is a CLIENT error. Returning 500 made
  // retry-on-5xx senders (Telegram, Meta) replay a payload that can never
  // succeed. The message stays generic -- no stack traces, no internals.
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    recordError('server', null, 'malformed request body');
    return res.status(400).json({ error: 'malformed request body' });
  }
  // Body larger than the configured limit is also a client error.
  if (err?.type === 'entity.too.large') {
    recordError('server', null, 'request body too large');
    return res.status(413).json({ error: 'request body too large' });
  }
  recordError('server', null, String(err?.message ?? err));
  res.status(500).json({ error: 'internal error' });
});

const PORT = process.env.PORT || 8787;
if (process.env.NODE_ENV !== 'test') {
  // Persistence net: bring back the latest snapshot if the data file is gone
  // (e.g. a fresh deploy on Railway's ephemeral filesystem with a re-attached
  // volume), and take rolling snapshots so a crash or forced kill never loses
  // more than the last interval. The graceful-shutdown backup still runs too.
  ops.restoreLatestBackupIfEmpty(store);
  ops.installPeriodicBackup(store, {
    intervalMs: Number(process.env.BRIEF_BACKUP_INTERVAL_MS) || 15 * 60 * 1000
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    const diag = ops.startupDiagnostics({
      store, capabilities: { payments: ledger.providerStatus() }
    });
    ops.logInfo('server_started', { port: Number(PORT), env: diag.env, dataFile: diag.dataFile });
    // Say, in one line, whether the frontend is being served and from where —
    // a 404-on-"/" deployment is diagnosed instantly instead of at 3am.
    ops.logInfo('frontend_serving', {
      serving: servingFrontend,
      dist: FRONTEND_DIST,
      reason: servingFrontend ? null : `no build found at ${FRONTEND_DIST} — run \`npm run build:client\``
    });
    ops.logInfo('connectors', {
      telegram: telegram.isConfigured(),
      whatsapp: whatsapp.isConfigured(),
      payments: ledger.providerConfigured(),
      auth: authStatus().configured,
      arenaMoney: compliance.arenaMoneyStatus().enabled
    });
    // Anything that would surprise an operator is said out loud at boot,
    // rather than discovered at the first real payment.
    for (const p of diag.problems) ops.logError('startup_problem', { problem: p });
    for (const n of diag.notes) ops.logWarn('startup_note', { note: n });
  });

  // Finish in-flight requests before exiting, and take a final backup so a
  // deploy always leaves a restorable snapshot behind.
  ops.installGracefulShutdown(server, {
    onShutdown: () => { try { ops.backup(store); } catch { /* never block exit */ } }
  });
}

export default app;
