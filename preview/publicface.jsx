// ---------------------------------------------------------------------------
// THE PUBLIC FACE — a mirror, and the owner's only look at it.
//
// The product bet is that a shareable public page is what keeps a Space alive:
// the owner edits the space, the page follows, somebody compliments the link,
// the owner edits again. That loop only holds if the page is TRUE, so these
// tests are mostly about what the page and its panel refuse to say:
//
//   1. the panel's link is the path the server minted (`/s/<slug>`), prefixed
//      with the origin the app is really served from — never a hand-written
//      vanity domain, and never a shorter URL the deployment does not own;
//   2. there is nothing to customize here: no theme, no font, no builder, no
//      reorder control. The only switch is whether the page exists;
//   3. publishing is confirmed, not tapped: one tap must not put a business on
//      the open internet, and the warning names exactly what becomes visible;
//   4. going back to private is described as taking the page down, because that
//      is what the read does;
//   5. what a buyer sees is read from the stranger's own projection: a missing
//      answer is named as missing ("no hours stated"), never padded into a zero
//      and never dressed as a stat;
//   6. the view count stays in the owner's header strip — this panel shows no
//      counter that could read as a score, and no follower leaderboard;
//   7. reports are the server's note, including "Brief has not reviewed them" —
//      no "under review", no "resolved", no moderation promise;
//   8. the contact channel is one honest field: an answer becomes a working
//      WhatsApp link, no answer means no button, and the input never offers a
//      "hide the number" toggle that a wa.me link would make a lie;
//   9. and the whole thing stays inside the room: light surface, lift, no
//      stroke around the panel.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { PublicFacePanel } = require('./src/features/spaces/PublicFacePanel.tsx');
const { SpaceFieldInputs } = require('./src/features/spaces/SpaceFieldInputs.tsx');
const { SpaceShell } = require('./src/features/spaces/SpaceShell.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 60) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btn = (want) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === want || text(b).startsWith(want));
const click = (el) => act(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
const allText = () => text(document.body);

const view = (over = {}) => ({
  id: 'spc_1', slug: 'jj-cakes', name: 'Jj Cakes', type: 'business', goal: 'First 20 customers',
  image: null, initials: 'JC', where: 'Kilimani, Nairobi', when: 'Tue, Sat 06:00–18:00',
  open: { label: 'Open now', tone: 'live', stated: 'Tue, Sat 06:00–18:00', closesAt: '18:00' },
  contact: { platform: 'whatsapp', href: 'https://wa.me/254700111222', display: '+254700111222', digits: '254700111222' },
  offers: [{ id: 'lst_a', title: 'Cupcakes x 24', blurb: null, price: 3000, priceLabel: 'KES 3,000', unit: 'box', minimum: 1, stock: 12, featured: true }],
  offerCount: 1, moreOffers: 0,
  updates: [{ kind: 'stock', text: 'Two 2kg cakes free on Saturday', createdAt: '2026-09-17T10:00:00.000Z', expiresAt: '2026-09-18T10:00:00.000Z' }],
  facts: [], followers: 3, activeOfferCount: 1,
  lastStamp: { at: '2026-09-17T10:00:00.000Z', text: '17 Sep' },
  pageUrl: 'https://brief.app/s/jj-cakes', clock: 'East Africa Time', since: null,
  visibility: 'public', createdAt: '', noindex: false, ...over
});
const face = (over = {}) => ({
  view: view(), path: '/s/jj-cakes', originDeclared: true, open: true, reason: null,
  reports: { count: 0, latest: null, note: 'No reports have been filed against this space.' },
  note: 'The page is a mirror of this space. Edit the space; the page follows. Nothing here is editable from the page.',
  ...over
});
const spaceRow = (over = {}) => ({
  id: 'spc_1', ownerId: 'u_owner', vendorId: 'v1', name: 'Jj Cakes', type: 'business', goal: 'First 20 customers',
  image: null, slug: 'jj-cakes', visibility: 'public', status: 'active', featured: [], followers: 3,
  profileLabels: { where: 'Kilimani', when: 'Tue, Sat', capacity: null, coverage: null, constraints: null },
  metrics: { revenueKes: 0, customerCount: 0, activeOrdersCount: 0, totalOrdersCount: 0, offersCount: 1 },
  offers: [], recentActivities: [], recentConversations: [], editorialOpen: 0,
  maintenance: { state: 'fresh', ageHours: 1, answered: 6, unanswered: 0, due: 0, overdue: 0, fields: [], facts: [], note: '' },
  createdAt: '', updatedAt: '', ...over
});

async function main() {
// --- 1. the link, and what it is not --------------------------------------
{
  const seen = [];
  mount(React.createElement(PublicFacePanel, {
    space: spaceRow(), face: face(), onPublish: () => seen.push('publish')
  }));
  const t = allText();
  assert.ok(t.includes('Public page'), 'the panel names itself');
  assert.ok(t.includes('brief.app/s/jj-cakes'), 'the canonical link the server declared is what is shown');
  assert.ok(!/brief\.app\/jj\b/.test(t), 'no shorter vanity URL that nothing resolves');
  assert.ok(t.includes('Mirror of this space'), 'and it says what it is');
  assert.ok(t.includes('there is nothing to edit here'), 'naming the one thing this panel is not');
  assert.ok(!/views|viewed/i.test(t), 'no view counter in the panel — that number belongs to the header strip');
  assert.ok(!/★|rating|verified|Popular/i.test(t), 'no badge, no stars, no invented status mark');
  assert.ok(!/theme|font|colour|color picker|reorder/i.test(t), 'nothing to customize, so nothing to abandon');
  pass('1. the live page shows the minted link, says it is a mirror, and offers nothing to style');
}

// --- 2. an undeclared origin still yields a real, working address ---------
{
  const f = face({ originDeclared: false, view: view({ pageUrl: null }) });
  mount(React.createElement(PublicFacePanel, { space: spaceRow(), face: f, onPublish: () => {} }));
  const t = allText();
  assert.ok(t.includes('brief.test/s/jj-cakes'), 'without a declared origin the link is the real host this app runs on');
  assert.ok(!/brief\.app/.test(t), 'and nobody invents the brand domain');
  const code = document.querySelector('code');
  assert.ok(code && text(code).includes('/s/jj-cakes'), 'the address is selectable text, not an image of one');
  pass('2. no declared origin, no invented hostname: the address is the origin in use');
}

// --- 3. publishing is confirmed, and the warning is specific --------------
{
  let published = 0;
  mount(React.createElement(PublicFacePanel, {
    space: spaceRow({ visibility: 'private' }),
    face: face({ open: false, view: null, reason: 'This space is private, so it has no public page.', reports: { count: 0, latest: null, note: '' } }),
    onPublish: () => { published += 1; }
  }));
  const t = allText();
  assert.ok(t.includes('This space is private, so it has no public page.'), 'the reason is the server sentence, not a guess');
  assert.ok(!/\/s\/jj-cakes/.test(t), 'a page that is not up has no link to copy');
  assert.ok(!/No offers listed|WhatsApp button live/.test(t), 'and no phantom preview of what a stranger would see');
  assert.equal(document.querySelectorAll('button').length, 1, 'one action, not a settings panel');
  click(btn('Make a public page'));
  const warn = allText();
  assert.ok(warn.includes('on the open internet'), 'the warning says what publishing means');
  assert.ok(warn.includes('/s/jj-cakes'), 'naming the address it creates');
  assert.ok(warn.includes('name, cover photo, stated hours'), 'listing what becomes visible');
  assert.ok(warn.includes('every live offer with its price'), 'including money on the counter');
  assert.ok(warn.includes('orders, customers and money stay private'), 'and what does not');
  assert.equal(published, 0, 'a warning is not yet a write');
  click(btn('Publish it'));
  assert.equal(published, 1, 'the confirm is what publishes');
  pass('3. a tap opens a warning; only the confirmation writes');
}

// --- 4. "stay private" is a real answer, and copy is honest --------------
{
  mount(React.createElement(PublicFacePanel, {
    space: spaceRow({ visibility: 'private' }),
    face: face({ open: false, view: null }),
    onPublish: () => { throw new Error('must not publish'); }
  }));
  click(btn('Make a public page'));
  click(btn('Stay private'));
  assert.ok(!/Publish it/.test(allText()), 'the warning closes');
  assert.ok(allText().includes('no page'), 'and the panel is back to its one honest line');
  pass('4. backing out of publishing costs nothing');
}

// --- 5. clipboard: copied is only said when bytes were written -----------
{
  const written = [];
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async (v) => written.push(v) }, configurable: true, writable: true });
  mount(React.createElement(PublicFacePanel, { space: spaceRow(), face: face(), onPublish: () => {} }));
  click(btn('Copy'));
  await flush();
  assert.deepEqual(written, ['https://brief.app/s/jj-cakes'], 'the copied value is the page address itself');
  assert.ok(allText().includes('Copied'), 'and only then does it say so');
  pass('5. copy writes the real address and only then claims success');
}

// --- 6. a mirror with nothing in it says so, in chips, not in zeros ------
{
  const empty = face({
    view: view({
      offers: [], offerCount: 0, moreOffers: 0, updates: [], facts: [], followers: 0, activeOfferCount: 0,
      contact: null, image: null, lastStamp: null,
      open: { label: null, tone: 'empty', stated: null, reason: 'no hours stated' }
    })
  });
  mount(React.createElement(PublicFacePanel, { space: spaceRow(), face: empty, onPublish: () => {} }));
  const t = allText();
  assert.ok(t.includes('no offers listed'), 'an empty counter is named, not shown as 0 offers');
  assert.ok(t.includes('no hours stated'), 'same for hours');
  assert.ok(t.includes('no cover photo'), 'same for the picture');
  assert.ok(t.includes('no contact number'), 'and the missing button is called out, because it is the fix');
  assert.ok(t.includes('no updates posted'), 'and the empty RECENT layer');
  assert.ok(t.includes('Add one under To do → contact'), 'with the one place to fix it');
  assert.ok(!/0 follow|0 offer|0 update/.test(t), 'no bare zeros anywhere');
  assert.ok(!/Open now|Closed now/.test(t), 'no hours answer, so no open/closed mark');
  pass('6. an empty space mirrors as empty, and the fixes are named');
}

// --- 7. reports: the server note, with no moderation promise ------------
{
  mount(React.createElement(PublicFacePanel, {
    space: spaceRow(),
    face: face({ reports: { count: 2, latest: { reason: 'Prices are not theirs', at: '', handled: false }, note: '2 reports filed. Brief has not reviewed them, so nothing has changed about your page.' } }),
    onPublish: () => {}
  }));
  const t = allText();
  assert.ok(t.includes('2 reports filed'), 'the count is the rows');
  assert.ok(t.includes('Brief has not reviewed them'), 'and the absence of a review is said');
  assert.ok(!/under review|resolved|taken down|strike|warning issued/i.test(t), 'no fake moderation state');
  assert.ok(!/appeal|respond to report/i.test(t), 'and no button that would write a row nobody reads');
  pass('7. a report reaches the owner as a fact, not as a threat or a status');
}

// --- 8. the room: lift and light, not a stroke ---------------------------
{
  mount(React.createElement(PublicFacePanel, { space: spaceRow(), face: face(), onPublish: () => {} }));
  const section = document.querySelector('section[aria-label="Public page"]');
  assert.ok(section, 'one labelled region');
  const cls = section.getAttribute('class') || '';
  assert.ok(/brief-lift-\d/.test(cls), 'raised by light and shadow');
  assert.ok(!/\bborder\b/.test(cls), 'and not outlined — a bordered surface is outside the room');
  const bg = section.getAttribute('style') || '';
  assert.ok(bg.includes('--brief-card'), 'the surface is the room card colour');
  const anchor = document.querySelector('a[href="/s/jj-cakes"]');
  assert.ok(anchor && anchor.getAttribute('target') === '_blank', 'Open goes to the real page, in a new tab, so the mirror is checkable');
  pass('8. the panel is in the room, and its Open link is the actual page');
}

// --- 9. the contact field: an input that refuses, not a toggle ----------
{
  const fields = [
    { key: 'what', question: 'What do you actually sell or provide?', help: 'Plain words.', kind: 'text', cadenceHours: 720, state: 'current', ageHours: 1, dueInHours: 700, updatedAt: '', lastConfirmedAt: '', confirmations: 0, value: { text: 'Cakes' } },
    { key: 'contactChannel', question: 'Where should a buyer reach you?', help: 'Your public page gets one button that opens WhatsApp to this number.', kind: 'contact', cadenceHours: 4320, state: 'skipped', ageHours: null, dueInHours: 4320, updatedAt: '', lastConfirmedAt: '', confirmations: 0, value: null }
  ];
  const sent = [];
  mount(React.createElement(SpaceFieldInputs, { fields, values: {}, onChange: (k, v) => sent.push([k, v]) }));
  const phone = document.querySelector('input[aria-label="contactChannel phone"]');
  assert.ok(phone, 'the contact question gets a real tel input, not a note');
  assert.equal(phone.getAttribute('type'), 'tel', 'a phone keyboard, which is the thing that stops a mistyped number');
  const msg = document.querySelector('input[aria-label="contactChannel first message"]');
  assert.ok(msg, 'and an optional first sentence a buyer opens with');
  assert.equal(document.querySelectorAll('input[type="checkbox"],input[type="radio"]').length, 0, 'no "hide the digits" switch: a wa.me link is the digits, so that control would lie');
  act(() => { phone.dispatchEvent(new dom.window.Event('focus')); });
  const setVal = (el, v) => act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  setVal(phone, '+254 700 111 222');
  assert.deepEqual(sent[0], ['contactChannel', { platform: 'whatsapp', phone: '+254 700 111 222', message: '' }], 'the value carries the platform the server can actually link');
  const hint = allText();
  assert.ok(hint.includes('A wrong number is refused, not stored'), 'the input tells the truth about validation');
  assert.ok(hint.includes('Nothing is sent for you'), 'and does not promise a message on the owner\u2019s behalf');
  pass('9. the contact channel is one honest input, with no half-measure toggle');
}

// --- 10. the shell: the chip warns, the panel publishes -----------------
{
  const calls = [];
  const ok = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
  global.fetch = async (input, init) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? input);
    const method = String(init?.method ?? 'GET').toUpperCase();
    calls.push(`${method} ${url}`);
    if (url.includes('/api/spaces/spc_1/public-page')) return ok(face({ originDeclared: false, view: view({ pageUrl: null }) }));
    if (url.includes('/api/spaces/spc_1/audience')) return ok({ slug: 'jj-cakes', followers: 3, followerList: [], iAmFollowing: false, broadcasts: [], pastBroadcasts: 0, templates: [], insights: null, canManage: true, followable: false });
    if (url.endsWith('/api/spaces/spc_1/profile-schema') || url.includes('/profile-schema')) return ok({ fields: [] });
    if (url.includes('/api/spaces/spc_1/operating')) return ok({ fields: [], maintenance: null, editorial: [], pipeline: null });
    if (method === 'PATCH' && url.endsWith('/api/spaces/spc_1')) return ok({ space: spaceRow({ visibility: 'public' }) });
    if (url.includes('/api/spaces/spc_1')) return ok({ space: spaceRow({ visibility: 'private' }) });
    return ok({});
  };
  mount(React.createElement(SpaceShell, { spaceId: 'spc_1' }));
  await flush();
  // The private space's panel is up, and it is the mirror read, not a claim.
  assert.ok(allText().includes('Public page'), 'the shell mounts the face panel');
  const publicChip = Array.from(document.querySelectorAll('button')).find((b) => text(b) === 'Public');
  assert.ok(publicChip, 'the visibility row still exists');
  const before = calls.length;
  click(publicChip);
  await flush();
  assert.equal(calls.length, before, 'tapping the Public chip writes nothing at all');
  assert.ok(allText().includes('on the open internet'), 'it shows the warning first');
  click(btn('Publish it'));
  await flush();
  assert.ok(calls.some((c) => c.startsWith('PATCH') && c.includes('/api/spaces/spc_1')), 'the confirm is what sends the change');
  pass('10. SpaceShell holds the confirm-before-publish line; the panel cannot be bypassed');
}

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
