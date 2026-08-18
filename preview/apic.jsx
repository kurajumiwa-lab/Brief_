// ---------------------------------------------------------------------------
// API CONTRACT SUITE
//
// Verifies the typed client against the REAL response shapes captured from a
// running server, plus the failure modes a live deployment actually produces:
// offline, HTML error page, 404, malformed body, contract drift.
//
// Run: npx esbuild apic.jsx --bundle --platform=node --outfile=apic.run.cjs \
//        --format=cjs --loader:.tsx=tsx --external:jsdom && node apic.run.cjs
// ---------------------------------------------------------------------------

const api = require('./src/api/briefApi.ts');
const { asTarget, idleState } = require('./src/api/types.ts');

let pass = 0;
let fail = 0;
const check = (name, cond, extra) => {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log('  FAIL: ' + name + (extra ? '  -> ' + extra : ''));
  }
};

// --- fetch harness -------------------------------------------------------
let route = () => ({ status: 200, body: '{}' });
global.fetch = async (url, init) => {
  const r = route(String(url), init);
  if (r.throws) throw new Error(r.throws);
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    text: async () => r.body
  };
};
const serve = (status, obj) => () => ({
  status,
  body: typeof obj === 'string' ? obj : JSON.stringify(obj)
});

// Real captured payloads -------------------------------------------------
const CIRCLE = {
  id: 'circ_msxeiopg32necy',
  name: 'School Fees',
  description: '',
  type: 'target',
  status: 'forming',
  visibility: 'invite_only',
  sourceId: null,
  goal: 'Term 3 fees',
  targetValue: 5000,
  deadline: null,
  completionCriteria: null,
  parentCircleId: null,
  createdAt: '2026-08-17T15:41:25.780Z',
  updatedAt: '2026-08-17T15:41:25.780Z',
  currentValue: 2500,
  contributorCount: 1,
  progressPct: 50,
  settledCount: 1,
  blockCount: 1,
  memberCount: 1
};

const MEMBER = {
  id: 'memb_x',
  circleId: CIRCLE.id,
  userId: 'jane',
  role: 'coordinator',
  verifications: ['phone_verified'],
  joinedAt: '2026-08-17T15:41:25.793Z',
  updatedAt: '2026-08-17T15:41:25.811Z',
  trust: {
    evidence: [{ kind: 'phone_verified', label: 'Phone verified' }],
    verifiedCount: 1,
    facts: [
      { kind: 'settled_transactions', label: '1 settled transaction' },
      { kind: 'member_since', label: 'Member since August 2026' }
    ]
  }
};

const WALLET = {
  balance: 0,
  pending: 2500,
  currency: 'KES',
  transactionCount: 1,
  provider: {
    configured: false,
    provider: null,
    reason: 'No payment provider is connected. Balances reflect recorded transactions only; Brief cannot send or receive money.'
  }
};

const CAMPAIGN = {
  id: 'cmp_1', ownerId: 'usr_me', title: 'Saturday Pop-up', type: 'popup',
  status: 'draft', description: null, location: null, startsAt: null, endsAt: null,
  price: 0, currency: 'KES', capacity: null, objectId: 'obj_7', ownsObject: false,
  circleId: null, publicSlug: 'saturday-pop-up-a1b2', metadata: {},
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  metrics: { views: 0, viewers: null, registrations: 0, revenueSettled: 0,
    revenuePending: 0, conversionPct: null, shares: 0, slotsLeft: null }
};

const SETTLED_T = {
  id: 'txn_1', amount: 2500, currency: 'KES', type: 'contribution',
  status: 'settled', description: '', counterparty: 'jane',
  circleId: 'circ_msxeiopg32necy', objectId: null, metadata: {},
  history: [{ status: 'created', at: '2026-08-17T15:41:34.476Z' }],
  createdAt: '2026-08-17T15:41:34.476Z', updatedAt: '2026-08-17T15:41:34.484Z'
};

async function run() {
  console.log('\n=== API CONTRACT ===\n');

  // --- happy path -------------------------------------------------------
  route = serve(200, { circles: [CIRCLE] });
  let r = await api.getCircles();
  check('getCircles ok', r.ok === true);
  check('getCircles returns array', r.ok && r.data.length === 1);
  check('progress read from server', r.ok && r.data[0].currentValue === 2500);
  check('progressPct read from server', r.ok && r.data[0].progressPct === 50);
  check('contributorCount from server', r.ok && r.data[0].contributorCount === 1);

  // --- TARGET is a view, not a primitive --------------------------------
  const t = asTarget(CIRCLE);
  check('asTarget narrows a target', t !== null && t.targetValue === 5000);
  check('asTarget carries derived progress', t !== null && t.currentValue === 2500);
  check('non-target -> null', asTarget({ ...CIRCLE, type: 'gathering' }) === null);
  check('target with no targetValue -> null', asTarget({ ...CIRCLE, targetValue: null }) === null);
  check('target with zero targetValue -> null', asTarget({ ...CIRCLE, targetValue: 0 }) === null);

  route = serve(200, { circles: [CIRCLE, { ...CIRCLE, id: 'c2', type: 'gathering' }] });
  r = await api.getTargets();
  check('getTargets filters non-targets', r.ok && r.data.length === 1);

  // --- ECONOMIC INVARIANT ----------------------------------------------
  // The client must be structurally incapable of submitting progress.
  let sentBody = null;
  route = (url, init) => {
    sentBody = init && init.body ? JSON.parse(init.body) : null;
    return { status: 200, body: JSON.stringify({ circle: CIRCLE }) };
  };
  await api.updateCircle('c1', { name: 'Renamed' });
  check('updateCircle sends only permitted fields', sentBody && sentBody.name === 'Renamed');
  check('updateCircle sends no currentValue', sentBody && !('currentValue' in sentBody));
  check('updateCircle sends no progressPct', sentBody && !('progressPct' in sentBody));
  check('updateCircle sends no contributorCount', sentBody && !('contributorCount' in sentBody));

  // No client-side settle function may exist at all.
  check('no settle() export', typeof api.settle === 'undefined');
  check('no settleTransaction() export', typeof api.settleTransaction === 'undefined');
  check('no setProgress() export', typeof api.setProgress === 'undefined');
  check('transition is request-only naming', typeof api.requestTransactionTransition === 'function');

  // The server owns the state machine: an illegal hop is reported, not faked.
  route = serve(400, { error: 'invalid transition: created -> settled' });
  r = await api.requestTransactionTransition('txn_1', 'settled');
  check('illegal transition surfaces server refusal', r.ok === false);
  check('refusal keeps the server message', !r.ok && /invalid transition/.test(r.error));
  check('refusal carries status 400', !r.ok && r.status === 400);

  // --- transaction representation ---------------------------------------
  const SETTLED = {
    id: 'txn_1', amount: 2500, currency: 'KES', type: 'contribution',
    status: 'settled', description: '', counterparty: 'jane',
    circleId: CIRCLE.id, objectId: null, metadata: {},
    history: [
      { status: 'created', at: '2026-08-17T15:41:34.476Z' },
      { status: 'pending', at: '2026-08-17T15:41:34.480Z', note: '' },
      { status: 'confirmed', at: '2026-08-17T15:41:34.482Z', note: '' },
      { status: 'settled', at: '2026-08-17T15:41:34.484Z', note: '' }
    ],
    createdAt: '2026-08-17T15:41:34.476Z',
    updatedAt: '2026-08-17T15:41:34.484Z'
  };
  route = serve(200, { transactions: [SETTLED], provider: WALLET.provider });
  r = await api.getTransactions();
  check('settled transaction represented', r.ok && r.data.transactions[0].status === 'settled');
  check('history preserved', r.ok && r.data.transactions[0].history.length === 4);
  check('circle link preserved', r.ok && r.data.transactions[0].circleId === CIRCLE.id);
  check('provider status carried', r.ok && r.data.provider.configured === false);

  // --- wallet ------------------------------------------------------------
  route = serve(200, WALLET);
  r = await api.getWallet();
  check('wallet balance from server', r.ok && r.data.balance === 0);
  check('wallet pending from server', r.ok && r.data.pending === 2500);
  check('wallet states provider unconfigured', r.ok && r.data.provider.configured === false);
  check('wallet gives a human reason', r.ok && r.data.provider.reason.length > 20);

  // --- DISBURSEMENT: honestly unavailable --------------------------------
  const d = api.getDisbursements();
  check('disbursements reported unavailable', d.available === false);
  check('disbursement reason explains why', /no payment provider/i.test(d.reason));

  // --- TRUST: evidence, never a score ------------------------------------
  route = serve(200, { members: [MEMBER] });
  r = await api.getMembers(CIRCLE.id);
  check('members ok', r.ok && r.data.length === 1);
  const m = r.ok ? r.data[0] : null;
  check('evidence present', m && m.trust.evidence[0].label === 'Phone verified');
  check('facts present', m && m.trust.facts.length === 2);
  check('no trustScore field', m && !('trustScore' in m));
  check('no numeric score on trust', m && !('score' in m.trust));
  check('no reputation field', m && !('reputation' in m));
  check('verifiedCount is a count of evidence', m && m.trust.verifiedCount === m.trust.evidence.length);

  // --- FAILURE MODES -----------------------------------------------------
  route = () => ({ throws: 'network down' });
  r = await api.getCircles();
  check('offline does not throw', r.ok === false);
  check('offline reports null status', !r.ok && r.status === null);

  route = serve(500, '<html><body>502 Bad Gateway</body></html>');
  r = await api.getCircles();
  check('HTML error page handled', r.ok === false);

  route = serve(200, 'not json at all');
  r = await api.getCircles();
  check('malformed JSON handled', r.ok === false);
  check('malformed JSON explains itself', !r.ok && /non-JSON/.test(r.error));

  route = serve(404, { error: 'circle not found' });
  r = await api.getCircle('nope');
  check('404 handled', r.ok === false && r.status === 404);
  check('404 keeps server message', !r.ok && r.error === 'circle not found');

  // Contract drift: 200 with the wrong shape must not be treated as success.
  route = serve(200, { somethingElse: [] });
  r = await api.getCircles();
  check('contract drift rejected', r.ok === false);
  check('drift message is specific', !r.ok && /unexpected response shape/.test(r.error));

  route = serve(200, {});
  r = await api.getWallet();
  check('empty wallet body rejected', r.ok === false);

  // Empty is a legitimate answer, distinct from an error.
  route = serve(200, { circles: [] });
  r = await api.getCircles();
  check('empty list is success, not error', r.ok === true && r.data.length === 0);

  route = serve(200, { signals: [] });
  r = await api.getSignals();
  check('empty signals is success', r.ok === true && r.data.length === 0);

  // --- load state helper --------------------------------------------------
  const s = idleState();
  check('idleState starts idle', s.status === 'idle' && s.data === null && s.error === null);

  // --- relative URL (browser is not the sandbox) --------------------------
  let seenUrl = '';
  route = (url) => { seenUrl = url; return { status: 200, body: JSON.stringify({ circles: [] }) }; };
  await api.getCircles();
  check('calls the /ingest proxy path', seenUrl === '/ingest/api/circles');
  check('never calls localhost directly', !/localhost|127\.0\.0\.1/.test(seenUrl));

  // --- §4 ELEMENT-LEVEL VALIDATION ---------------------------------------
  // A 200 whose envelope is right but whose ELEMENTS are garbage must fail.
  // Before Phase 4 these parsed as success and produced "undefined" and
  // "abc%" on screen.
  route = serve(200, { circles: [{}] });
  r = await api.getCircles();
  check('circle with no fields rejected', r.ok === false);

  route = serve(200, { circles: [{ ...CIRCLE, currentValue: undefined }] });
  r = await api.getCircles();
  check('circle missing currentValue rejected', r.ok === false);

  route = serve(200, { circles: [{ ...CIRCLE, progressPct: 'abc' }] });
  r = await api.getCircles();
  check('circle with string progressPct rejected', r.ok === false);

  route = serve(200, { circles: [{ ...CIRCLE, currentValue: NaN }] });
  r = await api.getCircles();
  check('NaN currentValue rejected', r.ok === false);

  route = serve(200, { circles: [{ ...CIRCLE, targetValue: null, progressPct: null }] });
  r = await api.getCircles();
  check('null targetValue is legitimate', r.ok === true);

  // One bad element invalidates the list: silently dropping rows hides the bug.
  route = serve(200, { circles: [CIRCLE, {}] });
  r = await api.getCircles();
  check('one malformed element fails the whole list', r.ok === false);

  route = serve(200, { transactions: [{}], provider: WALLET.provider });
  r = await api.getTransactions();
  check('transaction with no fields rejected', r.ok === false);

  route = serve(200, { transactions: [{ ...SETTLED_T, amount: 'lots' }], provider: WALLET.provider });
  r = await api.getTransactions();
  check('non-numeric amount rejected', r.ok === false);

  route = serve(200, { transactions: [SETTLED_T], provider: {} });
  r = await api.getTransactions();
  check('malformed provider rejected', r.ok === false);

  // member.trust is read directly by the UI; its absence would throw.
  route = serve(200, { members: [{ id: 'm', circleId: 'c', userId: 'x', role: 'observer', joinedAt: 'now' }] });
  r = await api.getMembers('c');
  check('member without trust rejected', r.ok === false);

  route = serve(200, { members: [{ ...MEMBER, trust: { ...MEMBER.trust, score: 87 } }] });
  r = await api.getMembers('c');
  check('numeric trust score REJECTED at the boundary', r.ok === false);

  route = serve(200, { members: [{ ...MEMBER, trustScore: 87 }] });
  r = await api.getMembers('c');
  check('trustScore field rejected', r.ok === false);

  route = serve(200, { balance: 'lots', pending: 0, currency: 'KES', transactionCount: 0, provider: WALLET.provider });
  r = await api.getWallet();
  check('string balance rejected', r.ok === false);

  route = serve(200, { ...WALLET, provider: { configured: 'no' } });
  r = await api.getWallet();
  check('malformed provider status rejected', r.ok === false);

  route = serve(200, { signals: [{ id: 's' }] });
  r = await api.getSignals();
  check('signal missing type rejected', r.ok === false);

  route = serve(200, { blocks: [{ id: 'b', circleId: 'c' }] });
  r = await api.getBlocks('c');
  check('block missing content rejected', r.ok === false);

  // --- §14 SECURITY: no privileged field ever leaves the client ------------
  let joinBody = null;
  route = (url, init) => {
    joinBody = init && init.body ? JSON.parse(init.body) : null;
    return { status: 201, body: JSON.stringify({ member: MEMBER }) };
  };
  await api.joinCircle('c1', 'contributor');
  check('joinCircle sends no userId', joinBody && !('userId' in joinBody));
  check('joinCircle sends only role', joinBody && Object.keys(joinBody).join() === 'role');

  let txBody = null;
  route = (url, init) => {
    txBody = init && init.body ? JSON.parse(init.body) : null;
    return { status: 201, body: JSON.stringify({ transaction: SETTLED_T }) };
  };
  await api.createTransaction({ amount: 100, type: 'contribution' });
  check('createTransaction sends no status', txBody && !('status' in txBody));
  check('createTransaction sends no settled flag', txBody && !('settled' in txBody));

  // --- §13 the client channel builder must not drift from the server -------
  // The server's shareView() is the source of truth. This asserts the client
  // mirror produces byte-identical URLs, so a change on one side breaks the
  // build rather than silently shipping two different links.
  // The server module is ESM and pulls in a real store, so it is evaluated in
  // its own node process rather than bundled -- this compares against the
  // ACTUAL server function, not a copy of it.
  const shareViewOf = (title, slug, origin) => JSON.parse(
    require('child_process').execFileSync(process.execPath, ['--input-type=module', '-e',
      `import { shareView } from ${JSON.stringify((function () {
      const path = require('path'); const fs = require('fs');
      let d = process.cwd();
      for (let i = 0; i < 6; i += 1) {
        const c = path.join(d, 'server/src/domain/campaign.js');
        if (fs.existsSync(c)) return c;
        d = path.dirname(d);
      }
      throw new Error('server campaign.js not found from ' + process.cwd());
    })())};
       process.stdout.write(JSON.stringify(shareView(
         { title: ${JSON.stringify(title)}, publicSlug: ${JSON.stringify(slug)} },
         ${JSON.stringify(origin)})));`
    ], { encoding: 'utf8' })
  );
  const canon = shareViewOf('Saturday Pop-up & Sale', 'saturday-pop-up-a1b2', 'https://brief.example.com');
  const mirror = api.campaignShareChannels(canon.url, 'Saturday Pop-up & Sale');
  check('client whatsapp url matches the server byte-for-byte',
    mirror.whatsapp === canon.channels.whatsapp, mirror.whatsapp + ' vs ' + canon.channels.whatsapp);
  check('client telegram url matches the server byte-for-byte',
    mirror.telegram === canon.channels.telegram);
  check('client x url matches the server byte-for-byte', mirror.x === canon.channels.x);
  check('client exposes exactly the three real channels',
    Object.keys(mirror).sort().join() === 'telegram,whatsapp,x');
  check('instagram is never given an intent url', !('instagram' in mirror));
  check('tiktok is never given an intent url', !('tiktok' in mirror));
  check('copy-only channels are named explicitly',
    api.COPY_ONLY_CHANNELS.join() === 'instagram,tiktok');
  check('ampersands in a title cannot break out of the query string',
    mirror.x.includes(encodeURIComponent('Saturday Pop-up & Sale')) && !mirror.x.includes('& Sale'));

  const unconf = shareViewOf('T', 'sl', null);
  check('server share matches the client union when unconfigured',
    unconf.available === false && unconf.reason === api.campaignShareLink('sl', null).reason);
  check('unconfigured server share offers no channels',
    Object.keys(unconf.channels).length === 0);
  check('server url matches the client link builder when configured',
    canon.url === (function () { const l = api.campaignShareLink('saturday-pop-up-a1b2',
      'https://brief.example.com'); return l.available ? l.url : null; })());

  // --- §8 updateCampaign may attach an object, and sends nothing else ------
  let patchBody = null;
  route = (url, init) => {
    patchBody = init && init.body ? JSON.parse(init.body) : null;
    return { status: 200, body: JSON.stringify({ campaign: CAMPAIGN }) };
  };
  await api.updateCampaign('cmp_1', { objectId: 'obj_7' });
  check('updateCampaign forwards objectId', patchBody && patchBody.objectId === 'obj_7');
  check('updateCampaign sends no ownerId', patchBody && !('ownerId' in patchBody));
  check('updateCampaign sends no status', patchBody && !('status' in patchBody));
  check('updateCampaign sends no metrics', patchBody && !('metrics' in patchBody));
  check('updateCampaign sends no publicSlug', patchBody && !('publicSlug' in patchBody));

  // --- Phase 8: confirm-payment contract ----------------------------------
  const REG = { id: 'reg_1', campaignId: 'cmp_1', attendeeRef: 'a', name: 'A',
    contact: null, status: 'registered', createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z' };
  const TX_SETTLED = { id: 'txn_1', amount: 1000, currency: 'KES', type: 'sale',
    status: 'settled', description: '', counterparty: null, circleId: null,
    objectId: null, campaignId: 'cmp_1', registrationId: 'reg_1', metadata: {},
    history: [{ status: 'created', at: 'x' }, { status: 'settled', at: 'y' }],
    createdAt: 'x', updatedAt: 'y' };
  const ANALYTICS = { views: 3, viewers: 2, shares: 0, registrationsStarted: 1,
    registrations: 1, checkedIn: 0, noShows: 0, cancelled: 0, slotsTaken: 1,
    capacity: 5, remaining: 4, orders: 1, revenueSettled: 1000, revenuePending: 0,
    currency: 'KES', conversionPct: 33.3 };

  let confirmBody = null; let confirmUrl = '';
  route = (url, init) => {
    confirmUrl = url; confirmBody = init && init.body ? JSON.parse(init.body) : null;
    return { status: 201, body: JSON.stringify({ registration: REG, transaction: TX_SETTLED, analytics: ANALYTICS }) };
  };
  let cp = await api.confirmRegistrationPayment('cmp_1', 'reg_1');
  check('confirmRegistrationPayment succeeds', cp.ok === true, cp.ok ? '' : cp.error);
  check('confirm hits the campaign-scoped route',
    confirmUrl.indexOf('/api/campaigns/cmp_1/registrations/reg_1/confirm-payment') !== -1);
  check('confirm sends NO amount (server uses campaign price)',
    confirmBody && !('amount' in confirmBody));
  check('confirm sends no price', confirmBody && !('price' in confirmBody));
  check('confirm sends no status', confirmBody && !('status' in confirmBody));
  check('confirm sends no userId or ownerId',
    confirmBody && !('userId' in confirmBody) && !('ownerId' in confirmBody));
  check('confirm returns the promoted registration', cp.ok && cp.data.registration.status === 'registered');
  check('confirm returns derived analytics', cp.ok && cp.data.analytics.revenueSettled === 1000);

  // A response claiming success with an UNSETTLED transaction must be rejected.
  route = () => ({ status: 201, body: JSON.stringify({ registration: REG,
    transaction: { ...TX_SETTLED, status: 'pending' }, analytics: ANALYTICS }) });
  cp = await api.confirmRegistrationPayment('cmp_1', 'reg_1');
  check('an unsettled transaction is NOT accepted as a confirmation', cp.ok === false);

  route = () => ({ status: 201, body: JSON.stringify({ registration: REG, analytics: ANALYTICS }) });
  cp = await api.confirmRegistrationPayment('cmp_1', 'reg_1');
  check('a confirmation missing its transaction is rejected', cp.ok === false);

  // --- Phase 8: updateCampaign may attach an object -----------------------
  let attachBody = null;
  route = (url, init) => {
    attachBody = init && init.body ? JSON.parse(init.body) : null;
    return { status: 200, body: JSON.stringify({ campaign: CAMPAIGN }) };
  };
  await api.updateCampaign('cmp_1', { objectId: 'obj_9' });
  check('updateCampaign can attach an existing object', attachBody && attachBody.objectId === 'obj_9');
  check('attach sends no ownsObject', attachBody && !('ownsObject' in attachBody));

  // --- Phase 9: the client must not paper over a refused transition -------
  route = () => ({ status: 400, body: JSON.stringify({
    error: 'invalid registration transition: cancelled -> registered' }) });
  let badT = await api.setRegistrationStatus('cmp_1', 'reg_1', 'registered');
  check('a refused registration transition surfaces as an error', badT.ok === false);
  check('the refusal reason reaches the caller',
    !badT.ok && /invalid registration transition/.test(badT.error));

  route = () => ({ status: 400, body: JSON.stringify({ error: 'amount must be greater than zero' }) });
  const negTx = await api.createTransaction({ amount: -100, type: 'sale' });
  check('a negative amount is refused by the server and surfaced', negTx.ok === false);
  check('the amount refusal reason reaches the caller',
    !negTx.ok && /greater than zero/.test(negTx.error));

  console.log('\n====================================================');

  console.log('PASSED ' + pass + '   FAILED ' + fail);
  console.log('====================================================\n');
  if (fail > 0) process.exit(1);
}

run();
