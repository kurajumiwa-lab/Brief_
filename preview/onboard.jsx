// ---------------------------------------------------------------------------
// ONBOARDING, THE SERVICE LADDER, AND ARRIVAL
//
// Three things are checked here, in the order they actually happen to a
// person:
//
//   1. ARRIVAL   what a link and a user agent can honestly tell us.
//   2. LADDER    which surfaces are offered, and — just as important — the two
//                screens where the ladder must stay silent (Saved, Actions).
//   3. FIRST RUN the three-screen flow, and that it never re-opens for someone
//                who already answered.
//
// The lock is an OFFER, not an authorisation: the assertions below pin down
// that an unloaded ladder locks nothing, because a dead API must not turn into
// a product that refuses to open.
// ---------------------------------------------------------------------------
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',
  { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;

let pass = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); }
};

const arrival = require('./src/components/arrival.ts');
const ladderMod = require('./src/components/ladder.ts');

// A ladder shaped exactly like the server's: activated, but not yet
// contributing, so capture is open and distribution is not.
const LADDER = {
  rungs: [
    { id: 'identity', label: 'Be someone', detail: '', cta: '', index: 0, done: true, reached: true, at: '2026-01-01T00:00:00Z', how: 'Signed in with Google' },
    { id: 'orient', label: 'Say what you came for', detail: '', cta: '', index: 1, done: true, reached: true, at: '2026-01-01T00:01:00Z', how: 'Here to discover' },
    { id: 'value', label: 'Keep your first real thing', detail: 'Open something and save it.', cta: 'Save something from the feed', index: 2, done: true, reached: true, at: '2026-01-01T00:02:00Z', how: 'Saved something from the feed' },
    { id: 'contribute', label: 'Add something of your own', detail: 'Paste a message or a poster.', cta: 'Capture something', index: 3, done: false, reached: false, at: null, how: null },
    { id: 'reach', label: 'Put it in front of people', detail: '', cta: '', index: 4, done: false, reached: false, at: null, how: null }
  ],
  reached: ['identity', 'orient', 'value'],
  currentRungId: 'contribute',
  nextStep: { id: 'contribute', label: 'Add something of your own', detail: 'Paste a message or a poster.', cta: 'Capture something' },
  complete: false,
  activated: true,
  activatedAt: '2026-01-01T00:02:00Z',
  services: [
    { id: 'stream', label: 'Around you', requires: 'identity', surface: { tab: 'nearby', section: 'stream' }, unlocked: true, unlocksAfter: null },
    { id: 'saved', label: 'Your layer', requires: 'identity', surface: { tab: 'mylayer', section: 'saved' }, unlocked: true, unlocksAfter: null },
    { id: 'capture', label: 'Capture', requires: 'value', surface: { tab: 'capture' }, unlocked: true, unlocksAfter: null },
    { id: 'play', label: 'Arena', requires: 'value', surface: { tab: 'arena' }, unlocked: true, unlocksAfter: null },
    { id: 'campaigns', label: 'Host an event', requires: 'contribute', surface: { tab: 'mylayer', section: 'campaigns' }, unlocked: false, unlocksAfter: 'Add something of your own' },
    { id: 'distribution', label: 'Share kit and banners', requires: 'reach', surface: { tab: 'workflows', section: 'distribution' }, unlocked: false, unlocksAfter: 'Put it in front of people' },
    { id: 'groups', label: 'Groups', requires: 'contribute', surface: { tab: 'mylayer', section: 'groups' }, unlocked: false, unlocksAfter: 'Add something of your own' }
  ]
};

async function main() {
  console.log('\n=== 1. ARRIVAL: what a link and a user agent may honestly claim ===');
  const TIKTOK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 BytedanceWebview/d8a21c musical_ly_32.5.0';
  check('a TikTok in-app browser is recognised', arrival.detectInAppBrowser(TIKTOK_UA) === 'tiktok');
  check('an ordinary browser is not dressed up as one',
    arrival.detectInAppBrowser('Mozilla/5.0 (Linux; Android 13) Chrome/120') === 'browser');
  check('a TikTok webview is treated as popup-restricted', arrival.isRestrictedWebview('tiktok') === true);
  check('a normal browser is not restricted', arrival.isRestrictedWebview('browser') === false);
  check('a stated utm_source wins over the user agent',
    arrival.arrivalSource('https://brief.test/?utm_source=whatsapp', TIKTOK_UA) === 'whatsapp');
  check('with nothing stated the user agent decides',
    arrival.arrivalSource('https://brief.test/', TIKTOK_UA) === 'tiktok');

  check('a signed link token is picked up', arrival.linkTokenFrom('https://brief.test/?bt=abc.def') === 'abc.def');
  check('a bare email in the URL is NOT treated as identity',
    arrival.linkTokenFrom('https://brief.test/?email=amina@example.com') === null);
  check('a token-shaped nothing is ignored', arrival.linkTokenFrom('https://brief.test/?bt=nope') === null);
  check('arrival params are burned after use',
    arrival.urlWithoutArrivalParams('https://brief.test/x?bt=a.b&ref=tiktok&keep=1') === 'https://brief.test/x?keep=1');
  check('a URL with nothing to strip is untouched',
    arrival.urlWithoutArrivalParams('https://brief.test/x') === 'https://brief.test/x');

  console.log('\n=== 2. THE LADDER: what is offered, and where it stays silent ===');
  check('Saved never shows ladder chrome', ladderMod.showsLadder('mylayer') === false);
  check('Actions never shows ladder chrome', ladderMod.showsLadder('workflows') === false);
  check('Home does', ladderMod.showsLadder('nearby') === true);

  check('an unloaded ladder locks nothing', ladderMod.isSurfaceUnlocked(null, 'workflows', 'distribution') === true);
  check('a locked surface is closed on a ladder-visible tab',
    ladderMod.isSurfaceUnlocked(LADDER, 'workflows', 'distribution') === false);
  check('a locked service is locked wherever it is OFFERED',
    ladderMod.isSurfaceUnlocked(LADDER, 'mylayer', 'campaigns') === false);
  check('an open surface stays open', ladderMod.isSurfaceUnlocked(LADDER, 'nearby', 'stream') === true);
  check('a surface the ladder does not model is open',
    ladderMod.isSurfaceUnlocked(LADDER, 'nearby', 'quests') === true);

  check('a lock names the step that opens it',
    ladderMod.unlockHint(LADDER, 'workflows', 'distribution') === 'Put it in front of people');
  check('an open service has no hint to give', ladderMod.unlockHint(LADDER, 'nearby', 'stream') === null);
  check('the exemption is about CHROME, not about unlocking by tab',
    ladderMod.showsLadder('mylayer') === false &&
    ladderMod.isSurfaceUnlocked(LADDER, 'mylayer', 'campaigns') === false);
  check('progress counts reached rungs', ladderMod.ladderProgress(LADDER).done === 3 && ladderMod.ladderProgress(LADDER).total === 5);
  check('activation is read from the ladder', ladderMod.isActivated(LADDER) === true);
  check('no ladder means not activated', ladderMod.isActivated(null) === false);

  console.log('\n=== 3. FIRST RUN opens only when there is a reason ===');
  check('a signed-out visitor sees it',
    ladderMod.shouldOpenFirstRun({ signedIn: false, goal: null, finishedAt: null, skippedAt: null }) === true);
  check('a signed-in person who never answered sees it',
    ladderMod.shouldOpenFirstRun({ signedIn: true, goal: null, finishedAt: null, skippedAt: null }) === true);
  check('someone who answered never sees it again',
    ladderMod.shouldOpenFirstRun({ signedIn: true, goal: 'discover', finishedAt: null, skippedAt: null }) === false);
  check('someone who skipped is not nagged',
    ladderMod.shouldOpenFirstRun({ signedIn: true, goal: null, finishedAt: null, skippedAt: '2026-01-01T00:00:00Z' }) === false);

  // --- render tests --------------------------------------------------------
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react-dom/test-utils');
  global.fetch = async () => ({ ok: false, status: 404, text: async () => '{}', json: async () => ({}) });
  dom.window.fetch = global.fetch;

  const { MainShelf } = require('./src/components/MainShelf.tsx');
  const { NextStep } = require('./src/components/NextStep.tsx');
  const { Onboarding } = require('./src/components/Onboarding.tsx');

  const mount = async (element) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(element); });
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    return {
      host,
      text: () => (host.textContent || '').replace(/\s+/g, ' ').trim(),
      buttons: () => Array.from(host.querySelectorAll('button')),
      click: async (el) => {
        await act(async () => {
          el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
        });
      },
      unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); }
    };
  };

  console.log('\n=== 4. THE SHELF discloses progressively ===');
  const selected = [];
  const lockedTaps = [];
  const shelf = await mount(React.createElement(MainShelf, {
    onSelect: (t) => selected.push(t),
    ladder: LADDER,
    onLocked: (info) => lockedTaps.push(info)
  }));
  const shelfText = shelf.text();
  check('an open card keeps its own copy', /Places, events and useful signals/i.test(shelfText));
  check('a locked card states the step that opens it', /Opens after: Add something of your own/i.test(shelfText));
  const lockedCard = shelf.host.querySelector('[data-shelf-id="groups"]');
  check('the locked card is marked in the DOM', lockedCard && lockedCard.getAttribute('data-locked') === 'true');
  await shelf.click(lockedCard);
  check('tapping a locked card does NOT navigate', selected.length === 0, JSON.stringify(selected));
  check('tapping a locked card reports which step is missing',
    lockedTaps.length === 1 && lockedTaps[0].requires === 'contribute');
  const openCard = shelf.host.querySelector('[data-shelf-id="around"]');
  await shelf.click(openCard);
  check('an open card still navigates', selected.length === 1 && selected[0].tab === 'nearby');
  await shelf.unmount();

  console.log('\n=== 5. THE SHELF WITHOUT A LADDER is fully open ===');
  const plainSelected = [];
  const plain = await mount(React.createElement(MainShelf, { onSelect: (t) => plainSelected.push(t) }));
  check('no ladder means no lock chrome anywhere', !/Opens after:/i.test(plain.text()));
  await plain.click(plain.host.querySelector('[data-shelf-id="share"]'));
  check('every card still navigates when the ladder is unknown', plainSelected.length === 1);
  await plain.unmount();

  console.log('\n=== 6. NEXT STEP shows one rung and one action ===');
  const acted = [];
  const next = await mount(React.createElement(NextStep, { ladder: LADDER, onAct: (id) => acted.push(id) }));
  const nextText = next.text();
  check('the card names the position on the ladder', /Step 4 of 5/.test(nextText), nextText);
  check('the card names the step', /Add something of your own/.test(nextText));
  check('it shows the single call to action', /Capture something/.test(nextText));
  check('it says what that step opens', /opens Host an event|opens Groups/.test(nextText), nextText);
  const cta = next.buttons().find((b) => (b.textContent || '').includes('Capture something'));
  await next.click(cta);
  check('the call to action reports the rung it is for', acted.length === 1 && acted[0] === 'contribute');
  await next.unmount();

  const done = await mount(React.createElement(NextStep, {
    ladder: { ...LADDER, nextStep: null, complete: true },
    onAct: () => {}
  }));
  check('a finished ladder invents no further step', done.text() === '');
  await done.unmount();

  console.log('\n=== 7. FIRST RUN leads with identity and is honest about Google ===');
  const onboard = await mount(React.createElement(Onboarding, {
    open: true,
    providers: {
      password: { configured: true, label: 'Handle and password' },
      google: { configured: false, label: 'Continue with Google', reason: 'GOOGLE_CLIENT_ID is not set on the server' },
      telegram: { configured: false, required: false, label: 'Telegram Mini App' },
      emailLink: { configured: true, label: 'Signed email link' }
    },
    state: null,
    user: null,
    channel: 'tiktok',
    placeLabel: null,
    onSignedIn: () => {},
    onGuest: async () => null,
    onStateChange: () => {},
    onUseLocation: () => {},
    onChooseCity: () => {},
    onDone: () => {}
  }));
  const first = onboard.text();
  check('it opens on step 1 of 3', /Step 1 of 3/.test(first));
  check('an unconfigured Google says so instead of showing a dead button',
    /Google sign-in is not configured here/.test(first) && /GOOGLE_CLIENT_ID/.test(first));
  check('a real account is still one tap away', /Create an account with a handle/.test(first));
  check('looking around without an account is offered', /Just look around on this device/.test(first));
  check('TELEGRAM IS STATED AS NOT REQUIRED', /Telegram is not required to be a member/i.test(first));
  check('no product tour is offered', !/tour|walkthrough|next tip/i.test(first));
  await onboard.unmount();

  console.log('\n=== 8. FIRST RUN asks ONE segmentation question ===');
  const chosen = [];
  global.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/api/onboarding/goal')) {
      chosen.push(JSON.parse(init.body).goal);
      return { ok: true, status: 200, text: async () => JSON.stringify({ profile: { goal: 'sell' }, goals: [], ladder: LADDER }), json: async () => ({}) };
    }
    return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
  };
  dom.window.fetch = global.fetch;
  const seg = await mount(React.createElement(Onboarding, {
    open: true,
    providers: null,
    state: {
      profile: { goal: null, place: null, source: 'tiktok', startedAt: null, finishedAt: null, skippedAt: null },
      goals: [
        { id: 'discover', label: 'Find what is happening near me', leadsTo: { tab: 'nearby' } },
        { id: 'sell', label: 'Sell a product or service', leadsTo: { tab: 'nearby', section: 'market' } }
      ],
      ladder: LADDER
    },
    user: { id: 'usr_1', handle: 'amina', displayName: 'Amina' },
    channel: 'tiktok',
    placeLabel: null,
    onSignedIn: () => {},
    onGuest: async () => null,
    onStateChange: () => {},
    onUseLocation: () => {},
    onChooseCity: () => {},
    onDone: () => {}
  }));
  const segText = seg.text();
  check('a signed-in person skips the identity screen', /Step 2 of 3/.test(segText), segText.slice(0, 120));
  check('the question is asked once, in plain words', /What brought you here\?/.test(segText));
  check('the answers are the segments, not a form', /Sell a product or service/.test(segText));
  check('no mandatory profile fields appear', seg.host.querySelectorAll('input').length === 0);
  const sell = seg.buttons().find((b) => (b.textContent || '').includes('Sell a product'));
  await seg.click(sell);
  await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  check('the answer is sent to the server, once', chosen.length === 1 && chosen[0] === 'sell');
  check('answering advances to the last step', /Step 3 of 3/.test(seg.text()), seg.text().slice(0, 120));
  check('the last step can be skipped for the global feed',
    /global ranked feed/.test(seg.text()) || /Using /.test(seg.text()));
  await seg.unmount();

  console.log('\n=== 9. IN THE APP: Home carries the ladder, Saved and Actions do not ===');
  const { boot } = require('./harness.cjs');
  const h = await boot({
    routes: {
      '/api/auth/me': { user: { id: 'usr_1', handle: 'amina', displayName: 'Amina', personId: 'per_1' }, method: 'session' },
      '/api/auth/providers': { providers: { password: { configured: true, label: 'Handle and password' }, google: { configured: false, label: 'Continue with Google', reason: 'GOOGLE_CLIENT_ID is not set on the server' }, telegram: { configured: false, required: false, label: 'Telegram Mini App' }, emailLink: { configured: true, label: 'Signed email link' } } },
      '/api/onboarding': {
        profile: { goal: 'discover', place: 'Nairobi', source: 'tiktok', startedAt: '2026-01-01T00:00:00Z', finishedAt: '2026-01-01T00:03:00Z', skippedAt: null },
        goals: [],
        ladder: LADDER
      },
      '/api/ladder': { ladder: LADDER }
    }
  });
  await h.settle();
  const home = h.body();
  check('the first run does NOT re-open for someone who already answered',
    !/What brought you here\?/.test(home));
  check('home shows the one next step', /Add something of your own/.test(home), home.slice(0, 200));
  check('home shows the position on the ladder', /Step 4 of 5/.test(home));
  check('home carries the lock chrome', /Opens after:/.test(home));

  await h.goto('My Layer');
  const saved = h.body();
  check('the Saved screen shows no "opens after" chrome', !/Opens after:/.test(saved));
  check('the Saved screen shows no next-step card', document.querySelectorAll('[data-testid="next-step"]').length === 0);
  // The flat list of options became three bundles, so the screen is checked
  // for the bundles and for one section inside the bundle it opens on.
  check('the Saved screen still offers every group of options',
    /Kept/.test(saved) && /Groups/.test(saved) && /Creator/.test(saved) && /Events/.test(saved),
    saved.slice(0, 200));

  await h.goto('Workflows');
  const actions = h.body();
  check('the Actions desk shows no "opens after" chrome', !/Opens after:/.test(actions));
  check('the Actions desk shows no next-step card', document.querySelectorAll('[data-testid="next-step"]').length === 0);
  // The desk now opens on the waiting-on-you queue, with the tools filed into
  // four bundles behind it.
  check('the Actions desk still offers its bundled tools',
    /Create/.test(actions) && /Sell/.test(actions) && /Run/.test(actions) && /Records/.test(actions));

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
