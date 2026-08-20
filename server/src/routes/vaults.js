// VAULTS ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { store } from '../store.js';
import { callerId } from '../identity.js';
import * as vault from '../domain/vault.js';
import * as footsteps from '../domain/footsteps.js';
import * as handoff from '../domain/handoff.js';
import { requireAuth, now } from './helpers.js';

export function register(app) {
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
}

