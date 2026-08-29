// RELEASE SMOKE — browser-shaped read + optional write cycle
//
// Run against the same proxy a browser uses:
//   BRIEF_LIVE_URL=http://127.0.0.1:4173/ingest node live/5-release-smoke.mjs
//
// Set RELEASE_SMOKE_WRITES=1 to exercise authenticated create/cancel flows too.
// Those writes use unique test records, cancel/archive what they create, and
// never claim that an unavailable public origin or news provider is healthy.

const BASE = String(process.env.BRIEF_LIVE_URL || 'http://127.0.0.1:4173/ingest').replace(/\/+$/, '');
let pass = 0;
let fail = 0;
const check = (name, condition, detail = '') => {
  if (condition) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
};

async function call(path, method = 'GET', body, token = null) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* report shape below */ }
    return { status: response.status, body: parsed };
  } catch (error) {
    return { status: 0, body: null, error: String(error?.message ?? error) };
  }
}

console.log(`=== RELEASE SMOKE against ${BASE} ===`);

const release = await call('/api/release');
check('current release handshake is reachable', release.status === 200, JSON.stringify(release.body));
check('release contract is gallery-banners-v1', release.body?.apiContractVersion === 'gallery-banners-v1');
check('release carries a server timestamp', typeof release.body?.serverTime === 'string');

const config = await call('/api/config');
check('public config is reachable', config.status === 200, JSON.stringify(config.body));
check('config still has the canonical campaign prefix', config.body?.campaignPathPrefix === '/c/');

// The app gate (2026-08-29): anonymous data reads answer 401. Phase 5
// verifies BOTH halves: the refusal without an account, and the same reads
// succeeding with a session minted for the smoke run.
const gateFeed = await call('/api/feed');
check('the app gate refuses an anonymous feed read (401)', gateFeed.status === 401 && gateFeed.body?.gate === 'account_required', JSON.stringify(gateFeed.body).slice(0, 120));
const smokeReg = await call('/api/auth/register', 'POST', { handle: 'smoke_' + Date.now().toString(36), password: 'a good passphrase' });
const SMOKE = smokeReg.body?.token;
check('the smoke run registers an account (the gate opens)', typeof SMOKE === 'string');
const feed = await call('/api/feed', 'GET', undefined, SMOKE);
check('home feed is reachable through the browser proxy', feed.status === 200, JSON.stringify(feed.body).slice(0, 180));
check('home feed carries a generated timestamp', typeof feed.body?.meta?.generatedAt === 'string');
if (feed.body?.meta?.generatedAt) {
  const age = Date.now() - Date.parse(feed.body.meta.generatedAt);
  check('home feed timestamp is current, not a frozen old deployment', Number.isFinite(age) && age >= -60_000 && age < 10 * 60_000, `ageMs=${age}`);
}

const banners = await call('/api/banners', 'GET', undefined, SMOKE);
check('new banner endpoint is reachable', banners.status === 200, JSON.stringify(banners.body));
check('banner endpoint returns an array', Array.isArray(banners.body?.banners));

const beta = await call('/api/arena/beta', 'GET', undefined, SMOKE);
check('Arena beta entry point is reachable', beta.status === 200, JSON.stringify(beta.body));
check('Arena beta exposes its target contract', beta.body?.beta?.targets?.signups === 100);

const wire = await call('/api/wire', 'GET', undefined, SMOKE);
check('news wire endpoint is reachable', wire.status === 200, JSON.stringify(wire.body).slice(0, 180));
check('news response has Kenya and world arrays', Array.isArray(wire.body?.wire?.kenya) && Array.isArray(wire.body?.wire?.world));
check('news response explains its source or failure', typeof wire.body?.wire?.source === 'string' && (typeof wire.body?.wire?.note === 'string' || typeof wire.body?.wire?.error === 'string' || wire.body?.wire?.error === null));
if (wire.body?.wire?.fetchedAt) {
  const age = Date.now() - Date.parse(wire.body.wire.fetchedAt);
  check('news check timestamp is current', Number.isFinite(age) && age >= -60_000 && age < 20 * 60_000, `ageMs=${age}`);
}

const writes = process.env.RELEASE_SMOKE_WRITES === '1';
if (!writes) {
  console.log('  INFO  write cycle skipped; set RELEASE_SMOKE_WRITES=1 to exercise create/cancel flows');
} else {
  const id = Date.now().toString(36);
  const registration = await call('/api/auth/register', 'POST', {
    handle: `smoke_${id}`,
    password: 'release smoke passphrase',
    displayName: 'Release Smoke'
  }, null);
  check('a real test user can register', registration.status === 201, JSON.stringify(registration.body).slice(0, 180));
  const token = registration.body?.token;
  check('registration returns a session token', typeof token === 'string' && token.length > 20);

  if (token) {
    const joined = await call('/api/arena/beta/join', 'POST', { segment: 'casual', acquisitionSource: 'release_smoke' }, token);
    check('authenticated player can join the beta', joined.status === 201 || joined.status === 200, JSON.stringify(joined.body));

    const challenge = await call('/api/arena/challenges', 'POST', { gameId: 'efootball', stake: 'friendly', openMinutes: 5 }, token);
    check('authenticated player can create a challenge', challenge.status === 201, JSON.stringify(challenge.body));
    if (challenge.body?.challenge?.id) {
      const cancelled = await call(`/api/arena/challenges/${encodeURIComponent(challenge.body.challenge.id)}/cancel`, 'POST', {}, token);
      check('the created challenge can be cancelled', cancelled.status === 200 && cancelled.body?.challenge?.status === 'cancelled', JSON.stringify(cancelled.body));
    }

    const campaign = await call('/api/campaigns', 'POST', {
      title: `Release smoke ${id}`,
      description: 'Temporary release-cycle campaign.',
      type: 'popup',
      location: 'Nairobi',
      price: 0
    }, token);
    check('authenticated player can create a campaign', campaign.status === 201, JSON.stringify(campaign.body).slice(0, 180));
    const campaignId = campaign.body?.campaign?.id;
    if (campaignId) {
      const published = await call(`/api/campaigns/${encodeURIComponent(campaignId)}/publish`, 'POST', {}, token);
      check('created campaign can be published', published.status === 200, JSON.stringify(published.body).slice(0, 160));
      const banner = await call(`/api/campaigns/${encodeURIComponent(campaignId)}/banner`, 'POST', {
        headline: 'Release smoke banner',
        body: 'Temporary banner created by the release cycle.'
      }, token);
      check('published campaign can create a standalone banner', banner.status === 201 || banner.status === 200, JSON.stringify(banner.body).slice(0, 180));
      const share = banner.body?.banner?.share;
      if (share?.available) {
        check('WhatsApp intent link is a real wa.me URL', typeof share.channels?.whatsapp === 'string' && share.channels.whatsapp.startsWith('https://wa.me/?text='));
      } else {
        check('missing public origin is reported honestly', share?.available === false && typeof share?.reason === 'string', JSON.stringify(share));
      }
      if (banner.body?.banner?.id) {
        const archived = await call(`/api/banners/${encodeURIComponent(banner.body.banner.id)}/archive`, 'POST', {}, token);
        check('created banner can be archived', archived.status === 200 && archived.body?.banner?.status === 'archived', JSON.stringify(archived.body));
      }
      await call(`/api/campaigns/${encodeURIComponent(campaignId)}/cancel`, 'POST', {}, token);
    }
  }
}

console.log(`\nPASSED ${pass}   FAILED ${fail}`);
process.exit(fail ? 1 : 0);
