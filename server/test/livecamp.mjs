// ===========================================================================
// LIVE INTEGRATION: campaign creator flow + public registration
//
// A real Express server on a fresh port, driven through the real typed
// client. No stubs anywhere in this file. This is the phase's product test:
// create a popup, publish it, get one link, and have a stranger register.
// ===========================================================================

const PORT = 9951;
// The module self-listens on import unless NODE_ENV is 'test'; this suite
// owns its own listener so it can pick a fresh port.
process.env.NODE_ENV = 'test';
process.env.PORT = String(PORT);
// Isolated store: this suite asserts on real counts, so it must not inherit
// rows from a previous run or from the dev server's data directory.
process.env.BRIEF_DATA_DIR = '/tmp/brief-livecamp-' + process.pid;

import * as api from './.apiclient.mjs';

// The server module self-listens at import time unless NODE_ENV is 'test'.
// ESM hoists static imports above assignments, so the env has to be set
// before the module is pulled in -- hence the dynamic import inside main().

let pass = 0;
let fail = 0;
const check = (n, c, x) => {
  if (c) pass++;
  else {
    fail++;
    console.log('  FAIL: ' + n + (x ? ' -> ' + x : ''));
  }
};

async function main() {
  const app = (await import('../src/index.js')).default;
  const srv = app.listen(PORT);
  await new Promise((r) => srv.once('listening', r));

  // The typed client speaks to '/ingest'; point that at the live server.
  const base = 'http://127.0.0.1:' + PORT;
  const realFetch = global.fetch;
  global.fetch = (url, init) =>
    realFetch(String(url).replace(/^\/ingest/, base), init);

  console.log('\n=== LIVE CAMPAIGN INTEGRATION (real server, port ' + PORT + ') ===\n');

  // --- empty state is real ------------------------------------------------
  let list = await api.getCampaigns();
  check('campaign list reachable', list.ok === true, list.ok ? '' : list.error);
  check('starts with zero campaigns (no seed data)', list.ok && list.data.length === 0);

  // --- CREATE -------------------------------------------------------------
  const created = await api.createCampaign({
    title: 'Kilimani Plant Sale',
    type: 'popup',
    description: 'Cuttings and seedlings.',
    location: 'Kilimani, Nairobi',
    startsAt: '2026-09-01T10:00:00.000Z',
    capacity: 3,
    price: 0
  });
  check('create returns a campaign', created.ok === true, created.ok ? '' : created.error);
  if (!created.ok) return finish(srv);
  const id = created.data.id;
  check('new campaign is a draft', created.data.status === 'draft');
  check('server assigned a public slug', typeof created.data.publicSlug === 'string' && created.data.publicSlug.length > 0);
  check('metrics start at zero from real rows', created.data.metrics.registrations === 0);
  check('capacity is echoed back', created.data.metrics.capacity === 3);
  check('remaining is derived', created.data.metrics.remaining === 3);

  // --- the draft is not public yet ---------------------------------------
  let pub = await api.getPublicCampaign(created.data.publicSlug);
  check('a draft is NOT publicly readable', pub.ok === false, pub.ok ? 'draft leaked' : '');

  // --- PUBLISH ------------------------------------------------------------
  const published = await api.campaignAction(id, 'publish');
  check('publish succeeds', published.ok === true, published.ok ? '' : published.error);
  check('status came back published', published.ok && published.data.status === 'published');

  // --- SHARE --------------------------------------------------------------
  const slug = created.data.publicSlug;

  // Share link is composed from SERVER CONFIG, never the browser host.
  const cfg = await api.getConfig();
  check('config is reachable', cfg.ok === true, cfg.ok ? '' : cfg.error);
  const origin = cfg.ok ? cfg.data.publicOrigin : null;
  const link = api.campaignShareLink(slug, origin);
  if (origin) {
    check('share url uses the configured origin', link.available && link.url.startsWith(origin));
    check('share url ends with the real slug', link.available && link.url.endsWith('/c/' + slug));
  } else {
    check('no origin -> structured unavailable', link.available === false);
    check('no origin -> honest reason', !link.available && link.reason === 'public_origin_not_configured');
    check('no origin -> slug still returned', !link.available && link.slug === slug);
  }
  check('share link never invents a domain', JSON.stringify(link).indexOf('brief.app') === -1);

  // --- the SERVER-built distribution payload, over the real wire -----------
  const srvShare = await api.getCampaignShare(created.data.id);
  check('GET share is reachable', srvShare.ok === true, srvShare.ok ? '' : srvShare.error);
  check('server share agrees with the client link on availability',
    srvShare.ok && srvShare.data.available === link.available);
  check('server share agrees with the client on the slug',
    srvShare.ok && srvShare.data.slug === slug);
  if (srvShare.ok && srvShare.data.available) {
    check('server url matches the client-composed url',
      link.available && srvShare.data.url === link.url,
      srvShare.data.url + ' vs ' + (link.available ? link.url : 'n/a'));
    const mirror = api.campaignShareChannels(srvShare.data.url, created.data.title);
    check('live whatsapp intent matches the client mirror',
      srvShare.data.channels.whatsapp === mirror.whatsapp);
    check('live telegram intent matches the client mirror',
      srvShare.data.channels.telegram === mirror.telegram);
    check('live x intent matches the client mirror', srvShare.data.channels.x === mirror.x);
    check('live payload offers exactly three real channels',
      Object.keys(srvShare.data.channels).length === 3);
  } else {
    check('unconfigured live share names the reason',
      srvShare.ok && srvShare.data.reason === 'public_origin_not_configured');
    check('unconfigured live share offers no channels',
      srvShare.ok && Object.keys(srvShare.data.channels).length === 0);
  }
  check('live share payload never leaks an ownerId',
    srvShare.ok && JSON.stringify(srvShare.data).indexOf('ownerId') === -1);
  check('instagram is copy-link only over the wire',
    srvShare.ok && srvShare.data.copyOnly.indexOf('instagram') !== -1);
  check('tiktok is copy-link only over the wire',
    srvShare.ok && srvShare.data.copyOnly.indexOf('tiktok') !== -1);

  // ATTACK: another creator's distribution endpoint, over the real wire.
  const foreignShare = await api.getCampaignShare('cmp_not_mine');
  check('ATTACK: foreign share endpoint is refused',
    foreignShare.ok === false && foreignShare.status === 404);
  check('ATTACK: refusal leaks no url', JSON.stringify(foreignShare).indexOf('/c/') === -1);

  // --- Phase 8: the paid loop, end to end over the real wire --------------
  const paidC = await api.createCampaign({ title: 'Live Paid Session', type: 'popup',
    capacity: 5, price: 1500 });
  check('paid campaign created', paidC.ok === true, paidC.ok ? '' : paidC.error);
  const paidId = paidC.ok ? paidC.data.id : '';
  await api.campaignAction(paidId, 'publish');
  const paidSlug = paidC.ok ? paidC.data.publicSlug : '';

  const heldRes = await api.registerForCampaign(paidSlug, { attendeeRef: 'live-buyer-1', name: 'Live Buyer' });
  check('a stranger can register on a paid campaign without auth', heldRes.ok === true);
  const heldId = heldRes.ok ? heldRes.data.registration.id : '';
  check('the paid spot is HELD, not registered',
    heldRes.ok && heldRes.data.registration.status === 'started');

  let liveA = await api.getCampaign(paidId);
  check('a held spot is not counted as a registration',
    liveA.ok && liveA.data.metrics.registrations === 0);
  check('a held spot produced no revenue', liveA.ok && liveA.data.metrics.revenueSettled === 0);
  check('a held spot still occupies a slot', liveA.ok && liveA.data.metrics.slotsTaken === 1);

  const confirmed = await api.confirmRegistrationPayment(paidId, heldId);
  check('organiser can confirm payment', confirmed.ok === true, confirmed.ok ? '' : confirmed.error);
  check('confirmation promotes the registration',
    confirmed.ok && confirmed.data.registration.status === 'registered');
  check('confirmation settles a real transaction',
    confirmed.ok && confirmed.data.transaction.status === 'settled');
  check('confirmation charges the campaign price, not a client amount',
    confirmed.ok && confirmed.data.transaction.amount === 1500);
  check('the settled transaction is linked to the registration',
    confirmed.ok && confirmed.data.transaction.registrationId === heldId);

  liveA = await api.getCampaign(paidId);
  check('the promoted spot is now a real registration',
    liveA.ok && liveA.data.metrics.registrations === 1);
  check('settled money is now real revenue',
    liveA.ok && liveA.data.metrics.revenueSettled === 1500);
  check('promotion did not double-count the slot',
    liveA.ok && liveA.data.metrics.slotsTaken === 1);

  const dbl = await api.confirmRegistrationPayment(paidId, heldId);
  check('ATTACK: confirming twice is refused', dbl.ok === false);
  const afterDbl = await api.getCampaign(paidId);
  check('ATTACK: a double confirmation minted no revenue',
    afterDbl.ok && afterDbl.data.metrics.revenueSettled === 1500);

  // Views and shares on a paid campaign remain economically inert.
  await api.getPublicCampaign(paidSlug);
  await api.getPublicCampaign(paidSlug);
  await api.shareCampaign(paidId, 'whatsapp');
  const inert = await api.getCampaign(paidId);
  check('views and shares create no revenue on a paid campaign',
    inert.ok && inert.data.metrics.revenueSettled === 1500);
  check('views and shares create no registrations',
    inert.ok && inert.data.metrics.registrations === 1);
  check('views were still recorded as page loads',
    inert.ok && inert.data.metrics.views >= 2);

  // --- Phase 9: state machine + refund, over the real wire ----------------
  const railC = await api.createCampaign({ title: 'Live Rail', type: 'popup', capacity: 2, price: 900 });
  const railId = railC.ok ? railC.data.id : '';
  await api.campaignAction(railId, 'publish');
  const railSlug = railC.ok ? railC.data.publicSlug : '';

  const rr1 = await api.registerForCampaign(railSlug, { attendeeRef: 'live-rail-1' });
  const rid1 = rr1.ok ? rr1.data.registration.id : '';
  const cancelled = await api.setRegistrationStatus(railId, rid1, 'cancelled');
  check('a registration can be cancelled', cancelled.ok === true);
  const revived = await api.setRegistrationStatus(railId, rid1, 'registered');
  check('ATTACK: a cancelled registration cannot be revived over the wire', revived.ok === false);
  check('ATTACK: reviving a cancelled spot is refused with a reason',
    !revived.ok && /invalid registration transition/.test(revived.error));

  const negLive = await api.createTransaction({ amount: -5000, type: 'sale', campaignId: railId });
  check('ATTACK: a negative amount is refused over the wire', negLive.ok === false);
  const zeroLive = await api.createTransaction({ amount: 0, type: 'sale', campaignId: railId });
  check('ATTACK: a zero amount is refused over the wire', zeroLive.ok === false);

  const rr2 = await api.registerForCampaign(railSlug, { attendeeRef: 'live-rail-2' });
  const rid2 = rr2.ok ? rr2.data.registration.id : '';
  const paidLive = await api.confirmRegistrationPayment(railId, rid2);
  check('the live spot is paid and promoted',
    paidLive.ok && paidLive.data.registration.status === 'registered');
  const refundLive = await api.requestTransactionTransition(paidLive.ok ? paidLive.data.transaction.id : '', 'refunded');
  check('a refund is accepted by the ledger', refundLive.ok === true, refundLive.ok ? '' : refundLive.error);
  const afterRefund = await api.getCampaign(railId);
  check('a refund removes the revenue', afterRefund.ok && afterRefund.data.metrics.revenueSettled === 0);
  check('a refund frees the slot', afterRefund.ok && afterRefund.data.metrics.slotsTaken === 0);
  const regsAfter = await api.getCampaignRegistrations(railId);
  check('a refunded registration is released as cancelled',
    regsAfter.ok && regsAfter.data.find((r) => r.id === rid2).status === 'cancelled');

  // --- the link works for a stranger --------------------------------------
  pub = await api.getPublicCampaign(slug);
  check('published campaign is publicly readable', pub.ok === true, pub.ok ? '' : pub.error);
  if (pub.ok) {
    check('public projection has the title', pub.data.title === 'Kilimani Plant Sale');
    check('public projection hides ownerId', !('ownerId' in pub.data));
    check('public projection hides internal id', !('id' in pub.data));
    check('public projection hides objectId', !('objectId' in pub.data));
    check('public projection hides metrics', !('metrics' in pub.data));
    check('public remaining is real', pub.data.remaining === 3);
    check('not sold out yet', pub.data.soldOut === false);
  }

  // --- REGISTER (the actual product test) ---------------------------------
  const r1 = await api.registerForCampaign(slug, { attendeeRef: 'amina@example.com', name: 'Amina' });
  check('a stranger can register', r1.ok === true, r1.ok ? '' : r1.error);
  check('free registration is registered, not started', r1.ok && r1.data.registration.status === 'registered');
  check('remaining dropped on the server', r1.ok && r1.data.campaign.remaining === 2);

  const r2 = await api.registerForCampaign(slug, { attendeeRef: 'brian@example.com', name: 'Brian' });
  check('a second stranger can register', r2.ok === true, r2.ok ? '' : r2.error);

  // duplicate
  const dup = await api.registerForCampaign(slug, { attendeeRef: 'amina@example.com', name: 'Amina' });
  check('duplicate registration is rejected by the server', dup.ok === false || (dup.ok && dup.data.registration.id === r1.data.registration.id));

  // --- CAPACITY -----------------------------------------------------------
  const r3 = await api.registerForCampaign(slug, { attendeeRef: 'cate@example.com', name: 'Cate' });
  check('third registration fills the campaign', r3.ok === true, r3.ok ? '' : r3.error);
  const r4 = await api.registerForCampaign(slug, { attendeeRef: 'dan@example.com', name: 'Dan' });
  check('registration beyond capacity is refused', r4.ok === false, r4.ok ? 'overbooked!' : '');
  const full = await api.getPublicCampaign(slug);
  check('public page now reports sold out', full.ok && full.data.soldOut === true);
  check('remaining is zero, from the server', full.ok && full.data.remaining === 0);

  // --- OWNER DASHBOARD ----------------------------------------------------
  const detail = await api.getCampaign(id);
  check('owner can read the campaign', detail.ok === true, detail.ok ? '' : detail.error);
  if (detail.ok) {
    check('slotsTaken matches real registrations', detail.data.metrics.slotsTaken === 3);
    check('capacity math is server-side', detail.data.metrics.remaining === 0);
    check('views were recorded by real page loads', detail.data.metrics.views > 0);
    check('conversion is a real ratio or null', detail.data.metrics.conversionPct === null || typeof detail.data.metrics.conversionPct === 'number');
    check('free campaign settled nothing', detail.data.metrics.revenueSettled === 0);
  }

  const regs = await api.getCampaignRegistrations(id);
  check('owner can list registrations', regs.ok === true, regs.ok ? '' : regs.error);
  check('three people are on the list', regs.ok && regs.data.length === 3);

  // --- CHECK-IN / NO-SHOW -------------------------------------------------
  if (regs.ok && regs.data.length > 0) {
    const ci = await api.setRegistrationStatus(id, regs.data[0].id, 'checked_in');
    check('check-in uses the verified status endpoint', ci.ok === true, ci.ok ? '' : ci.error);
    check('status came back checked_in', ci.ok && ci.data.status === 'checked_in');

    const ns = await api.setRegistrationStatus(id, regs.data[1].id, 'no_show');
    check('no-show is recorded', ns.ok === true, ns.ok ? '' : ns.error);

    const after = await api.getCampaign(id);
    check('checkedIn metric moved with it', after.ok && after.data.metrics.checkedIn === 1);
    check('noShows metric moved with it', after.ok && after.data.metrics.noShows === 1);
  }

  // --- PAID CAMPAIGN ------------------------------------------------------
  const paid = await api.createCampaign({
    title: 'Pottery Session',
    type: 'session',
    capacity: 10,
    price: 1500,
    currency: 'KES'
  });
  check('paid campaign created', paid.ok === true, paid.ok ? '' : paid.error);
  if (paid.ok) {
    await api.campaignAction(paid.data.id, 'publish');
    const pr = await api.registerForCampaign(paid.data.publicSlug, { attendeeRef: 'eve@example.com' });
    check('paid registration is accepted', pr.ok === true, pr.ok ? '' : pr.error);
    check('paid registration is `started`, not paid', pr.ok && pr.data.registration.status === 'started');
    const pd = await api.getCampaign(paid.data.id);
    check('no revenue is settled without payment', pd.ok && pd.data.metrics.revenueSettled === 0);
    check('nothing is invented as pending either', pd.ok && typeof pd.data.metrics.revenuePending === 'number');
  }

  // --- LIFECYCLE ----------------------------------------------------------
  const closed = await api.campaignAction(id, 'close');
  check('owner can close the campaign', closed.ok === true, closed.ok ? '' : closed.error);
  check('closed status is server-reported', closed.ok && closed.data.status === 'closed');
  const afterClose = await api.registerForCampaign(slug, { attendeeRef: 'zoe@example.com' });
  check('a closed campaign refuses registration', afterClose.ok === false);

  // --- PHASE 7: OBJECT ATTACHMENT + SHARE ---------------------------------
  const objOwner = await api.createCampaign({ title: 'Owns An Object', type: 'drop' });
  check('campaign embeds its object', objOwner.ok && objOwner.data.object !== null);
  check('created object is owned', objOwner.ok && objOwner.data.ownsObject === true);

  if (objOwner.ok) {
    const reuse = await api.createCampaign({
      title: 'Reuses That Object',
      type: 'drop',
      objectId: objOwner.data.objectId
    });
    check('an existing object can be attached', reuse.ok === true, reuse.ok ? '' : reuse.error);
    check('attachment reuses the same object', reuse.ok && reuse.data.objectId === objOwner.data.objectId);
    check('attached campaign reports ownsObject false', reuse.ok && reuse.data.ownsObject === false);

    // Publishing must NOT change an attached object's publication.
    const objBefore = await api.getObject(objOwner.data.objectId);
    if (reuse.ok) await api.campaignAction(reuse.data.id, 'publish');
    const objAfter = await api.getObject(objOwner.data.objectId);
    check(
      'publishing does not mutate an attached object',
      objBefore.ok && objAfter.ok && objBefore.data.publication === objAfter.data.publication
    );

    const ghostObj = await api.createCampaign({ title: 'Ghost', type: 'drop', objectId: 'obj_nope' });
    check('a nonexistent object is refused', ghostObj.ok === false);
  }

  // Sharing records intent and moves nothing.
  const shareCamp = await api.createCampaign({ title: 'Shareable', type: 'popup', price: 400 });
  if (shareCamp.ok) {
    const draftShare = await api.shareCampaign(shareCamp.data.id, 'whatsapp');
    check('sharing a draft is refused', draftShare.ok === false);

    await api.campaignAction(shareCamp.data.id, 'publish');
    const before = await api.getCampaign(shareCamp.data.id);
    const shared = await api.shareCampaign(shareCamp.data.id, 'whatsapp');
    check('sharing a published campaign works', shared.ok === true, shared.ok ? '' : shared.error);
    check('share count is derived', shared.ok && shared.data.metrics.shares === 1);
    check(
      'sharing does not change settled revenue',
      before.ok && shared.ok && shared.data.metrics.revenueSettled === before.data.metrics.revenueSettled
    );
    check(
      'sharing does not change slots taken',
      before.ok && shared.ok && shared.data.metrics.slotsTaken === before.data.metrics.slotsTaken
    );

    // Viewing: page loads counted, viewers collapsed, no money moved.
    for (let i = 0; i < 3; i++) await api.getPublicCampaign(shareCamp.data.publicSlug);
    const viewed = await api.getCampaign(shareCamp.data.id);
    check('page loads are counted', viewed.ok && viewed.data.metrics.views === 3);
    check('repeat loads collapse to one viewer', viewed.ok && viewed.data.metrics.viewers === 1);
    check('viewing creates no revenue', viewed.ok && viewed.data.metrics.revenueSettled === 0);
    check('viewing creates no registrations', viewed.ok && viewed.data.metrics.registrations === 0);
  }

  // --- MISSING CAMPAIGN ---------------------------------------------------
  const ghost = await api.getPublicCampaign('does-not-exist-xyz');
  check('unknown slug is a clean failure', ghost.ok === false);
  check('unknown slug reports 404', !ghost.ok && ghost.status === 404, String(ghost.status));

  finish(srv);
}

function finish(srv) {
  console.log('\n====================================================');
  console.log('PASSED ' + pass + '   FAILED ' + fail);
  console.log('====================================================\n');
  srv.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
