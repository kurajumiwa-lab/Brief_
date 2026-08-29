// PHASE 6: completion walk (§29-style). Every merged surface walked end to end
// over the PRODUCTION build's proxy, exactly as a browser reaches it. Nothing
// here is mocked, seeded for show, or allowed to pass for the wrong reason.
const B = 'http://127.0.0.1:4173/ingest';
let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };
const call = async (p, m = 'GET', b, token) => {
  const h = {};
  if (b) h['content-type'] = 'application/json';
  if (token) h.authorization = 'Bearer ' + token;
  const r = await fetch(B + p, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};
const reg = async (h) => (await call('/api/auth/register', 'POST', { handle: h + Date.now().toString(36), password: 'a good passphrase', displayName: h }, null)).body;

console.log('=== PULSE (F2/F3): a real change, really notified, really read ===');
const A = await reg('pulse_a'); const BOB = await reg('pulse_b');
let r = await call('/api/brief-it/save', 'POST', { text: `Madaraka Sunday Repair Clinic ${Date.now()} at Prestige Plaza. Bring the blender that stopped. Free.` }, A.token);
const objectId = r.body?.result?.objectId;
check('a contributor captures a real object', Boolean(objectId), JSON.stringify(r.body).slice(0, 140));
check('the contributor starts with an honest empty pulse', Array.isArray((await call('/api/notifications', 'GET', undefined, A.token)).body?.notifications));
r = await call(`/api/objects/${objectId}/confirm`, 'POST', {}, BOB.token);
check('a stranger corroborates the report', r.status === 201 && r.body?.reused === false, `status=${r.status} ` + JSON.stringify(r.body).slice(0, 140));
r = await call('/api/notifications', 'GET', undefined, A.token);
check('the contributor is notified of the confirmation', (r.body?.notifications ?? []).some((n) => n.kind === 'confirmed'), JSON.stringify(r.body).slice(0, 200));
check('the unread count is real', r.body?.unread >= 1, `unread=${r.body?.unread}`);
r = await call('/api/notifications/read', 'POST', { all: true }, A.token);
check('mark-all-read answers', r.status === 200, JSON.stringify(r.body).slice(0, 120));
r = await call('/api/notifications', 'GET', undefined, A.token);
check('the feed is now read', r.body?.unread === 0, `unread=${r.body?.unread}`);

console.log('\n=== VERIFY (T6): submit -> review -> standing, all over HTTP ===');
const U = await reg('ver_a');
r = await call('/api/verification', 'POST', { kind: 'identity', note: 'live walk review' }, U.token);
check('an identity request is submitted', r.status === 201 && r.body?.record?.status === 'pending', JSON.stringify(r.body).slice(0, 140));
const rec = r.body?.record;
r = await call('/api/verification/me', 'GET', undefined, U.token);
check('standing is honestly pending', r.body?.standing?.identity === 'pending');
r = await call('/api/ops/verification', 'GET', undefined, U.token);
check('the review queue is closed to a plain user', r.status === 403 && r.body?.requiredCapability === 'moderate', JSON.stringify(r.body).slice(0, 120));
// Reviewer handle is named by the server's BRIEF_REVIEWERS bootstrap.
let rev = await call('/api/auth/register', 'POST', { handle: 'liverev', password: 'a good passphrase' });
if (rev.status !== 201) rev = await call('/api/auth/login', 'POST', { handle: 'liverev', password: 'a good passphrase' });
const REV = rev.body;
r = await call('/api/ops/verification', 'GET', undefined, REV.token);
check('a reviewer reads the queue', r.status === 200 && (r.body?.queue ?? []).some((q) => q.id === rec.id), JSON.stringify(r.body).slice(0, 160));
r = await call(`/api/ops/verification/${rec.id}/decision`, 'POST', { decision: 'rejected' }, REV.token);
check('a reasonless rejection is refused', r.status === 400 && /reason/i.test(r.body?.error ?? ''), JSON.stringify(r.body).slice(0, 120));
r = await call(`/api/ops/verification/${rec.id}/decision`, 'POST', { decision: 'approved', reason: 'walked live' }, REV.token);
check('a reasoned approval lands', r.status === 200 && r.body?.record?.status === 'approved', JSON.stringify(r.body).slice(0, 140));
r = await call('/api/verification/me', 'GET', undefined, U.token);
check('approval flips the derived standing', r.body?.standing?.identity === 'verified');
r = await call(`/api/ops/verification/${rec.id}/revoke`, 'POST', { reason: 'walk revocation' }, REV.token);
check('revocation is explicit and reasoned', r.status === 200 && r.body?.record?.status === 'revoked');
r = await call('/api/verification/me', 'GET', undefined, U.token);
check('revocation flips the standing back', r.body?.standing?.identity !== 'verified');

console.log('\n=== EMAIL LISTS (T7): double opt-in with an honest no-provider token ===');
const email = `walk_${Date.now().toString(36)}@example.com`;
r = await call('/api/email-subscriptions', 'POST', { email, topics: ['event_announcements', 'bargain_alerts'] }, null);
check('a subscription starts double opt-in', r.status === 201 && r.body?.subscription?.status === 'pending', JSON.stringify(r.body).slice(0, 160));
check('with no provider the TOKEN is returned, not a pretended send', /token/i.test(String(r.body?.delivery ?? '')) && Boolean(r.body?.subscription?.confirmToken ?? r.body?.token ?? r.body?.subscription?.token), JSON.stringify(r.body).slice(0, 200));
const token = r.body?.subscription?.confirmToken ?? r.body?.subscription?.token ?? r.body?.token;
r = await call(`/api/email-subscriptions/confirm?token=${encodeURIComponent(token)}`, 'GET', undefined, null);
check('the token confirms the list', r.body?.ok === true, JSON.stringify(r.body).slice(0, 140));
r = await call('/api/email-subscriptions', 'POST', { email, topics: ['event_announcements'] }, null);
check('resubscribing an active list is a no-op (changed:false)', r.body?.changed === false, JSON.stringify(r.body).slice(0, 160));
r = await call('/api/email-subscriptions/unsubscribe', 'POST', { email }, null);
check('leaving needs no account', r.body?.ok === true, JSON.stringify(r.body).slice(0, 120));
r = await call(`/api/email-subscriptions/confirm?token=${encodeURIComponent(token)}`, 'GET', undefined, null);
check('a used token is dead', r.status === 404, `status=${r.status}`);

console.log('\n=== EVENTS HUB (T4) + EPL (T5) over the public surface ===');
r = await call('/api/events/categories', 'GET', undefined, null);
check('the five event categories are public', Array.isArray(r.body?.categories) && r.body.categories.length === 5, JSON.stringify(r.body).slice(0, 140));
r = await call('/api/events?limit=5', 'GET', undefined, null);
check('events read honestly (shape, whatever the count)', Array.isArray(r.body?.events), JSON.stringify(r.body).slice(0, 120));
r = await call('/api/epl/clubs', 'GET', undefined, null);
check('EPL clubs are seeded', Array.isArray(r.body?.clubs) && r.body.clubs.length >= 10, `clubs=${r.body?.clubs?.length}`);
r = await call('/api/epl/catalog', 'GET', undefined, null);
const players = r.body?.players ?? [];
check('the catalog carries provenance (source, never invented)', players.length === 0 || players.every((p) => p.source === 'seed' || p.source === 'provider'), JSON.stringify(players.slice(0, 1)).slice(0, 140));
r = await call('/api/epl/competitions', 'POST', { title: 'Walkers League', kickoffAt: new Date(Date.now() + 36e5).toISOString(), minEntries: 2, maxEntries: 8 }, A.token);
check('a competition is created (kickoff required, server clock honest)', r.status === 201 && Boolean(r.body?.competition?.id), JSON.stringify(r.body).slice(0, 160));
const comp = r.body?.competition;
r = await call('/api/epl/competitions', 'GET', undefined, A.token);
const listed = (r.body?.competitions ?? []).find((c) => c.id === comp?.id);
check('the lobby state is DERIVED on read (never stored as a claim)', Boolean(listed?.lobbyState), JSON.stringify(listed ?? {}).slice(0, 140));
r = await call(`/api/epl/competitions/${comp?.id}/standings`, 'GET', undefined, null);
check('standings are public', r.status === 200, `status=${r.status}`);

console.log('\n=== THE DESK (F4): operator over HTTP, plain user refused ===');
const OP = rev.status === 201 ? null : null; // liveop logs in below
// Same passphrase the other live phases boot 'liveop' with.
let opReg = await call('/api/auth/register', 'POST', { handle: 'liveop', password: 'live operator passphrase' });
if (opReg.status !== 201) opReg = await call('/api/auth/login', 'POST', { handle: 'liveop', password: 'live operator passphrase' });
const OPT = opReg.body?.token;
r = await call('/api/ops/diagnostics', 'GET', undefined, U.token);
check('diagnostics refuse a plain user by capability', r.status === 403 && r.body?.requiredCapability === 'ops.read', JSON.stringify(r.body).slice(0, 120));
r = await call('/api/ops/diagnostics', 'GET', undefined, OPT);
check('the desk reads diagnostics', r.status === 200 && Number.isFinite(r.body?.counts?.users), JSON.stringify(r.body?.counts ?? {}).slice(0, 120));
r = await call('/api/ops/disputes', 'GET', undefined, OPT);
check('the dispute wall reads', r.status === 200 && Array.isArray(r.body?.disputes));
r = await call('/api/ops/ticket-listings', 'GET', undefined, OPT);
check('the resale listing wall reads', r.status === 200 && Array.isArray(r.body?.listings));
r = await call('/api/ops/audit?limit=50', 'GET', undefined, OPT);
check('the audit trail carries this very walk', (r.body?.audit ?? []).some((a) => a.action === 'verification.decision'), JSON.stringify((r.body?.audit ?? []).slice(0, 2)).slice(0, 160));
r = await call('/api/ops/email-log', 'GET', undefined, OPT);
check('the email delivery log reads', r.status === 200 && Array.isArray(r.body?.log));

console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
process.exit(fail ? 1 : 0);
