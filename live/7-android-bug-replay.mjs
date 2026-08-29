// LIVE PHASE 7 — the Android bug report (2026-08-29), replayed end-to-end
// against a running production server on :8787. Three journeys that were
// dead on real data:
//   (a) the tea studio: a plain signed-in user writes, uploads a real image,
//       saves and publishes their OWN story;
//   (b) the EPL room: pool present, XI pickable within budget, seat submitted;
//   (c) anonymous browsing: rooms + catalog readable signed out.
// Usage: node live/7-android-bug-replay.mjs   (server must be up on :8787)
const BASE = 'http://127.0.0.1:8787';
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? ' -> ' + String(detail).slice(0, 200) : '')); }
};
const call = async (path, method = 'GET', body, token) => {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => null) };
};

// ---------- (c) the app gate: no access without an account ------------------
// Product decision 2026-08-29: every data read answers 401 to an anonymous
// caller. Only sign-in, ops probes and the external campaign share face stay
// open. The catalog self-heal now runs on the first AUTHED read below.
{
  let r = await call('/api/epl/competitions');
  check('[gate] the EPL rooms list is closed to anonymous callers', r.status === 401 && r.body?.gate === 'account_required', r.status);
  r = await call('/api/epl/catalog');
  check('[gate] the catalog is closed to anonymous callers', r.status === 401, r.status);
  r = await call('/api/feed');
  check('[gate] the live feed is closed to anonymous callers', r.status === 401, r.status);
  r = await call('/api/auth/providers');
  check('[gate] sign-in options remain reachable (providers object)',
    r.status === 200 && r.body?.providers?.password?.configured === true
      && r.body?.providers?.google?.configured === false
      && /GOOGLE_CLIENT_ID/.test(r.body?.providers?.google?.reason ?? ''),
    JSON.stringify(r.body?.providers).slice(0, 120));
  r = await call('/api/public/campaigns/not-a-real-slug');
  check('[gate] the external campaign share face stays open (404, not 401)', r.status === 404, r.status);
}

// ---------- (a) the tea studio, as a brand-new user ----------
const U = (await call('/api/auth/register', 'POST', {
  handle: 'live7_' + Date.now().toString(36), password: 'a good passphrase', displayName: 'Live Seven'
})).body;
check('a fresh user registers', Boolean(U?.token));

// ---------- (a0) authed: the catalog self-heals and states its source ------
{
  const c = await call('/api/epl/catalog', 'GET', undefined, U.token);
  const players = c.body?.players ?? [];
  check('[catalog] populated on real data once signed in (self-healed)', players.length >= 200, players.length);
  check('[catalog] every row states SEED provenance', players.every((p) => p.source === 'seed'));
  const provider = c.body?.provider?.configured === false ? c.body?.provider?.reason ?? '' : '';
  check('[catalog] the provider state is said in words (not "live")', /seed|no epl data provider/i.test(provider), provider);
}


let r = await call('/api/admin/tea', 'GET', undefined, U.token);
check('[tea] a plain author opens their story list (no capability needed)', r.status === 200 && Array.isArray(r.body?.articles), r.status);
check('[tea] the list is scoped: nothing foreign, nothing unpublished', r.body.articles.every((a) => a.createdBy === U.user.id || a.status === 'published'));

// a REAL PNG (magic bytes \x89PNG) uploaded as multipart; the server sniffs
const png = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000'
  + '01f15c4890000000d49444154789c6360000002000154a24f4f0000000049454e44ae426082', 'hex');
const form = new FormData();
form.append('file', new Blob([png], { type: 'image/png' }), 'hero.png');
form.append('alt', 'live phase seven hero');
let up = await fetch(BASE + '/api/media/upload', { method: 'POST', headers: { authorization: `Bearer ${U.token}` }, body: form });
const upBody = await up.json().catch(() => null);
check('[image] a real PNG uploads from a plain account', up.status === 201 && Boolean(upBody?.upload?.id), `${up.status}`);
check('[image] the server sniffed the type from the bytes (image/png)', upBody?.upload?.mimeType === 'image/png', upBody?.upload?.mimeType);

r = await call('/api/admin/tea', 'POST', {
  title: 'Live phase seven: the studio works',
  dek: 'written, illustrated, published by its author',
  body: 'A brand-new user wrote this story, uploaded a real image and published it — the exact journey that dead-ended on Android.',
  category: 'live', location: 'Nairobi',
  theme: 'serif', layout: 'classic', accent: '#111111',
  heroImage: upBody?.upload?.url ?? null
}, U.token);
const articleId = r.body?.article?.id;
check('[tea] the story is created with the uploaded hero', r.status === 201 && Boolean(articleId), `${r.status}`);

r = await call(`/api/admin/tea/${articleId}/publish`, 'POST', {}, U.token);
check('[tea] the author publishes their OWN story (no moderator)', /^20[04]$/.test(String(r.status)) || r.body?.article?.status === 'published', `${r.status}`);
r = await call('/api/admin/tea', 'GET', undefined, U.token);
const own = r.body.articles.find((a) => a.id === articleId);
check('[tea] the published story sits in the author’s list', own?.status === 'published');

// ---------- (b) the EPL room, end to end ----------
r = await call('/api/epl/competitions', 'POST', {
  title: 'GW-Live7 room', kickoffAt: new Date(Date.now() + 7_200_000).toISOString(),
  budgetKes: 750, minEntries: 2, maxEntries: 8
}, U.token);
const roomId = r.body?.competition?.id;
check('[epl] a room is created', r.status === 201 && Boolean(roomId), `${r.status}`);

r = await call(`/api/epl/competitions/${roomId}/pool/import`, 'POST', {}, U.token);
check('[epl] the pool imports and the room OPENS (the dead-end step)', r.status === 201 && (r.body?.imported ?? 0) >= 200 && r.body?.opened === true, JSON.stringify(r.body)?.slice(0, 80));

// Picks come from the ROOM'S imported pool (its rows are distinct from the
// catalog rows they came from) -- exactly what the desk's seat picker does.
const poolResp = await call(`/api/epl/competitions/${roomId}/pool`, 'GET', undefined, U.token);
const pool = poolResp.body?.players ?? [];
const byPos = (pos) => pool.filter((p) => p.position === pos);
// 1-4-4-2 spread across clubs (max 3 per club), cost 570 <= 750
const xi = [byPos('GK')[0],
  ...byPos('DEF').slice(0, 2), byPos('DEF').slice(10, 12)[0], byPos('DEF').slice(30, 31)[0],
  ...byPos('MID').slice(0, 2), ...byPos('MID').slice(10, 12),
  byPos('FWD')[0], byPos('FWD').slice(10, 11)[0]];
const clubs = {};
for (const p of xi) clubs[p.club] = (clubs[p.club] ?? 0) + 1;
const cost = xi.reduce((s, p) => s + p.price, 0);
check('[epl] the room pool is populated for picking', pool.length >= 200, pool.length);
check('[epl] an affordable 11 across clubs was chosen from the pool', xi.length === 11 && Math.max(...Object.values(clubs)) <= 3 && cost <= 750, `size=${xi.length} cost=${cost}`);

r = await call(`/api/epl/competitions/${roomId}/entries`, 'POST', { playerIds: xi.map((p) => p.id), captainId: xi[10].id }, U.token);
check('[epl] the XI is seated (the dead-end screen)', /^20[01]$/.test(String(r.status)) && r.body?.entry?.playerIds?.length === 11, `${r.status}`);

// Over-budget + feasibility + phantom-room honesty probes.
{
  const r2 = await call('/api/epl/competitions', 'POST', {
    title: 'GW-Live7 tight room', kickoffAt: new Date(Date.now() + 7_200_000).toISOString(),
    budgetKes: 550, minEntries: 2, maxEntries: 8
  }, U.token);
  const tight = r2.body?.competition?.id;
  await call(`/api/epl/competitions/${tight}/pool/import`, 'POST', {}, U.token);
  const tp = (await call(`/api/epl/competitions/${tight}/pool`, 'GET', undefined, U.token)).body.players;
  const tpByPos = (pos) => tp.filter((p) => p.position === pos);
  // max-cost legal XI at SEED prices: 1 GK + 5 DEF + 2 MID + 3 FWD = 570
  const richRows = [tpByPos('GK')[0], ...tpByPos('DEF').slice(0, 5), ...tpByPos('MID').slice(0, 2), ...tpByPos('FWD').slice(0, 3)];
  const richCost = richRows.reduce((t, p) => t + p.price, 0);
  r = await call(`/api/epl/competitions/${tight}/entries`, 'POST', { playerIds: richRows.map((p) => p.id), captainId: richRows[0].id }, U.token);
  check('[epl] an over-budget XI is refused with the arithmetic',
    r.status === 400 && new RegExp(`costs ${richCost} but the budget is 550`).test(r.body?.error ?? ''),
    `${r.body?.error} (richCost=${richCost})`);
  r = await call('/api/epl/competitions', 'POST', {
    title: 'GW-Live7 impossible room', kickoffAt: new Date(Date.now() + 7_200_000).toISOString(),
    budgetKes: 100, minEntries: 2, maxEntries: 8
  }, U.token);
  check('[epl] an unseatable budget is refused at creation with the arithmetic',
    r.status === 400 && /cannot seat any squad.*cheapest XI here costs 550/.test(r.body?.error ?? ''), r.body?.error);
  r = await call('/api/epl/competitions', 'GET', undefined, U.token);
  check('[epl] a refused creation leaves no phantom room',
    !(r.body?.competitions ?? []).some((x) => x.title === 'GW-Live7 impossible room'));
}

r = await call(`/api/epl/competitions/${roomId}/lobby`, 'GET', undefined, U.token);
check('[epl] the room reads one seated manager, waiting for the second', r.body?.lobbyState === 'waiting_for_players' && r.body?.entries === 1, JSON.stringify(r.body)?.slice(0, 120));
r = await call('/api/epl/competitions', 'GET', undefined, U.token);
check('[epl] the room appears in the signed-in rooms list with its state', ((r.body?.competitions ?? []).some((x) => x.id === roomId && x.lobbyState === 'waiting_for_players')));

console.log(`\nLIVE PHASE 7:  PASSED ${pass}   FAILED ${fail}`);
process.exit(fail ? 1 : 0);
