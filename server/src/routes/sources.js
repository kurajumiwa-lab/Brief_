// SOURCES ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { store, newId } from '../store.js';
import { callerId } from '../identity.js';
import * as web from '../connectors/web.js';
import { requireAuth, now } from './helpers.js';

import { requireFeature } from '../features.js';

export function register(app) {
app.use('/api/sources', requireFeature('sources'));
// --- Sources (spec 2) --------------------------------------------------------


app.get('/api/sources', (req, res) => {
  const sources = store.all('sources').map((s) => {
    const raws = store.filter('rawItems', (r) => r.sourceId === s.id);
    const objs = new Set(
      store.filter('objectSources', (o) => o.sourceId === s.id).map((o) => o.objectId)
    );
    const membership = store.find(
      'sourceMemberships',
      (m) => m.sourceId === s.id && m.userId === callerId(req)
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
  // AUTHORIZATION + IDENTITY. Two defects lived here. The row was written
  // against the hard-coded single-user constant instead of the caller, so a
  // real member's grant landed on `usr_me` and never governed anything for
  // them; and with the development fallback on, an anonymous caller granting
  // `owner` to that constant granted it to themselves. A membership is a
  // claim about YOU, so it needs an identity and it must be that identity.
  if (!requireAuth(req, res)) return;
  const source = store.find('sources', (s) => s.id === req.params.id);
  if (!source) return res.status(404).json({ error: 'source not found' });

  const { membershipStatus, accessMethod } = req.body ?? {};
  const VALID = ['member', 'admin', 'owner', 'authorized', 'unknown'];
  if (!VALID.includes(membershipStatus)) {
    return res.status(400).json({ error: `membershipStatus must be one of ${VALID.join(', ')}` });
  }

  const me = callerId(req);
  const existing = store.find(
    'sourceMemberships',
    (m) => m.sourceId === source.id && m.userId === me
  );
  const row = existing
    ? store.update('sourceMemberships', existing.id, {
        membershipStatus,
        accessGranted: membershipStatus !== 'unknown',
        accessMethod: accessMethod ?? 'declared'
      })
    : store.insert('sourceMemberships', {
        id: newId('mem'),
        userId: me,
        sourceId: source.id,
        membershipStatus,
        accessGranted: membershipStatus !== 'unknown',
        accessMethod: accessMethod ?? 'declared',
        connectedAt: now()
      });
  res.json({ membership: row });
});
}

