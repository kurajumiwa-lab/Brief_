// ---------------------------------------------------------------------------
// ENGINE — UNIVERSAL DATA ROUTER
//
// Elevates "the app shows me an update" into "the update reaches my workflow":
// when a signal fires, matching ROUTING RULES compile a lightweight,
// HMAC-signed payload and dispatch it to any endpoint —
//
//   webhook   any HTTPS URL (custom API)       -> POST JSON + signature header
//   discord   a Discord incoming-webhook URL  -> POST JSON (embed-ish text)
//   slack     a Slack incoming-webhook URL    -> POST JSON (text field)
//   whatsapp  a phone number                  -> via the outbound seam
//   sms       a phone number                  -> via the outbound seam
//
// AUTHENTICITY: every webhook payload is signed with HMAC-SHA256 over the
// exact bytes sent (x-brief-signature). Receivers verify with the shared
// ENGINE_ROUTER_SECRET. Without the secret configured, webhook deliveries
// REFUSE (fail-closed) rather than dispatch unsigned — exactly like the
// payment rails in this codebase.
//
// ACCOUNTABILITY: every attempt lands in the engineDeliveries ledger with a
// status and the named failure reason. Nothing is recorded as delivered that
// was not.
//
// This module never decides WHEN to dispatch — routing rules do, and they are
// the user's own conditional rules (signal type + optional object match).
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import { store, newId } from '../../store.js';
import * as outbound from '../../outbound.js';

export const CHANNEL_KINDS = ['webhook', 'discord', 'slack', 'whatsapp', 'sms'];
const HTTP_KINDS = new Set(['webhook', 'discord', 'slack']);

const nowIso = () => new Date().toISOString();

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

export function routerSecret() {
  return env('ENGINE_ROUTER_SECRET');
}

export function routerStatus() {
  return {
    signingConfigured: Boolean(routerSecret()),
    channels: CHANNEL_KINDS.map((kind) => ({
      kind,
      configured: HTTP_KINDS.has(kind) ? true : outbound.canSend(kind)
    }))
  };
}

// ---- routing rules ----------------------------------------------------------

export function createRoute({ ownerId, name, match = {}, channels = [], enabled = true }, { maxRoutes = null } = {}) {
  if (!ownerId) throw new Error('ownerId is required');
  if (!name || !String(name).trim()) throw new Error('a route needs a name');
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new Error('a route needs at least one channel');
  }
  for (const c of channels) {
    if (!CHANNEL_KINDS.includes(c.kind)) throw new Error(`unknown channel kind: ${c.kind}`);
    if (!c.to || !String(c.to).trim()) throw new Error(`channel ${c.kind} needs a target`);
  }
  if (match.signalType && match.signalType !== '*' && !/^[a-z0-9_]+$/.test(match.signalType)) {
    throw new Error('signalType must be a known signal name or "*"');
  }

  // Tier cap enforced at creation: the guardrail is server-authoritative.
  const mine = store.filter('engineRoutes', (r) => r.ownerId === ownerId && r.status !== 'deleted');
  if (maxRoutes != null && mine.length >= maxRoutes) {
    const err = new Error(`your tier allows ${maxRoutes} routing route${maxRoutes === 1 ? '' : 's'}`);
    err.code = 'tier_limit';
    throw err;
  }

  // Idempotent create: same name for the same owner reuses the route.
  const existing = mine.find((r) => r.name === name.trim());
  if (existing) {
    return store.update('engineRoutes', existing.id, {
      match, channels, enabled: enabled !== false, updatedAt: nowIso()
    });
  }

  const now = nowIso();
  return store.insert('engineRoutes', {
    id: newId('ert'),
    ownerId,
    name: String(name).trim(),
    match: { signalType: match.signalType ?? '*', objectId: match.objectId ?? null },
    channels,
    enabled: enabled !== false,
    status: 'active',
    createdAt: now,
    updatedAt: now
  });
}

export function listRoutes({ ownerId } = {}) {
  let rows = store.all('engineRoutes');
  if (ownerId) rows = rows.filter((r) => r.ownerId === ownerId);
  return rows.filter((r) => r.status !== 'deleted')
    .slice().sort((a, b) => String(a.createdAt).localeCompare(b.createdAt));
}

export function deleteRoute(routeId, ownerId) {
  const r = store.find('engineRoutes', (x) => x.id === routeId);
  if (!r || r.status === 'deleted') throw new Error('route not found');
  if (r.ownerId !== ownerId) throw new Error('not your route');
  return store.update('engineRoutes', routeId, { status: 'deleted', updatedAt: nowIso() });
}

export function routeMatches(route, signal) {
  if (!route.enabled || route.status === 'deleted') return false;
  const want = route.match?.signalType ?? '*';
  if (want !== '*' && want !== signal.type) return false;
  if (route.match?.objectId && route.match.objectId !== signal.objectId) return false;
  return true;
}

// ---- payload + signature -----------------------------------------------------

/**
 * Compile the lightweight payload for a signal. Deliberately small: identity,
 * routing-relevant facts and a timestamp. No full row bodies — receivers that
 * need detail call the API with the id.
 */
export function compilePayload(signal) {
  return {
    engine: 'brief.engine/1',
    id: signal.id,
    type: signal.type,
    objectId: signal.objectId ?? null,
    circleId: signal.circleId ?? null,
    actorId: signal.actorId ?? null,
    value: signal.value ?? null,
    at: signal.createdAt
  };
}

export function signPayload(bodyBytes) {
  const secret = routerSecret();
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(bodyBytes).digest('hex');
}

/** The exact bytes a receiver can verify against x-brief-signature. */
export function payloadBytes(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

// ---- dispatch -----------------------------------------------------------------

export async function dispatchToChannel(channel, payload, { fetchImpl = fetch } = {}) {
  const body = payloadBytes(payload);
  const signature = signPayload(body);
  const record = {
    id: newId('edl'),
    routeId: null,
    channel: channel.kind,
    target: String(channel.to),
    signalId: payload.id,
    status: 'failed',
    attempts: 1,
    error: null,
    at: nowIso(),
    updatedAt: nowIso()
  };

  if (HTTP_KINDS.has(channel.kind)) {
    if (!signature) {
      // Fail closed: an unsigned dispatch is a lie about authenticity.
      record.status = 'refused';
      record.error = 'router secret not configured — refusing to dispatch unsigned';
      store.insert('engineDeliveries', record);
      return { ok: false, reason: 'unsigned_refused', delivery: record };
    }
    const jsonBody = channel.kind === 'webhook'
      ? body.toString('utf8')
      : JSON.stringify(channel.kind === 'discord'
        ? { content: `[brief] ${payload.type} — ${payload.id}` }
        : { text: `[brief] ${payload.type} — ${payload.id}` });
    try {
      const res = await fetchImpl(String(channel.to), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-brief-signature': signature,
          'x-brief-signature-alg': 'hmac-sha256',
          'x-brief-engine': 'brief.engine/1'
        },
        body: jsonBody
      });
      record.status = res.ok ? 'delivered' : 'failed';
      record.error = res.ok ? null : `endpoint answered ${res.status}`;
      store.insert('engineDeliveries', record);
      return { ok: res.ok, reason: res.ok ? null : `endpoint_${res.status}`, delivery: record };
    } catch (e) {
      record.error = String(e.message ?? e);
      store.insert('engineDeliveries', record);
      return { ok: false, reason: 'network_error', delivery: record };
    }
  }

  // whatsapp / sms ride the outbound seam, which fails closed on its own.
  const text = `[brief] ${payload.type}${payload.objectId ? ` (${payload.objectId})` : ''} — ${payload.id}`;
  const sent = await outbound.send({ channel: channel.kind, to: String(channel.to), text });
  record.status = sent.ok ? 'delivered' : 'refused';
  record.error = sent.ok ? null : (sent.reason ?? 'not configured');
  store.insert('engineDeliveries', record);
  return { ok: sent.ok, reason: sent.reason ?? null, delivery: record };
}

/**
 * Dispatch one signal to every matching route the owner has.
 * Fire-and-forget safe: never throws to the caller (signal emission must not
 * break because a webhook endpoint is down); every failure is in the ledger.
 */
export async function dispatchForSignal(signal, { fetchImpl = fetch } = {}) {
  const routes = store.all('engineRoutes').filter((r) => routeMatches(r, signal));
  if (!routes.length) return { matched: 0, results: [] };
  const payload = compilePayload(signal);
  const results = [];
  for (const route of routes) {
    for (const channel of route.channels) {
      const r = await dispatchToChannel(channel, payload, { fetchImpl });
      if (r.delivery) store.update('engineDeliveries', r.delivery.id, { routeId: route.id });
      results.push({ routeId: route.id, route: route.name, ...r });
    }
  }
  return { matched: routes.length, results };
}

export function listDeliveries({ limit = 50 } = {}) {
  return store.all('engineDeliveries')
    .slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit);
}
