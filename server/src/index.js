// ---------------------------------------------------------------------------
// BRIEF INGESTION SERVER
//
// Secrets live here and only here (spec 28). The client never sees a bot
// token, an app secret or a webhook signing key -- it talks to these routes.
// ---------------------------------------------------------------------------

import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { store, newId } from './store.js';
import { enqueue, queueStats, allow, withBackoff } from './queue.js';
import { storeRawItem, processRawItem, previewText } from './pipeline/ingest.js';
import * as telegram from './connectors/telegram.js';
import * as web from './connectors/web.js';
import * as whatsapp from './connectors/whatsapp.js';
import * as circles from './domain/circle.js';
import * as blocks from './domain/block.js';
import * as signals from './domain/signal.js';
import * as ledger from './domain/ledger.js';
import * as members from './domain/member.js';
import { callerId, authStatus, isSelf, isCoordinator, circleHasNoMembers, membershipOf, canOperate, canGovernObject } from './identity.js';
import * as campaigns from './domain/campaign.js';
import * as checkin from './domain/checkin.js';
import * as vendors from './domain/vendor.js';
import * as listings from './domain/listing.js';
import * as orders from './domain/order.js';
import * as settlement from './domain/settlement.js';
import * as compliance from './domain/compliance.js';
import * as auth from './domain/auth.js';
import * as payment from './domain/payment.js';
import * as tuma from './connectors/tuma.js';
import * as arena from './domain/arena.js';
import * as fantasy from './domain/fantasy.js';
import * as auctions from './domain/auction.js';
import * as vault from './domain/vault.js';
import * as footsteps from './domain/footsteps.js';
import * as handoff from './domain/handoff.js';
import * as command from './domain/command.js';
import * as seed from './domain/seed.js';
import * as trust from './domain/trust.js';
import * as discovery from './domain/discovery.js';
import * as notifications from './domain/notifications.js';
import * as analytics from './domain/analytics.js';
import * as ops from './ops.js';

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

/**
 * Guard for routes that require a real actor.
 *
 * Returns the caller id, or sends 401 and returns null. Distinguishes an
 * expired session from a missing one so a client can prompt a re-login
 * instead of showing a generic error.
 */
function requireAuth(req, res) {
  const me = callerId(req);
  if (me) return me;
  const reason = req.authError ?? 'no_token';
  res.status(401).json({
    error: reason === 'expired' ? 'your session has expired, please sign in again'
      : reason === 'revoked' ? 'this session has been signed out'
      : 'authentication required',
    code: reason
  });
  return null;
}

const now = () => new Date().toISOString();
const CURRENT_USER = 'usr_me'; // single-user deployment; auth slots in here

function recordError(scope, sourceId, message) {
  store.insert('errors', { id: newId('err'), scope, sourceId: sourceId ?? null, message, at: now() });
}

// --- Authentication ----------------------------------------------------------

app.post('/api/auth/register', (req, res) => {
  try {
    const user = auth.createUser({
      handle: req.body?.handle,
      password: req.body?.password,
      displayName: req.body?.displayName
    });
    // Registering signs you in; requiring an immediate second round trip to
    // log in adds friction for no security benefit.
    const { token, session } = auth.issueSession(user.id);
    res.status(201).json({ user: auth.publicUser(user), token, expiresAt: session.expiresAt });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { token, session } = auth.login({
      handle: req.body?.handle,
      password: req.body?.password
    });
    const user = auth.getUser(session.userId);
    res.json({ user: auth.publicUser(user), token, expiresAt: session.expiresAt });
  } catch (e) {
    // 401, not 400: these are credential failures, not malformed requests.
    res.status(401).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = auth.tokenFromRequest(req);
  const revoked = token ? auth.revokeSession(token) : false;
  res.json({ ok: true, revoked });
});

/** Sign out everywhere. Requires a live session -- you may only revoke your own. */
app.post('/api/auth/logout-all', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({ ok: true, revoked: auth.revokeAllSessions(me) });
});

/** Who am I? The client uses this to decide between signed-in and signed-out UI. */
app.get('/api/auth/me', (req, res) => {
  const me = callerId(req);
  if (!me) {
    return res.status(401).json({ error: 'authentication required', code: req.authError ?? 'no_token' });
  }
  const user = auth.getUser(me);
  res.json({
    // A dev-fallback caller has no user row. Say so plainly rather than
    // fabricating a profile.
    user: user ? auth.publicUser(user) : { id: me, handle: null, displayName: 'Local user', devFallback: true },
    method: req.auth?.method ?? 'dev_fallback'
  });
});

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

/**
 * Operational diagnostics. Authenticated: it names which credentials are
 * absent, which is useful to an operator and to nobody else.
 */
app.get('/api/ops/diagnostics', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({
    startup: ops.startupDiagnostics({ store, capabilities: { payments: ledger.providerStatus() } }),
    readiness: ops.readiness({ store, reconcilers: [
      { name: 'settlement', run: () => settlement.reconcile() },
      { name: 'payments', run: () => payment.reconcileIntents() }
    ] }),
    counts: Object.fromEntries(
      ['objects', 'orders', 'ledgerTransactions', 'paymentIntents', 'payouts', 'signals', 'users', 'sessions']
        .map((c) => [c, store.all(c).length])
    ),
    // Failed jobs and rejected webhooks, which is where silent breakage hides.
    recentErrors: store.all('errors').slice(-20),
    rejectedCallbacks: store.all('paymentCallbacks').filter((c) => !c.accepted).slice(-10).length
  });
});

/** Take a backup on demand. Atomic-write store, so a copy is consistent. */
app.post('/api/ops/backup', (req, res) => {
  if (!requireAuth(req, res)) return;
  const result = ops.backup(store);
  if (!result.ok) return res.status(400).json(result);
  res.json({ ...result, pruned: ops.pruneBackups(store) });
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
    auth: authStatus()
  });
});

/**
 * Real-money contest gate.
 *
 * This endpoint exists so the refusal is REACHABLE and testable, not merely a
 * hidden button. Any future stake-holding route must call
 * compliance.refuseIfUnlicensed() before touching money.
 */
app.post('/api/arena/contests/:id/stake', (req, res) => {
  const refusal = compliance.refuseIfUnlicensed();
  if (refusal) return res.status(403).json(refusal);
  // Unreachable in this deployment. Left explicit rather than silently
  // absent so the boundary is obvious to the next implementer.
  return res.status(501).json({ error: 'stake handling is not implemented' });
});

// --- Arena -------------------------------------------------------------------

app.get('/api/arena/games', (_req, res) => {
  res.json({ games: arena.ARENA_GAMES, activity: arena.gameActivity() });
});

app.get('/api/arena/challenges', (req, res) => {
  res.json({
    challenges: arena.listChallenges({
      gameId: req.query.gameId ?? null,
      status: req.query.status ?? 'open'
    })
  });
});

app.post('/api/arena/challenges', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const challenge = arena.createChallenge({
      createdBy: me,
      gameId: req.body?.gameId,
      mode: req.body?.mode ?? '1v1',
      stake: req.body?.stake ?? 'friendly',
      entryFeeKes: req.body?.entryFeeKes ?? null,
      note: req.body?.note ?? '',
      venue: req.body?.venue ?? null,
      openMinutes: req.body?.openMinutes ?? 120
    });
    signals.emitSignal({ type: 'arena_challenge_opened', actorId: me, metadata: { challengeId: challenge.id, gameId: challenge.gameId } });
    res.status(201).json({ challenge });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/arena/challenges/:id/accept', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { challenge, match, reused } = arena.acceptChallenge(req.params.id, me);
    if (!reused) {
      signals.emitSignal({ type: 'arena_challenge_accepted', actorId: me, metadata: { challengeId: challenge.id, matchId: match.id } });
    }
    res.status(reused ? 200 : 201).json({ challenge, match, reused });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : 400).json({ error: msg });
  }
});

app.post('/api/arena/challenges/:id/cancel', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { challenge, changed } = arena.cancelChallenge(req.params.id, me);
    res.json({ challenge, changed });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : /only the player/i.test(msg) ? 403 : 400).json({ error: msg });
  }
});

app.get('/api/arena/matches', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({ matches: arena.listMatchesFor(me), record: arena.playerRecord(me) });
});

app.get('/api/arena/matches/:id', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const m = arena.getMatch(req.params.id);
  // A match is between two people. A stranger gets 404, not a peek.
  if (!m || !arena.isParticipant(m, me)) return res.status(404).json({ error: 'match not found' });
  res.json({ match: m });
});

app.post('/api/arena/matches/:id/report', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const m = arena.getMatch(req.params.id);
  if (!m || !arena.isParticipant(m, me)) return res.status(404).json({ error: 'match not found' });
  try {
    const match = arena.reportResult(req.params.id, me, {
      winnerPlayerId: req.body?.winnerPlayerId ?? null,
      scoreLine: req.body?.scoreLine ?? null
    });
    signals.emitSignal({ type: 'arena_result_reported', actorId: me, metadata: { matchId: match.id } });
    res.json({ match });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/arena/matches/:id/confirm', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const m = arena.getMatch(req.params.id);
  if (!m || !arena.isParticipant(m, me)) return res.status(404).json({ error: 'match not found' });
  try {
    const out = arena.confirmResult(req.params.id, me, {
      winnerPlayerId: req.body?.winnerPlayerId
    });
    if (out.changed) {
      signals.emitSignal({
        type: out.disputed ? 'arena_result_disputed' : 'arena_result_confirmed',
        actorId: me, metadata: { matchId: out.match.id }
      });
      // A confirmed result is an agreed fact: record it for the leaderboard and
      // tell both players their match is settled.
      if (!out.disputed && out.match.status === 'confirmed') {
        arena.recordResult(out.match.id);
        for (const pid of [out.match.playerAId, out.match.playerBId]) {
          const player = arena.getPlayer(pid);
          if (player) {
            notifications.notify(player.userId, {
              kind: 'challenge',
              title: 'Match result confirmed',
              body: `Your ${player.gameId} match is settled.`,
              metadata: { matchId: out.match.id }
            });
          }
        }
      }
    }
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/arena/matches/:id/abandon', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const m = arena.getMatch(req.params.id);
  if (!m || !arena.isParticipant(m, me)) return res.status(404).json({ error: 'match not found' });
  try {
    res.json({ match: arena.abandonMatch(req.params.id, me, req.body?.reason ?? '') });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});


// --- Auction --------------------------------------------------------------
//
// An auction is price discovery over an EXISTING listing. When it closes, the
// winner receives an ordinary Order that flows through the ordinary payment,
// ledger, settlement and payout routes. There is no auction wallet, no
// auction balance and no auction-specific money endpoint anywhere below.
//
// Bidder identities are never returned to anyone but the seller (who must be
// able to see who they are selling to) and each bidder about their own bids.

app.get('/api/auctions', (req, res) => {
  // Opportunistic close: an auction whose time is up is finalised the next
  // time anyone looks, so no cron daemon is required.
  auctions.sweepExpired();
  const status = req.query.status ?? null;
  const list = auctions.listAuctions({ status });
  const me = callerId(req);
  // The public projection by default; the seller sees their own in full.
  res.json({
    auctions: list.map((a) => (a.ownerId === me ? a : auctions.publicView(a)))
  });
});

app.get('/api/auctions/:id', (req, res) => {
  auctions.sweepExpired();
  const a = auctions.getAuction(req.params.id);
  if (!a) return res.status(404).json({ error: 'auction not found' });
  const me = callerId(req);
  res.json({ auction: a.ownerId === me ? a : auctions.publicView(a) });
});

/** The seller's view of who is bidding. Nobody else may read this. */
app.get('/api/auctions/:id/bids', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const a = auctions.getAuction(req.params.id);
  if (!a) return res.status(404).json({ error: 'auction not found' });
  if (a.ownerId !== me) {
    return res.status(403).json({ error: 'only the seller may see the bidders' });
  }
  res.json({ bids: auctions.activeBids(a.id) });
});

app.post('/api/auctions', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const auction = auctions.createAuction({
      listingId: req.body?.listingId,
      ownerId: me,
      type: req.body?.type ?? 'ascending',
      startingPrice: req.body?.startingPrice,
      reservePrice: req.body?.reservePrice ?? null,
      buyNowPrice: req.body?.buyNowPrice ?? null,
      endsAt: req.body?.endsAt,
      circleId: req.body?.circleId ?? null
    });
    res.status(201).json({ auction });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/auctions/:id/open', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ auction: auctions.openAuction(req.params.id, me) });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : /only the owner/.test(e.message) ? 403 : 400;
    res.status(code).json({ error: e.message });
  }
});

app.post('/api/auctions/:id/bids', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { bid, reused } = auctions.placeBid({
      auctionId: req.params.id,
      bidderId: me,
      amount: req.body?.amount,
      idempotencyKey: req.body?.idempotencyKey ?? null
    });
    // The bidder sees their own bid plus the public state of the auction.
    res.status(reused ? 200 : 201).json({
      bid,
      reused,
      auction: auctions.publicView(auctions.getAuction(req.params.id))
    });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

app.post('/api/bids/:id/retract', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ bid: auctions.retractBid({ bidId: req.params.id, actorId: me }) });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : /only the bidder/.test(e.message) ? 403 : 400;
    res.status(code).json({ error: e.message });
  }
});

app.get('/api/bids/mine', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({ bids: auctions.bidsByUser(me) });
});

app.post('/api/auctions/:id/buy-now', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const r = auctions.buyNow({
      auctionId: req.params.id,
      buyerId: me,
      idempotencyKey: req.body?.idempotencyKey ?? null
    });
    res.json({ auction: r.auction, sold: r.sold, buyNow: true });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

app.post('/api/auctions/:id/close', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const r = auctions.closeAuction({ auctionId: req.params.id, actorId: me });
    res.json({ auction: r.auction, changed: r.changed, sold: r.sold ?? false });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});

/** Winner -> Order. The join back to the ordinary commerce chain. */
app.post('/api/auctions/:id/order', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { order, reused } = auctions.createWinnerOrder({ auctionId: req.params.id, actorId: me });
    res.status(reused ? 200 : 201).json({ order, reused });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : /only the winner/.test(e.message) ? 403 : 400;
    res.status(code).json({ error: e.message });
  }
});

/** The winner did not pay. Explicit, seller-only, and refused once paid. */
app.post('/api/auctions/:id/default', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const auction = auctions.defaultWinner({
      auctionId: req.params.id,
      actorId: me,
      reason: req.body?.reason ?? 'winner did not pay'
    });
    res.json({ auction });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : /only the seller/.test(e.message) ? 403 : 400;
    res.status(code).json({ error: e.message });
  }
});

app.post('/api/auctions/:id/cancel', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ auction: auctions.cancelAuction({ auctionId: req.params.id, actorId: me, reason: req.body?.reason ?? '' }) });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : /only the owner/.test(e.message) ? 403 : 400;
    res.status(code).json({ error: e.message });
  }
});

// --- Fantasy 11 ----------------------------------------------------------------
//
// The non-economic core. Paid entry inherits the SAME compliance gate as
// paid Arena contests -- see POST /api/fantasy/competitions/:id/paid-entry.

app.get('/api/fantasy/rules', (_req, res) => {
  // Published so a participant can verify their own score by hand.
  res.json({ squad: fantasy.SQUAD_RULES, scoring: fantasy.SCORING_RULES, positions: fantasy.POSITIONS });
});

app.get('/api/fantasy/competitions', (req, res) => {
  res.json({ competitions: fantasy.listCompetitions({ status: req.query.status ?? null }) });
});

app.post('/api/fantasy/competitions', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.status(201).json({
      competition: fantasy.createCompetition({
        createdBy: me,
        title: req.body?.title,
        description: req.body?.description ?? '',
        kickoffAt: req.body?.kickoffAt,
        fixtures: req.body?.fixtures ?? []
      })
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/fantasy/competitions/:id', (req, res) => {
  const c = fantasy.getCompetition(req.params.id);
  if (!c) return res.status(404).json({ error: 'competition not found' });
  res.json({
    competition: c,
    pool: fantasy.playerPool(c.id),
    locked: fantasy.isLocked(c),
    entryCount: fantasy.listEntries(c.id).length
  });
});

app.post('/api/fantasy/competitions/:id/players', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.status(201).json({
      player: fantasy.addPoolPlayer(req.params.id, me, {
        name: req.body?.name, position: req.body?.position,
        club: req.body?.club, price: req.body?.price ?? 0
      })
    });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : /only the organiser/i.test(msg) ? 403 : 400).json({ error: msg });
  }
});

app.post('/api/fantasy/competitions/:id/open', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ competition: fantasy.openCompetition(req.params.id, me) });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : /only the organiser/i.test(msg) ? 403 : 400).json({ error: msg });
  }
});

/** Submit or replace a team. Refused after the server-side lock. */
app.post('/api/fantasy/competitions/:id/entries', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { entry, created } = fantasy.submitTeam(req.params.id, me, {
      playerIds: req.body?.playerIds, captainId: req.body?.captainId
    });
    res.status(created ? 201 : 200).json({ entry, created });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : 400).json({ error: msg, problems: e.problems ?? null });
  }
});

/** Your own entry. Other people's teams stay hidden until lock. */
app.get('/api/fantasy/competitions/:id/entries/me', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const entry = fantasy.getEntry(req.params.id, me);
  if (!entry) return res.status(404).json({ error: 'you have no entry in this competition' });
  res.json({ entry });
});

app.post('/api/fantasy/competitions/:id/stats', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({
      stats: fantasy.recordStats(req.params.id, me, req.body?.playerId, req.body?.stats ?? {})
    });
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found|unknown player/i.test(msg) ? 404 : /only the organiser/i.test(msg) ? 403 : 400).json({ error: msg });
  }
});

app.post('/api/fantasy/competitions/:id/score', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json(fantasy.scoreCompetition(req.params.id, me));
  } catch (e) {
    const msg = String(e.message ?? e);
    res.status(/not found/i.test(msg) ? 404 : /only the organiser/i.test(msg) ? 403 : 400).json({ error: msg });
  }
});

app.get('/api/fantasy/competitions/:id/standings', (req, res) => {
  const c = fantasy.getCompetition(req.params.id);
  if (!c) return res.status(404).json({ error: 'competition not found' });
  res.json({ standings: fantasy.standings(c.id), status: c.status });
});

/**
 * PAID fantasy entry.
 *
 * Inherits the identical compliance gate as paid Arena contests -- one gate,
 * one set of requirements, no second-class check that could drift.
 */
app.post('/api/fantasy/competitions/:id/paid-entry', (req, res) => {
  const refusal = compliance.refuseIfUnlicensed();
  if (refusal) return res.status(403).json(refusal);
  return res.status(501).json({ error: 'paid fantasy entry is not implemented' });
});

app.get('/api/arena/status', (_req, res) => {
  res.json({ arenaMoney: compliance.arenaMoneyStatus() });
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

/**
 * Create a source.
 *
 * AUTHORIZATION RULE, STATED EXPLICITLY: this is SELF-SCOPED. Anyone with an
 * identity may declare a source they can see, and doing so grants THEM a
 * membership on it -- nobody else. Creating a source confers no access to
 * anyone else's data and publishes nothing, so there is no privilege to
 * escalate. The membership row is what later authorises deletion and object
 * publication, so without it a creator would be locked out of their own row.
 */
app.post('/api/sources', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
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

  // The creator gets a granted membership. Without this the source would have
  // no members at all and even its creator could not disconnect it.
  store.insert('sourceMemberships', {
    id: newId('smem'),
    sourceId: source.id,
    userId: me,
    role: 'owner',
    accessGranted: true,
    createdAt: now()
  });

  res.status(201).json({ source });
});

app.delete('/api/sources/:id', (req, res) => {
  const source = store.find('sources', (x) => x.id === req.params.id);
  if (!source) return res.status(404).json({ error: 'source not found' });

  // SECURITY. Disconnecting a source destroys a provenance root: every object
  // extracted from it loses the link that proves where it came from. Only a
  // caller with a granted membership on that source may do it.
  const mine = store.find(
    'sourceMemberships',
    (m) => m.sourceId === source.id && m.userId === callerId(req) && m.accessGranted
  );
  if (!mine) {
    return res.status(403).json({ error: 'only a member of this source may disconnect it' });
  }

  const ok = store.remove('sources', req.params.id);
  // The membership rows are meaningless once the source is gone.
  for (const m of store.filter('sourceMemberships', (x) => x.sourceId === source.id)) {
    store.remove('sourceMemberships', m.id);
  }
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

// --- Analytics + operations (host/operator) ---------------------------------

app.get('/api/ops/analytics', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ analytics: analytics.dashboard() });
});

app.get('/api/ops/reports', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ reports: trust.openReports() });
});

app.post('/api/ops/reports/:id/resolve', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ report: trust.resolveReport(req.params.id, me, req.body?.action ?? 'dismiss') });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/ops/contributors', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ contributors: trust.contributorLeaderboard() });
});

app.get('/api/ops/unverified', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ objects: store.filter('objects', (o) => o.verificationStatus === 'unverified' && o.publication !== 'removed') });
});

// --- Arena entities (players, venues, tournaments, leaderboards) ------------

app.post('/api/arena/players', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.status(201).json({ player: arena.createPlayer({ userId: me, gameId: req.body?.gameId, gamerTag: req.body?.gamerTag, platform: req.body?.platform ?? null, region: req.body?.region ?? null }) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/arena/players', (req, res) => {
  res.json({ players: arena.listPlayers({ gameId: req.query.gameId ?? null }) });
});

app.post('/api/arena/venues', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.status(201).json({ venue: arena.createVenue({ name: req.body?.name, gameIds: req.body?.gameIds ?? [], location: req.body?.location ?? null, lat: req.body?.lat ?? null, lng: req.body?.lng ?? null, contact: req.body?.contact ?? null }) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/arena/venues', (req, res) => {
  res.json({ venues: arena.listVenues({ gameId: req.query.gameId ?? null }) });
});

app.post('/api/arena/tournaments', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.status(201).json({ tournament: arena.createTournament({ gameId: req.body?.gameId, title: req.body?.title, startsAt: req.body?.startsAt ?? null, createdBy: me, venueId: req.body?.venueId ?? null, maxPlayers: req.body?.maxPlayers ?? null }) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/arena/tournaments', (req, res) => {
  res.json({ tournaments: arena.listTournaments({ gameId: req.query.gameId ?? null, status: req.query.status ?? null }) });
});

app.get('/api/arena/leaderboard', (req, res) => {
  res.json({ leaderboard: arena.leaderboard(req.query.gameId ?? 'efootball') });
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
// FEATURE SCHEMA: circles, blocks, signals, ledger
// ---------------------------------------------------------------------------

app.get('/api/circles', (_req, res) => {
  res.json({ circles: circles.listCircles() });
});

app.get('/api/circles/:id', (req, res) => {
  const circle = circles.getCircle(req.params.id);
  if (!circle) return res.status(404).json({ error: 'circle not found' });
  res.json({
    circle,
    blocks: blocks.listBlocks(circle.id),
    signals: signals.listSignals({ circleId: circle.id, limit: 20 })
  });
});

app.post('/api/circles', (req, res) => {
  const { name, description, goal, targetValue, deadline, completionCriteria, sourceId } = req.body ?? {};
  try {
    // Deriving from a source keeps the provenance chain intact.
    if (sourceId) {
      const c = circles.findOrCreateCircleFromSource(sourceId, { name, description });
      signals.emitSignal({ type: 'circle_created', circleId: c.id, sourceId, actorId: callerId(req) });
      return res.status(201).json({ circle: c });
    }
    const c = circles.createTargetCircle({
      name, description, goal,
      targetValue: targetValue === undefined || targetValue === null || targetValue === ''
        ? null : Number(targetValue),
      deadline, completionCriteria
    });
    signals.emitSignal({ type: 'circle_created', circleId: c.id, actorId: callerId(req) });
    res.status(201).json({ circle: c });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.patch('/api/circles/:id', (req, res) => {
  // Once a circle has members it belongs to them: only a coordinator may
  // change its terms (name, goal, targetValue, deadline).
  if (!circleHasNoMembers(store, req.params.id) && !isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may update this circle' });
  }
  try {
    const c = circles.updateCircle(req.params.id, req.body ?? {});
    if (!c) return res.status(404).json({ error: 'circle not found' });
    res.json({ circle: c });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/circles/:id/members', (req, res) => {
  if (!circles.getCircle(req.params.id)) return res.status(404).json({ error: 'circle not found' });
  res.json({ members: members.listMembers(req.params.id) });
});

// AUTHORITY (spec 32): a caller must not be able to claim membership for
// another user. `userId` is NOT read from the body -- it is the authenticated
// caller. Adding somebody else requires coordinator authority on that circle.
app.post('/api/circles/:id/members', (req, res) => {
  const me = callerId(req);
  const requested = req.body?.userId;

  // Naming a different user is an act of authority, not a self-join.
  if (requested && requested !== me) {
    if (!isCoordinator(store, req, req.params.id)) {
      return res.status(403).json({
        error: 'only a coordinator of this circle may add another user'
      });
    }
  }

  // A self-join is allowed while the circle is still open, or when the caller
  // already coordinates it. Otherwise membership is by coordinator only.
  const target = requested && requested !== me ? requested : me;
  if (target === me) {
    const circle = circles.getCircle(req.params.id);
    if (!circle) return res.status(404).json({ error: 'circle not found' });
    const open = circle.visibility === 'open' || circleHasNoMembers(store, circle.id);
    if (!open && !isCoordinator(store, req, circle.id)) {
      return res.status(403).json({ error: 'this circle is invite only' });
    }
  }

  // Only a coordinator may mint another coordinator.
  const role = req.body?.role;
  if (role === 'coordinator' && !circleHasNoMembers(store, req.params.id)
      && !isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may grant the coordinator role' });
  }

  try {
    const m = members.addMember(req.params.id, target, role);
    // Attributed to the member who joined, not to the coordinator who may
    // have added them -- otherwise "joined" would appear in the wrong
    // person's evidence history.
    signals.emitSignal({ type: 'member_joined', circleId: req.params.id, actorId: target });
    res.status(201).json({ member: m });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

// Role changes are coordinator-only. Previously unexposed; adding it without
// an authority check would have been a wider hole than the one being closed.
app.patch('/api/circles/:id/members/:userId/role', (req, res) => {
  if (!isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may change roles' });
  }
  try {
    res.json({ member: members.setRole(req.params.id, req.params.userId, req.body?.role) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

// Trust is recorded evidence of a check that happened -- never a score.
app.post('/api/circles/:id/members/:userId/verify', (req, res) => {
  // Evidence must be recorded BY somebody, not self-asserted: a member cannot
  // mark their own identity verified. Trust would be worthless otherwise.
  if (isSelf(req, req.params.userId)) {
    return res.status(403).json({ error: 'a member cannot verify themselves' });
  }
  if (!isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may record verification' });
  }
  try {
    res.json({ member: members.recordVerification(req.params.id, req.params.userId, req.body?.kind) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

// ---------------------------------------------------------------------------
// CIRCLE OPERATIONS (Batch 2): tasks and votes.
//
// Every route below enforces authority SERVER-SIDE. Hiding a button in the
// client is presentation, not security -- these endpoints reject the request
// itself. Identity always comes from callerId(), never from the body.
// ---------------------------------------------------------------------------

/** Shared guard: the block must exist and belong to the named circle. */
function loadCircleBlock(req, res) {
  const block = store.find('blocks', (b) => b.id === req.params.blockId);
  if (!block) {
    res.status(404).json({ error: 'block not found' });
    return null;
  }
  // A block is reachable only through ITS circle. Without this a caller could
  // operate on another circle's task by naming their own circle in the path.
  if (block.circleId !== req.params.id) {
    res.status(404).json({ error: 'block not found in this circle' });
    return null;
  }
  return block;
}

app.post('/api/circles/:id/blocks/:blockId/assign', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;

  const me = callerId(req);
  const requested = req.body?.assigneeId;
  const assignee = requested ?? me;

  // Taking work yourself needs an operational role. Handing work to someone
  // else is an act of authority and needs a coordinator.
  if (assignee !== me) {
    if (!isCoordinator(store, req, req.params.id)) {
      return res.status(403).json({ error: 'only a coordinator may assign a task to another member' });
    }
  } else if (!canOperate(store, req, req.params.id)) {
    const row = membershipOf(store, req, req.params.id);
    return res.status(403).json({
      error: row
        ? `role '${row.role}' may not take on tasks in this circle`
        : 'only members of this circle may take on tasks'
    });
  }

  try {
    const { block: updated, changed } = blocks.assignTask(block.id, assignee);
    // Only a real change emits a signal. Re-assigning to the same person is a
    // no-op and must not manufacture a second piece of activity evidence.
    if (changed) {
      signals.emitSignal({
        type: 'task_assigned',
        circleId: block.circleId,
        blockId: block.id,
        actorId: assignee,
        metadata: { assignedBy: me }
      });
    }
    res.json({ block: updated, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/circles/:id/blocks/:blockId/release', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;

  const state = blocks.taskState(block);
  const me = callerId(req);
  // You may put down your own work; releasing someone else's is a
  // coordinator's call.
  if (state?.assigneeId && state.assigneeId !== me && !isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only the assignee or a coordinator may release this task' });
  }

  try {
    const { block: updated, changed } = blocks.releaseTask(block.id);
    if (changed) {
      signals.emitSignal({
        type: 'task_released',
        circleId: block.circleId,
        blockId: block.id,
        actorId: state?.assigneeId ?? me,
        metadata: { releasedBy: me }
      });
    }
    res.json({ block: updated, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/circles/:id/blocks/:blockId/complete', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;

  const state = blocks.taskState(block);
  const me = callerId(req);

  // Completion is a claim that work was done. Only the person holding the
  // task, or a coordinator confirming on their behalf, may make it.
  if (state?.assigneeId !== me && !isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({
      error: 'only the assignee or a coordinator may complete this task'
    });
  }

  try {
    const { block: updated, changed } = blocks.completeTask(block.id, state?.assigneeId ?? me);
    // Attribute completion to whoever did the work, not to the coordinator
    // who confirmed it -- otherwise the evidence history would credit the
    // wrong member.
    if (changed) {
      signals.emitSignal({
        type: 'task_completed',
        circleId: block.circleId,
        blockId: block.id,
        actorId: state?.assigneeId ?? me,
        metadata: { confirmedBy: me }
      });
    }
    res.json({ block: updated, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/circles/:id/blocks/:blockId/vote', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;

  const me = callerId(req);
  // A ballot is cast by the caller. `voterId` in a body would be a forgeable
  // claim, so it is ignored entirely.
  if (!canOperate(store, req, req.params.id)) {
    const row = membershipOf(store, req, req.params.id);
    return res.status(403).json({
      error: row
        ? `role '${row.role}' may not vote in this circle`
        : 'only members of this circle may vote'
    });
  }

  try {
    const ballot = blocks.castVote(block.id, me, req.body?.option);
    signals.emitSignal({
      type: 'vote_cast',
      circleId: block.circleId,
      blockId: block.id,
      actorId: me,
      // The CHOICE is deliberately not recorded on the signal: the activity
      // feed shows that someone voted, not how. The ballot row holds the
      // option for the tally.
      metadata: {}
    });
    res.status(201).json({ vote: { id: ballot.id, option: ballot.option }, tally: blocks.tallyVote(block.id) });
  } catch (e) {
    const msg = String(e.message ?? e);
    // Already-voted is a conflict, not a malformed request.
    const status = /already voted/.test(msg) ? 409 : 400;
    res.status(status).json({ error: msg });
  }
});

app.post('/api/circles/:id/blocks/:blockId/close-vote', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;
  if (!isCoordinator(store, req, req.params.id)) {
    return res.status(403).json({ error: 'only a coordinator may close a vote' });
  }
  try {
    const { block: updated, changed } = blocks.closeVote(block.id);
    if (changed) {
      signals.emitSignal({
        type: 'vote_closed',
        circleId: block.circleId,
        blockId: block.id,
        actorId: callerId(req)
      });
    }
    res.json({ block: updated, changed, tally: blocks.tallyVote(block.id) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/circles/:id/blocks/:blockId/tally', (req, res) => {
  const block = loadCircleBlock(req, res);
  if (!block) return;
  try {
    res.json({ tally: blocks.tallyVote(block.id) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/**
 * A member's evidence history, derived from the signals they caused.
 * Never a score -- see memberEvidence() for why.
 */
app.get('/api/circles/:id/members/:userId/evidence', (req, res) => {
  if (!circles.getCircle(req.params.id)) {
    return res.status(404).json({ error: 'circle not found' });
  }
  res.json({
    evidence: signals.memberEvidence(req.params.userId, { circleId: req.params.id }),
    summary: signals.memberEvidenceSummary(req.params.userId, { circleId: req.params.id })
  });
});

app.get('/api/blocks', (req, res) => {
  res.json({ blocks: blocks.listBlocks(req.query.circleId || null) });
});

app.post('/api/blocks', (req, res) => {
  const { circleId, objectId, type, content, metadata } = req.body ?? {};
  // Contribution requires belonging. An open circle admits anyone; an
  // invite-only circle admits members only.
  const circle = circles.getCircle(circleId);
  if (!circle) return res.status(404).json({ error: 'circle not found' });
  const mine = store.find(
    'members',
    (m) => m.circleId === circleId && m.userId === callerId(req)
  );
  if (!mine && circle.visibility !== 'open') {
    return res.status(403).json({ error: 'only members may add blocks to this circle' });
  }
  try {
    // metadata carries the type-specific payload -- vote options above all.
    // Dropping it here meant a vote could never be created through the API:
    // createBlock() saw no options and refused every request.
    const b = objectId
      ? blocks.createBlockFromObject(objectId, circleId, { type, content })
      : blocks.createBlock({ circleId, type, content, metadata: metadata ?? {} });
    signals.emitSignal({
      type: 'block_added',
      circleId,
      blockId: b.id,
      objectId: objectId ?? null,
      actorId: callerId(req)
    });
    res.status(201).json({ block: b });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/signals', (req, res) => {
  res.json({
    signals: signals.listSignals({
      circleId: req.query.circleId || null,
      limit: Math.min(Number(req.query.limit) || 50, 200)
    })
  });
});

app.get('/api/economic/wallet', (req, res) => {
  res.json(ledger.walletBalance(String(req.query?.currency || 'KES')));
});

app.get('/api/transactions', (req, res) => {
  res.json({
    transactions: ledger.listTransactions({ limit: Math.min(Number(req.query.limit) || 50, 200) }),
    provider: ledger.providerStatus()
  });
});

app.post('/api/transactions', (req, res) => {
  const { amount, currency, type, description, counterparty, circleId, objectId, campaignId, registrationId } = req.body ?? {};
  // A caller may record money against their own name. Attributing a payment to
  // somebody else inside a circle is a coordinator act -- otherwise anyone
  // could inflate another person's contribution record.
  const me = callerId(req);
  if (counterparty && counterparty !== me && circleId && !isCoordinator(store, req, circleId)) {
    return res.status(403).json({
      error: 'only a coordinator may record a transaction for another user'
    });
  }
  try {
    const tx = ledger.createTransaction({
      amount: Number(amount), currency, type, description, counterparty, circleId, objectId, campaignId, registrationId
    });
    res.status(201).json({ transaction: tx });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/transactions/:id/transition', (req, res) => {
  try {
    const tx = ledger.transitionTransaction(req.params.id, req.body?.status, req.body?.note ?? '');
    // A held spot becomes a real registration only when money actually
    // settles. Derived from the authoritative transaction row, not a claim.
    if (tx.status === 'settled') campaigns.promoteRegistrationForSettledTransaction(tx);
    // A refund releases the spot it paid for. Reuses the existing cancelled
    // state; adds no new registration concept.
    if (tx.status === 'refunded') campaigns.demoteRegistrationForRefundedTransaction(tx);
    // A target only moves when money actually settles.
    if (tx.status === 'settled' && tx.circleId) {
      signals.emitSignal({
        type: 'target_progressed',
        circleId: tx.circleId,
        value: tx.amount,
        metadata: { transactionId: tx.id, currency: tx.currency }
      });
    }
    res.json({ transaction: tx });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});


// ---------------------------------------------------------------------------
// COMMERCE (Batch 3): vendors, listings, orders, fulfilment, disputes.
//
// The chain: Object -> Vendor -> Listing -> Order -> Fulfilment -> Transaction
//
// Two rules govern every route below.
//
//   1. IDENTITY IS NEVER READ FROM THE BODY. ownerId, buyerId and vendorId
//      come from callerId(). A client-supplied identity is a claim, not a
//      fact, and none of these handlers read one.
//
//   2. MONEY IS NEVER READ FROM THE BODY. An order carries a listingId and a
//      quantity; the server multiplies. price/unitPrice/total in a payload are
//      ignored, because Batch 4 will attach a real payment rail to these
//      numbers and a forged total today is forged money later.
// ---------------------------------------------------------------------------

/** The caller's own vendor, or null. Sellers act only as themselves. */
function myVendor(req) {
  return store.find('vendors', (v) => v.ownerId === callerId(req));
}

/**
 * Guard for vendor-owned resources. 404 rather than 403 for someone else's
 * listing: existence is not disclosed to a stranger, matching how campaigns
 * already behave.
 */
function ownedListing(req, res) {
  // Parenthesised deliberately: `x.id === a ?? b` parses as `(x.id === a) ?? b`,
  // which silently compares against undefined and matches nothing.
  const wanted = req.params.listingId ?? req.params.id;
  const l = store.find('listings', (x) => x.id === wanted);
  if (!l) { res.status(404).json({ error: 'listing not found' }); return null; }
  const mine = myVendor(req);
  if (!mine || l.vendorId !== mine.id) {
    res.status(404).json({ error: 'listing not found' });
    return null;
  }
  return l;
}

// --- Vendors -----------------------------------------------------------------

app.get('/api/vendors', (req, res) => {
  res.json({ vendors: vendors.listVendors({ status: req.query.status ?? null }) });
});

/** The caller's own seller identity. Null is a real answer: not everyone sells. */
app.get('/api/vendors/me', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ vendor: vendors.getVendorByOwner(callerId(req)) });
});

app.get('/api/vendors/:id', (req, res) => {
  const v = vendors.getVendor(req.params.id);
  if (!v) return res.status(404).json({ error: 'vendor not found' });
  // A vendor profile is public, so it carries only active listings -- a
  // draft is the seller's private work in progress.
  res.json({ vendor: v, listings: listings.listListings({ vendorId: v.id, status: 'active' }) });
});

app.post('/api/vendors', (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    // ownerId is deliberately NOT read from req.body.
    const v = vendors.createVendor({
      ownerId: callerId(req),
      displayName: req.body?.displayName,
      description: req.body?.description ?? '',
      contactMethod: req.body?.contactMethod ?? null,
      objectId: req.body?.objectId ?? null
    });
    signals.emitSignal({ type: 'vendor_created', actorId: callerId(req), metadata: { vendorId: v.id } });
    res.status(201).json({ vendor: v });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.patch('/api/vendors/:id', (req, res) => {
  const mine = myVendor(req);
  if (!mine || mine.id !== req.params.id) {
    return res.status(404).json({ error: 'vendor not found' });
  }
  try {
    res.json({ vendor: vendors.updateVendor(mine.id, req.body ?? {}) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

// --- Listings ----------------------------------------------------------------

/**
 * Browse. Public and ACTIVE-only by default: a draft belongs to the seller.
 * An empty marketplace returns an empty array -- nothing is seeded to make it
 * look populated.
 */
app.get('/api/listings', (req, res) => {
  res.json({
    listings: listings.listListings({
      vendorId: req.query.vendorId ?? null,
      type: req.query.type ?? null,
      status: req.query.status ?? 'active'
    })
  });
});

/** The caller's own shelf, in every state including draft and archived. */
app.get('/api/listings/mine', (req, res) => {
  if (!requireAuth(req, res)) return;
  const mine = myVendor(req);
  if (!mine) return res.json({ listings: [], vendor: null });
  res.json({
    vendor: vendors.getVendor(mine.id),
    listings: listings.listListings({ vendorId: mine.id, status: null })
  });
});

app.get('/api/listings/:id', (req, res) => {
  const l = listings.getListing(req.params.id);
  if (!l) return res.status(404).json({ error: 'listing not found' });
  // A non-active listing is visible only to its owner. Otherwise a buyer could
  // read, link to, and try to order a draft.
  if (l.status !== 'active') {
    const mine = myVendor(req);
    if (!mine || l.vendorId !== mine.id) {
      return res.status(404).json({ error: 'listing not found' });
    }
  }
  res.json({ listing: l });
});

app.post('/api/listings', (req, res) => {
  if (!requireAuth(req, res)) return;
  const mine = myVendor(req);
  if (!mine) {
    return res.status(403).json({ error: 'create a vendor profile before listing anything' });
  }
  try {
    // vendorId comes from the caller's own vendor row, never from the body:
    // otherwise anyone could list goods under another seller's name.
    const l = listings.createListing({
      vendorId: mine.id,
      title: req.body?.title,
      description: req.body?.description ?? '',
      type: req.body?.type ?? 'product',
      price: req.body?.price,
      currency: req.body?.currency ?? 'KES',
      quantityAvailable:
        req.body?.quantityAvailable === undefined ? null : req.body.quantityAvailable,
      locationName: req.body?.locationName ?? null,
      objectId: req.body?.objectId ?? null,
      media: req.body?.media ?? []
    });
    res.status(201).json({ listing: l });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.patch('/api/listings/:id', (req, res) => {
  const l = ownedListing(req, res);
  if (!l) return;
  try {
    // `status` is not in the domain allow-list: a status moves only through
    // the transition endpoint, so the lifecycle table cannot be bypassed by
    // PATCHing a field.
    res.json({ listing: listings.updateListing(l.id, req.body ?? {}) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/listings/:id/status', (req, res) => {
  const l = ownedListing(req, res);
  if (!l) return;
  try {
    const { listing, changed } = listings.transitionListing(l.id, req.body?.status);
    // Only a real change emits activity. A double-tapped Pause is a no-op.
    if (changed) {
      const type =
        listing.status === 'active' ? 'listing_published'
        : listing.status === 'paused' ? 'listing_paused'
        : listing.status === 'archived' ? 'listing_archived'
        : null;
      if (type) {
        signals.emitSignal({
          type, actorId: callerId(req),
          objectId: listing.objectId ?? null,
          metadata: { listingId: listing.id }
        });
      }
    }
    res.json({ listing, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

// --- Orders ------------------------------------------------------------------

/**
 * My orders. `role=vendor` returns what I sold, anything else what I bought.
 * There is no "all orders" view: every query is scoped to the caller as one
 * party or the other.
 */
app.get('/api/orders', (req, res) => {
  const me = callerId(req);
  if (req.query.role === 'vendor') {
    const mine = myVendor(req);
    if (!mine) return res.json({ orders: [] });
    return res.json({ orders: orders.listOrders({ vendorId: mine.id, status: req.query.status ?? null }) });
  }
  res.json({ orders: orders.listOrders({ buyerId: me, status: req.query.status ?? null }) });
});

app.get('/api/orders/:id', (req, res) => {
  const o = orders.getOrder(req.params.id);
  if (!o) return res.status(404).json({ error: 'order not found' });
  // Only the two parties to an order may read it.
  const me = callerId(req);
  if (o.buyerId !== me && o.vendorOwnerId !== me) {
    return res.status(404).json({ error: 'order not found' });
  }
  res.json({ order: o });
});

app.post('/api/orders', (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    // buyerId from the caller. price/total are NOT read -- the server derives
    // money from the listing row. A body carrying {price:1,total:1} against a
    // KES 500 listing produces an order for the real amount.
    const order = orders.createOrder({
      listingId: req.body?.listingId,
      buyerId: callerId(req),
      quantity: req.body?.quantity ?? 1,
      note: req.body?.note ?? '',
      // Client-supplied key. Safe to trust because it is scoped to the
      // authenticated buyer: the worst a caller can do with a forged key is
      // deduplicate their OWN orders.
      idempotencyKey: req.body?.idempotencyKey ?? null
    });
    signals.emitSignal({
      type: 'order_placed',
      actorId: callerId(req),
      metadata: { orderId: order.id, listingId: order.listingId, vendorId: order.vendorId }
    });
    // A vault linking this order gains an order_created footstep.
    vault.emitOrderFootsteps(order.id, 'order_created', {
      actorId: callerId(req),
      value: order.total,
      dedupeKey: `order:${order.id}`,
      metadata: { listingId: order.listingId, vendorId: order.vendorId }
    });
    res.status(201).json({ order });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/**
 * Fulfilment. The VENDOR marks an order delivered.
 *
 * Fulfilment and payment are different facts and are recorded separately: an
 * order can be fulfilled and unpaid, or paid and unfulfilled. Marking this
 * does not touch money.
 */
app.post('/api/orders/:id/fulfil', (req, res) => {
  const o = store.find('orders', (x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'order not found' });

  const mine = myVendor(req);
  if (!mine || o.vendorId !== mine.id) {
    return res.status(403).json({ error: 'only the vendor for this order may fulfil it' });
  }
  try {
    const { order, changed } = orders.transitionOrder(o.id, 'fulfilled', {
      note: req.body?.note ?? ''
    });
    if (changed) {
      signals.emitSignal({
        type: 'order_fulfilled',
        actorId: callerId(req),
        metadata: { orderId: order.id, vendorId: order.vendorId }
      });
      vault.emitOrderFootsteps(order.id, 'order_fulfilled', {
        actorId: callerId(req),
        dedupeKey: `order:fulfilled:${order.id}`
      });
    }
    res.json({ order, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/**
 * Advance an order along the fulfilment path (accepted / preparing / ready).
 *
 * The stages are optional -- a simple handover goes straight to fulfilled --
 * but a seller who wants to keep the buyer informed can walk them. The
 * transition table is server-authoritative either way: a client cannot jump
 * backwards or skip into a terminal state through this endpoint.
 */
app.post('/api/orders/:id/stage', (req, res) => {
  const o = store.find('orders', (x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'order not found' });

  const mine = myVendor(req);
  if (!mine || o.vendorId !== mine.id) {
    return res.status(403).json({ error: 'only the vendor for this order may advance it' });
  }
  const stage = req.body?.stage;
  // Only the fulfilment stages are reachable here. Settlement is economic and
  // has its own endpoint with its own guard; disputes belong to the buyer.
  if (!['accepted', 'preparing', 'ready'].includes(stage)) {
    return res.status(400).json({ error: 'stage must be one of accepted, preparing, ready' });
  }
  try {
    const { order, changed } = orders.transitionOrder(o.id, stage, { note: req.body?.note ?? '' });
    if (changed) {
      signals.emitSignal({
        type: 'order_stage_changed',
        actorId: callerId(req),
        metadata: { orderId: order.id, stage }
      });
    }
    res.json({ order, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/**
 * Cancel. Either party may cancel an order that has not yet been delivered.
 */
app.post('/api/orders/:id/cancel', (req, res) => {
  const o = store.find('orders', (x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'order not found' });
  const me = callerId(req);
  if (o.buyerId !== me && o.vendorOwnerId !== me) {
    return res.status(404).json({ error: 'order not found' });
  }
  try {
    const { order, changed } = orders.transitionOrder(o.id, 'cancelled', {
      note: req.body?.reason ?? ''
    });
    if (changed) {
      signals.emitSignal({
        type: 'order_cancelled', actorId: me, metadata: { orderId: order.id }
      });
    }
    res.json({ order, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/**
 * Settlement. Deliberately requires a SETTLED ledger transaction whose amount
 * matches the order total.
 *
 * No payment provider is connected (see domain/ledger.js), so in practice this
 * endpoint refuses -- and that refusal is the honest answer. It exists so the
 * shape is ready for Batch 4, not so the marketplace can pretend money moved.
 */
app.post('/api/orders/:id/settle', (req, res) => {
  const o = store.find('orders', (x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'order not found' });
  const mine = myVendor(req);
  if (!mine || o.vendorId !== mine.id) {
    return res.status(403).json({ error: 'only the vendor for this order may settle it' });
  }
  try {
    if (req.body?.transactionId) {
      orders.attachTransaction(o.id, req.body.transactionId);
    }
    const { order, changed } = orders.transitionOrder(o.id, 'settled');
    if (changed) {
      signals.emitSignal({
        type: 'order_settled',
        actorId: callerId(req),
        value: order.total,
        metadata: { orderId: order.id, vendorId: order.vendorId }
      });
      vault.emitOrderFootsteps(order.id, 'order_settled', {
        actorId: callerId(req),
        value: order.total,
        dedupeKey: `order:settled:${order.id}`
      });
    }
    res.json({ order, changed });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

// --- Disputes ----------------------------------------------------------------

/**
 * A buyer contests their own order. Establishes one fact: this transaction is
 * contested and must not be read as clean fulfilment. No refund is invented,
 * because no money has moved and arbitration is deferred.
 */
app.post('/api/orders/:id/dispute', (req, res) => {
  const o = store.find('orders', (x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'order not found' });
  try {
    const { dispute, order, changed } = orders.openDispute({
      orderId: o.id,
      reportedBy: callerId(req),
      reason: req.body?.reason
    });
    if (changed) {
      signals.emitSignal({
        type: 'order_disputed',
        actorId: callerId(req),
        metadata: { orderId: order.id, disputeId: dispute.id }
      });
    }
    res.status(changed ? 201 : 200).json({ dispute, order, changed });
  } catch (e) {
    // "only the buyer may dispute this order" is an authority refusal.
    const msg = String(e.message ?? e);
    res.status(msg.startsWith('only the buyer') ? 403 : 400).json({ error: msg });
  }
});

/**
 * What this seller has earned, derived by scanning their settled orders.
 *
 * NOT a balance and not a wallet. `payoutAvailable` is false while no payment
 * provider is connected, and the response says why -- the difference between
 * "you have earned this" and "you can withdraw this" is not cosmetic.
 */
app.get('/api/vendors/me/earnings', (req, res) => {
  if (!requireAuth(req, res)) return;
  const mine = myVendor(req);
  if (!mine) return res.status(404).json({ error: 'vendor not found' });
  res.json({ earnings: settlement.vendorEarnings(mine.id) });
});

/** The split for one order. Only the two parties may read it. */
app.get('/api/orders/:id/settlement', (req, res) => {
  const o = store.find('orders', (x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'order not found' });
  const me = callerId(req);
  if (o.buyerId !== me && o.vendorOwnerId !== me) {
    return res.status(404).json({ error: 'order not found' });
  }
  res.json({ settlement: settlement.orderSettlement(o.id) });
});

/**
 * Reconciliation. Recomputes the economic picture and reports disagreements
 * rather than asserting consistency.
 */
// --- Payments ----------------------------------------------------------------

/**
 * Start paying for an order. The AMOUNT IS NOT ACCEPTED FROM THE CLIENT -- it
 * is read from the order row inside createIntent().
 */
app.post('/api/orders/:id/pay', async (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { intent, reused } = payment.createIntent({
      orderId: req.params.id,
      payerId: me,
      phone: req.body?.phone ?? null,
      idempotencyKey: req.body?.idempotencyKey ?? null
    });

    // No provider configured: return the intent and say so plainly. The order
    // is still payable out-of-band; Brief simply cannot collect it.
    if (!payment.activeProvider()) {
      return res.status(503).json({
        intent,
        reused,
        charged: false,
        ...payment.providerStatus()
      });
    }

    const result = await payment.requestPayment(intent.id);
    if (!result.ok) {
      vault.emitOrderFootsteps(intent.orderId, 'payment_failed', {
        actorId: me,
        dedupeKey: `pay:fail:${intent.id}`,
        metadata: { reason: result.reason }
      });
      return res.status(502).json({ intent: payment.getIntent(intent.id), error: result.reason, detail: result.detail ?? null });
    }
    vault.emitOrderFootsteps(intent.orderId, 'payment_authorized', {
      actorId: me,
      value: intent.amount,
      dedupeKey: `pay:authorized:${intent.id}`,
      metadata: { providerRef: result.providerRef }
    });
    res.status(reused ? 200 : 201).json({
      intent: payment.getIntent(intent.id), reused, charged: true,
      customerMessage: result.customerMessage
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

/** Payment state for an order. Parties only. */
app.get('/api/orders/:id/payments', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const o = store.find('orders', (x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'order not found' });
  if (o.buyerId !== me && o.vendorOwnerId !== me) {
    return res.status(404).json({ error: 'order not found' });
  }
  res.json({ payments: payment.listIntentsForOrder(o.id) });
});

/**
 * Tuma STK Push callback.
 *
 * Tuma does not sign callbacks, so the deployment-controlled defence is a
 * secret path segment (TUMA_WEBHOOK_SECRET). The REAL authenticity check is
 * inside confirmPayment(): the
 * callback must carry a checkout_request_id Brief issued and an amount that
 * matches the stored intent. It FAILS CLOSED: with no secret configured,
 * nothing is accepted. Every callback is persisted before processing so a
 * replay or a malformed payload is auditable.
 */
app.post('/api/webhooks/tuma/:secret', (req, res) => {
  const check = tuma.verifyCallbackSecret(req.params.secret);
  store.insert('paymentCallbacks', {
    id: newId('cb'), provider: 'tuma', accepted: check.ok,
    reason: check.reason ?? null, body: req.body ?? null, at: now()
  });
  if (!check.ok) {
    recordError('tuma_webhook', null, `rejected callback: ${check.reason}`);
    // 403, and deliberately no detail about why.
    return res.status(403).json({ error: 'rejected' });
  }

  const parsed = tuma.parseCallback(req.body);
  if (!parsed.ok) {
    recordError('tuma_webhook', null, 'unrecognised callback payload');
    return res.status(400).json({ error: 'unrecognised payload' });
  }

  const applied = payment.confirmPayment({
    providerRef: parsed.checkoutRequestId,
    succeeded: parsed.succeeded,
    amount: parsed.amount,
    receipt: parsed.receipt,
    failureReason: parsed.failureReason,
    cancelled: parsed.cancelled
  });

  if (!applied.ok) {
    recordError('tuma_webhook', null, `callback not applied: ${applied.reason}`);
    // 200 to the provider: retrying will not help, and Tuma retries on
    // non-2xx (up to 5 attempts with backoff). The failure is recorded on
    // our side instead.
    return res.status(200).json({ ok: false, reason: applied.reason });
  }

  if (applied.transactionId && !applied.duplicate) {
    // Attach the money to the order and emit the signal. Settlement itself
    // still goes through the existing guarded transition.
    try {
      orders.attachTransaction(applied.intent.orderId, applied.transactionId);
      signals.emitSignal({
        type: 'order_paid', actorId: applied.intent.payerId,
        metadata: { orderId: applied.intent.orderId, transactionId: applied.transactionId }
      });
    } catch (e) {
      recordError('tuma_webhook', null, `attach failed: ${String(e.message ?? e)}`);
    }
    // The vault timeline records the settlement exactly once (dedupe by the
    // provider reference), independent of the ledger's own replay protection.
    vault.emitOrderFootsteps(applied.intent.orderId, 'payment_settled', {
      actorId: applied.intent.payerId,
      value: applied.intent.amount,
      dedupeKey: `pay:settled:${applied.intent.providerRef}`,
      metadata: { receipt: applied.intent.receipt, transactionId: applied.transactionId }
    });
  }

  res.json({ ok: true, duplicate: Boolean(applied.duplicate) });
});

// --- Payouts -----------------------------------------------------------------

/**
 * Request a payout of settled earnings. The amount is DERIVED server-side
 * from settled orders minus anything already paid or in flight.
 */
app.post('/api/vendors/me/payouts', async (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const mine = myVendor(req);
  if (!mine) return res.status(404).json({ error: 'you do not have a vendor profile' });
  try {
    const { payout, reused } = settlement.requestPayout({
      vendorId: mine.id,
      requestedBy: me,
      phone: req.body?.phone ?? null,
      idempotencyKey: req.body?.idempotencyKey ?? null
    });
    if (reused) return res.json({ payout, reused: true });
    const sent = await settlement.sendPayout(payout.id);
    if (!sent.ok) {
      return res.status(502).json({ payout: store.find('payouts', (p) => p.id === payout.id), error: sent.reason });
    }
    res.status(201).json({ payout: store.find('payouts', (p) => p.id === payout.id), reused: false });
  } catch (e) {
    // No disbursement provider is a 503 (unavailable, try later), not a 400
    // (you did it wrong). The code is machine-readable so a client can state
    // the truth rather than implying payouts work.
    const status = e.code === 'provider_unavailable' ? 503 : 400;
    res.status(status).json({ error: String(e.message ?? e), code: e.code ?? null });
  }
});

app.get('/api/vendors/me/payouts', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const mine = myVendor(req);
  if (!mine) return res.json({ payouts: [] });
  res.json({ payouts: settlement.listPayouts(mine.id) });
});

/** Payment reconciliation. Operator visibility over provider references. */
app.get('/api/economic/payments/reconcile', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ reconciliation: payment.reconcileIntents() });
});

/**
 * The host command centre: NOW / MONEY / PEOPLE / DISTRIBUTION / ACTION / NEXT,
 * derived from real rows. Host-only, and scoped to the caller's own campaigns
 * and vaults — a host never sees another host's figures.
 */
app.get('/api/host/command', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({ command: command.commandCentre(me) });
});

/**
 * Seed / clear demo content IN-PROCESS. The CLI script wrote to a data file
 * that the running server (which holds the store in memory) never re-reads, so
 * on the deployed site the data never appeared. These routes run the seed
 * against the live in-memory store, so it is visible immediately.
 *
 * Authenticated (the local bootstrapped account counts), and the seed is
 * clearly-tagged, removable, and creates no money — a harmless demo affordance,
 * not a privileged surface.
 */
app.post('/api/ops/seed', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ seeded: seed.runSeed() });
});

app.post('/api/ops/seed/clear', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ cleared: seed.clearSeed() });
});

app.get('/api/economic/reconcile', (_req, res) => {
  res.json({ reconciliation: settlement.reconcile() });
});

/** Disputes raised against my listings, so a seller can see what is contested. */
app.get('/api/disputes', (req, res) => {
  const mine = myVendor(req);
  if (req.query.role === 'vendor') {
    if (!mine) return res.json({ disputes: [] });
    return res.json({ disputes: orders.listDisputes({ vendorId: mine.id }) });
  }
  res.json({ disputes: orders.listDisputes({ reportedBy: callerId(req) }) });
});

// ---------------------------------------------------------------------------
// CAMPAIGNS (creator distribution layer)
//
// Ownership is derived from the authenticated caller. A client cannot supply
// ownerId; the field is not read from any request body.
// ---------------------------------------------------------------------------

// Owner-only guard. Returns the campaign, or sends the response and returns
// null. 404 for a campaign that is not yours: existence is not disclosed.
function ownedCampaign(req, res) {
  const c = store.find('campaigns', (x) => x.id === req.params.id);
  if (!c) { res.status(404).json({ error: 'campaign not found' }); return null; }
  if (c.ownerId !== callerId(req)) { res.status(404).json({ error: 'campaign not found' }); return null; }
  return c;
}

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

app.get('/api/campaigns', (req, res) => {
  res.json({ campaigns: campaigns.listCampaigns(callerId(req)) });
});

app.post('/api/campaigns', (req, res) => {
  try {
    // ownerId comes from the caller, never req.body.
    const c = campaigns.createCampaign(callerId(req), {
      title: req.body?.title,
      description: req.body?.description,
      type: req.body?.type,
      location: req.body?.location,
      startsAt: req.body?.startsAt,
      endsAt: req.body?.endsAt,
      capacity: req.body?.capacity === undefined ? null : req.body.capacity,
      price: req.body?.price === undefined ? 0 : Number(req.body.price),
      currency: req.body?.currency,
      circleId: req.body?.circleId ?? null,
      metadata: req.body?.metadata,
      // Attach an existing Brief object instead of creating one. Authority is
      // checked in the domain layer against source membership.
      objectId: req.body?.objectId ?? null
    });
    res.status(201).json({ campaign: c });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/campaigns/:id', (req, res) => {
  const c = ownedCampaign(req, res);
  if (!c) return;
  res.json({ campaign: campaigns.getCampaign(c.id) });
});

app.patch('/api/campaigns/:id', (req, res) => {
  const c = ownedCampaign(req, res);
  if (!c) return;
  try {
    // ownerId is the SERVER's caller, never req.body: it authorises object
    // attachment inside the domain layer.
    res.json({ campaign: campaigns.updateCampaign(c.id, req.body ?? {}, callerId(req)) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

for (const [action, next] of [['publish','published'],['close','closed'],['cancel','cancelled'],['complete','completed'],['golive','live']]) {
  app.post(`/api/campaigns/:id/${action}`, (req, res) => {
    const c = ownedCampaign(req, res);
    if (!c) return;
    try {
      res.json({ campaign: campaigns.transitionCampaign(c.id, next) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}

// Private analytics. Owner only -- derived from records on every read.
/**
 * The canonical share payload: one URL, plus intent links for the channels
 * that genuinely support them. Owner-only, like the rest of the dashboard.
 */
app.get('/api/campaigns/:id/share', (req, res) => {
  const c = ownedCampaign(req, res);
  if (!c) return;
  res.json({ share: campaigns.shareView(c, process.env.BRIEF_PUBLIC_ORIGIN || null) });
});

/**
 * Records that the creator distributed the link. Emits a signal ONLY -- it
 * moves no money, changes no capacity and touches no campaign field.
 */
app.post('/api/campaigns/:id/share', (req, res) => {
  const c = ownedCampaign(req, res);
  if (!c) return;
  if (c.status === 'draft') {
    return res.status(400).json({ error: 'publish the campaign before sharing it' });
  }
  campaigns.recordShare(c, req.body?.channel ?? 'link');
  res.json({ campaign: campaigns.getCampaign(c.id) });
});

app.get('/api/campaigns/:id/analytics', (req, res) => {
  const c = ownedCampaign(req, res);
  if (!c) return;
  res.json({ analytics: campaigns.analytics(c.id) });
});

app.get('/api/campaigns/:id/registrations', (req, res) => {
  const c = ownedCampaign(req, res);
  if (!c) return;
  res.json({ registrations: campaigns.listRegistrations(c.id) });
});

/**
 * The creator confirms that payment for a held spot actually arrived.
 *
 * No payment provider is connected, so the creator is the only party who knows
 * cash changed hands. This records that fact as a REAL settled transaction and
 * lets the ordinary settlement path promote the registration -- it does not
 * write a registration status directly, and it writes no counter.
 *
 * Owner-only. The amount is taken from the CAMPAIGN price, never from the
 * request body, so a caller cannot mint arbitrary revenue here.
 */
app.post('/api/campaigns/:id/registrations/:regId/confirm-payment', (req, res) => {
  const c = ownedCampaign(req, res);
  if (!c) return;
  const row = store.find('registrations', (r) => r.id === req.params.regId);
  if (!row || row.campaignId !== c.id) {
    return res.status(404).json({ error: 'registration not found' });
  }
  if (c.price <= 0) {
    return res.status(400).json({ error: 'campaign is free; nothing to confirm' });
  }
  if (row.status !== 'started') {
    return res.status(409).json({ error: `registration is ${row.status}, not awaiting payment` });
  }
  try {
    let tx = ledger.createTransaction({
      amount: c.price,
      currency: c.currency,
      type: 'sale',
      description: `Payment confirmed by organiser for ${c.title}`,
      campaignId: c.id,
      registrationId: row.id,
      circleId: c.circleId ?? null,
      objectId: c.objectId ?? null
    });
    for (const step of ['pending', 'confirmed', 'settled']) {
      tx = ledger.transitionTransaction(tx.id, step, 'organiser confirmed payment');
    }
    const registration = campaigns.promoteRegistrationForSettledTransaction(tx);
    // Settled money against a Circle moves its target, exactly as any other
    // settlement does. Same existing signal, no special case.
    if (tx.circleId) {
      signals.emitSignal({
        type: 'target_progressed',
        circleId: tx.circleId,
        value: tx.amount,
        metadata: { transactionId: tx.id, currency: tx.currency }
      });
    }
    res.status(201).json({
      registration: registration ?? store.find('registrations', (r) => r.id === row.id),
      transaction: tx,
      analytics: campaigns.analytics(c.id)
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/campaigns/:id/registrations/:regId/status', (req, res) => {
  const c = ownedCampaign(req, res);
  if (!c) return;
  const row = store.find('registrations', (r) => r.id === req.params.regId);
  if (!row || row.campaignId !== c.id) return res.status(404).json({ error: 'registration not found' });
  try {
    res.json({ registration: campaigns.setRegistrationStatus(req.params.regId, req.body?.status) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

// --- The gate (check-in) ----------------------------------------------------
//
// A ticket is a campaign registration carrying an opaque code. These routes are
// the GATE OPERATOR's surface: scan a code, see who it is and whether they are
// paid, and check them in exactly once. Operator identity comes from the
// authenticated caller (a host), never from the request body.

/** Look a ticket up by its scannable code. Host-only: a code is a gate secret. */
app.get('/api/tickets/:code', (req, res) => {
  if (!requireAuth(req, res)) return;
  const registration = checkin.lookupTicket(req.params.code);
  if (!registration) return res.status(404).json({ error: 'ticket not found' });
  const view = checkin.ticketView(registration);
  // Only the campaign's host may inspect a ticket — a code must not be a way
  // to read the roster anonymously.
  const c = store.find('campaigns', (x) => x.id === registration.campaignId);
  if (!c || c.ownerId !== callerId(req)) return res.status(404).json({ error: 'ticket not found' });
  res.json({ ticket: view });
});

/** Check a ticket in at the gate. Host-only, idempotent, honest refusals. */
app.post('/api/tickets/:code/check-in', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const registration = checkin.lookupTicket(req.params.code);
  if (!registration) return res.status(404).json({ error: 'ticket not found' });
  const c = store.find('campaigns', (x) => x.id === registration.campaignId);
  if (!c || c.ownerId !== me) return res.status(404).json({ error: 'ticket not found' });

  const result = checkin.checkIn(req.params.code, me);
  if (!result.ok) {
    const status = result.reason === 'cancelled' ? 410
      : result.reason === 'unpaid' ? 402
      : result.reason === 'invalid_transition' ? 409
      : 400;
    const message = {
      cancelled: 'This ticket has been cancelled.',
      unpaid: 'Payment is still pending for this ticket.',
      invalid_transition: 'This ticket cannot be checked in right now.',
      not_found: 'Ticket not found.'
    }[result.reason] ?? 'Check-in failed.';
    return res.status(status).json({ error: message, reason: result.reason, ticket: result.ticket ?? null });
  }
  res.json({
    ok: true,
    already: Boolean(result.already),
    ticket: result.ticket,
    checkedInCount: checkin.checkedInCount(registration.campaignId)
  });
});

// --- PUBLIC (no authentication; only published/live campaigns resolve) ------

app.get('/api/public/campaigns/:slug', (req, res) => {
  const c = campaigns.getPublicBySlug(req.params.slug);
  if (!c) return res.status(404).json({ error: 'campaign not found' });
  // Coarse, server-derived fingerprint: never trusted as identity, never
  // returned to any client, and only used to report `viewers` alongside raw
  // page loads. A crawler and a refresh are still indistinguishable.
  const viewerRef = crypto
    .createHash('sha256')
    .update(String(req.ip || '') + '|' + String(req.get('user-agent') || ''))
    .digest('hex')
    .slice(0, 16);
  campaigns.recordView(c, viewerRef);
  res.json({ campaign: campaigns.publicView(c) });
});

app.post('/api/public/campaigns/:slug/register', (req, res) => {
  const c = campaigns.getPublicBySlug(req.params.slug);
  if (!c) return res.status(404).json({ error: 'campaign not found' });
  try {
    const reg = campaigns.register(c, {
      attendeeRef: req.body?.attendeeRef,
      name: req.body?.name ?? null,
      contact: req.body?.contact ?? null
    });
    // Only the registrant's own record, never the roster. The ticketCode is
    // the attendee's own gate credential, so it is returned to THEM (and only
    // to them) here — a code is the thing they show at the gate, not a roster
    // leak.
    res.status(201).json({
      registration: { id: reg.id, status: reg.status, createdAt: reg.createdAt, ticketCode: reg.ticketCode ?? null },
      campaign: campaigns.publicView(campaigns.getPublicBySlug(req.params.slug) ?? c)
    });
  } catch (e) {
    const full = /full|not open/.test(String(e.message));
    res.status(full ? 409 : 400).json({ error: String(e.message ?? e) });
  }
});

// --- The Vault --------------------------------------------------------------
//
// A Vault is a persistent context layer over real-world activity. Routes here
// follow the same authority discipline as the rest of Brief: identity comes
// from callerId(), roles from stored participant rows, and money is never
// accepted from the client.

/** Resolve the caller's participant token (guest entry), if presented. */
function vaultTokenParticipant(req) {
  const token = req.get('x-vault-token');
  if (!token) return null;
  const resolved = handoff.resolveHandoff(token, { markUsed: false });
  if (!resolved.ok) return null;
  return vault.getParticipant(resolved.participantId);
}

/** The caller id, extended: a guest token resolves to its participant id. */
function vaultActor(req) {
  return callerId(req) ?? vaultTokenParticipant(req)?.id ?? null;
}

app.post('/api/vaults', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const v = vault.createVault({
      ownerId: me,
      type: req.body?.type,
      title: req.body?.title,
      description: req.body?.description,
      visibility: req.body?.visibility,
      location: req.body?.location,
      startsAt: req.body?.startsAt,
      endsAt: req.body?.endsAt,
      sourceId: req.body?.sourceId ?? null
    });
    res.status(201).json({ vault: vault.vaultView(me, v.id) });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/vaults', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({ vaults: vault.listVaults(me, { status: req.query.status ?? null }) });
});

app.get('/api/vaults/resolution', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ items: vault.resolution() });
});

app.get('/api/vaults/search', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({ results: vault.searchVaults(req.query.q ?? '') });
});

app.get('/api/vaults/:id', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const view = vault.vaultView(me, req.params.id);
  if (!view) return res.status(404).json({ error: 'vault not found' });
  if (view.role === 'public') return res.status(404).json({ error: 'vault not found' });
  res.json({ vault: view });
});

app.patch('/api/vaults/:id', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ vault: vault.vaultView(me, vault.updateVault(me, req.params.id, req.body ?? {}).id) });
  } catch (e) {
    const status = /not found/.test(String(e.message)) ? 404 : 403;
    res.status(status).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/vaults/:id/close', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ vault: vault.vaultView(me, vault.closeVault(me, req.params.id, { note: req.body?.note ?? '' }).id) });
  } catch (e) {
    res.status(/not found/.test(String(e.message)) ? 404 : 403).json({ error: String(e.message ?? e) });
  }
});

// Footsteps: the immutable timeline. Read requires access; write is attributable.
app.get('/api/vaults/:id/footsteps', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const view = vault.vaultView(me, req.params.id);
  if (!view || view.role === 'public') return res.status(404).json({ error: 'vault not found' });
  const { category, cursor, limit } = req.query;
  res.json(footsteps.listFootsteps(req.params.id, {
    category: category ?? null,
    cursor: cursor !== undefined ? Number(cursor) : null,
    limit: limit !== undefined ? Number(limit) : 200
  }));
});

app.post('/api/vaults/:id/footsteps', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const view = vault.vaultView(me, req.params.id);
    if (!view || view.role === 'public') return res.status(404).json({ error: 'vault not found' });
    const { footstep } = footsteps.recordFootstep({
      vaultId: req.params.id,
      kind: req.body?.kind,
      actorId: me,
      actorName: req.body?.actorName ?? null,
      channel: req.body?.channel ?? 'web',
      value: req.body?.value ?? null,
      narrative: req.body?.narrative ?? null,
      metadata: req.body?.metadata ?? {}
    });
    res.status(201).json({ footstep });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/vaults/:id/participants', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const participant = vault.addParticipant(me, {
      vaultId: req.params.id,
      role: req.body?.role,
      userId: req.body?.userId ?? null,
      name: req.body?.name ?? null,
      phone: req.body?.phone ?? null,
      channel: req.body?.channel ?? 'web'
    });
    res.status(201).json({ participant });
  } catch (e) {
    res.status(403).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/vaults/:id/link', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const updated = vault.linkVault(me, req.params.id, { kind: req.body?.kind, id: req.body?.id });
    res.json({ vault: vault.vaultView(me, updated.id) });
  } catch (e) {
    res.status(403).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/vaults/:id/channels', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const channel = vault.attachChannel(me, {
      vaultId: req.params.id,
      channel: req.body?.channel,
      externalId: req.body?.externalId ?? null
    });
    res.status(201).json({ channel });
  } catch (e) {
    res.status(403).json({ error: String(e.message ?? e) });
  }
});

// Requests: a guest asks, the host routes, a vendor accepts.
app.post('/api/vaults/:id/requests', (req, res) => {
  const me = vaultActor(req);
  if (!me) return res.status(401).json({ error: 'authentication required' });
  try {
    const view = vault.vaultView(callerId(req), req.params.id);
    const participant = vaultTokenParticipant(req);
    // Guests may ask through their token; hosts through their session.
    if (!view || view.role === 'public') return res.status(404).json({ error: 'vault not found' });
    const request = vault.createRequest(me, {
      vaultId: req.params.id,
      participantId: participant?.id ?? null,
      kind: req.body?.kind,
      description: req.body?.description,
      quantity: req.body?.quantity,
      priceEstimate: req.body?.priceEstimate,
      location: req.body?.location,
      notes: req.body?.notes
    });
    res.status(201).json({ request });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

app.get('/api/vaults/:id/requests', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const view = vault.vaultView(me, req.params.id);
  if (!view || view.role === 'public') return res.status(404).json({ error: 'vault not found' });
  res.json({ requests: vault.listRequests(req.params.id, { vendorId: req.query.vendorId ?? null }) });
});

app.post('/api/vaults/:id/requests/:requestId/route', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ request: vault.routeRequest(me, { requestId: req.params.requestId, vendorId: req.body?.vendorId }) });
  } catch (e) {
    res.status(/not found/.test(String(e.message)) ? 404 : 403).json({ error: String(e.message ?? e) });
  }
});

app.post('/api/vaults/:id/requests/:requestId/accept', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ request: vault.acceptRequest(me, { requestId: req.params.requestId }) });
  } catch (e) {
    res.status(/not found/.test(String(e.message)) ? 404 : 403).json({ error: String(e.message ?? e) });
  }
});

// Handoff ("continue elsewhere") — the host issues an opaque, expiring token.
app.post('/api/vaults/:id/handoff', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const view = vault.vaultView(me, req.params.id);
    if (!view || view.role === 'public') return res.status(404).json({ error: 'vault not found' });
    const result = handoff.createHandoff({
      vaultId: req.params.id,
      participantId: req.body?.participantId,
      purpose: 'handoff',
      fromChannel: req.body?.fromChannel ?? 'web',
      toChannel: req.body?.toChannel ?? null,
      createdBy: me
    });
    if (!result.ok) return res.status(500).json({ error: result.reason });
    footsteps.recordFootstep({
      vaultId: req.params.id,
      kind: 'handoff_created',
      actorId: me,
      channel: 'web',
      metadata: { toChannel: req.body?.toChannel ?? null }
    });
    res.status(201).json({ token: result.token, expiresAt: result.expiresAt });
  } catch (e) {
    res.status(400).json({ error: String(e.message ?? e) });
  }
});

// Public entry: a guest enters through a public link, no account required.
app.get('/api/public/vaults/:slug', (req, res) => {
  const v = vault.getVaultBySlug(req.params.slug);
  if (!v) return res.status(404).json({ error: 'vault not found' });
  if (!vault.isPubliclyEnterable(v)) return res.status(404).json({ error: 'vault not found' });
  res.json({ vault: vault.vaultView(null, v.id) });
});

app.post('/api/public/vaults/:slug/enter', (req, res) => {
  const result = vault.publicEnter(req.params.slug, {
    name: req.body?.name ?? null,
    phone: req.body?.phone ?? null,
    channel: 'web'
  });
  if (!result.ok) return res.status(result.reason === 'not_found' ? 404 : 403).json({ error: result.reason });
  res.status(201).json(result);
});

/** Resolve a handoff token: continues the SAME vault from another channel. */
app.post('/api/vaults/handoff/resolve', (req, res) => {
  const result = handoff.resolveHandoff(req.body?.token ?? req.get('x-vault-token'));
  if (!result.ok) return res.status(403).json({ error: result.reason });
  const participant = vault.getParticipant(result.participantId);
  if (participant) {
    footsteps.recordFootstep({
      vaultId: result.vaultId,
      kind: 'handoff_resolved',
      actorId: participant.userId,
      actorName: participant.name,
      channel: result.toChannel ?? 'web',
      dedupeKey: `handoff:${result.participantId}:${result.vaultId}`,
      metadata: { fromChannel: result.fromChannel, toChannel: result.toChannel }
    });
  }
  res.json({
    vault: vault.vaultView(participant?.userId ?? null, result.vaultId),
    participant: participant ? { id: participant.id, role: participant.role } : null
  });
});

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
