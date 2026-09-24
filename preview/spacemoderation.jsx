const assert = require('assert').strict;
const fs = require('fs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://brief.test', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement; global.Node = dom.window.Node;
global.localStorage = dom.window.localStorage; global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
const { SpaceModerationPanel } = require('./src/components/SpaceModerationPanel.tsx');
const { PublicFacePanel } = require('./src/features/spaces/PublicFacePanel.tsx');
const { NavSheet } = require('./src/app/NavSheet.tsx');
const report = { id: 'report_1', spaceId: 'shop_1', spaceName: 'Test shop', slug: 'test-shop', reason: 'Misleading description', createdAt: '2026-09-25T09:00:00Z', outcome: 'pending', handledAt: null, handledBy: null, moderationReason: null, canReview: true };
let data, writes, failNext, denied;
const reset = () => { data = { reports: [{ ...report }], hiddenPages: [] }; writes = []; failNext = false; denied = false; };
const response = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
global.fetch = async (url, init = {}) => {
  if (denied) return response({ error: 'The moderate capability is required.' }, 403);
  if (!init.method || init.method === 'GET') return response(data);
  writes.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
  if (failNext) { failNext = false; return response({ error: 'Save failed. Retry the same request.' }, 503); }
  const body = JSON.parse(init.body);
  if (String(url).endsWith('/review')) {
    data.reports[0] = { ...data.reports[0], outcome: body.outcome, canReview: false, handledAt: '2026-09-25T10:00:00Z', handledBy: 'reviewer_1', moderationReason: body.reason };
    if (body.outcome === 'upheld') data.hiddenPages = [{ id: 'shop_1', name: 'Test shop', slug: 'test-shop', status: 'active', holdId: 'hold_1', hiddenAt: '2026-09-25T10:00:00Z', canReinstate: true }];
  } else data.hiddenPages = [];
  return response({ actionId: 'audit_1', spaceId: 'shop_1', visibility: body.outcome === 'upheld' ? 'private' : 'public', replayed: false });
};
const flush = () => new Promise(r => setTimeout(r, 15));
async function mount(element) {
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  await act(async () => { root.render(element); await flush(); });
  return { host, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text);
const click = async el => { assert.ok(el); await act(async () => { el.click(); await flush(); }); };
const fill = async (el, value) => { await act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await flush();
}); };
let count = 0;
const test = async (name, fn) => { reset(); await fn(); count++; console.log('PASS ' + name); };
async function main() {
  await test('reviewer must supply a real reason; no canned reason is submitted', async () => {
    const { host, close } = await mount(<SpaceModerationPanel />);
    assert.equal(host.querySelector('textarea').value, '');
    assert.ok(button(host, 'Uphold & hide page').disabled); assert.ok(button(host, 'Dismiss report').disabled);
    await fill(host.querySelector('textarea'), '   '); assert.ok(button(host, 'Dismiss report').disabled);
    assert.equal(writes.length, 0); await close();
  });
  await test('uphold retries reuse the idempotency key, then reinstatement requires its own reason and current hold', async () => {
    const { host, close } = await mount(<SpaceModerationPanel />);
    await fill(host.querySelector('textarea'), 'Evidence confirms the misleading description.');
    failNext = true; await click(button(host, 'Uphold & hide page'));
    assert.match(host.querySelector('[role="alert"]').textContent, /Save failed/);
    await click(button(host, 'Uphold & hide page'));
    assert.equal(writes.length, 2); assert.equal(writes[0].headers['Idempotency-Key'], writes[1].headers['Idempotency-Key']);
    assert.deepEqual(writes[1].body, { outcome: 'upheld', reason: 'Evidence confirms the misleading description.' });
    assert.match(host.textContent, /public page hidden/);
    assert.ok(button(host, 'Reinstate public page').disabled);
    await fill(host.querySelector('textarea'), 'The public description is now corrected.');
    await click(button(host, 'Reinstate public page'));
    assert.deepEqual(writes[2].body, { holdId: 'hold_1', reason: 'The public description is now corrected.' });
    assert.notEqual(writes[1].headers['Idempotency-Key'], writes[2].headers['Idempotency-Key']);
    assert.match(host.textContent, /Page reinstated/); assert.match(host.textContent, /Test shop · upheld/);
    assert.match(host.textContent, /No pages are currently held/); await close();
  });
  await test('dismissal completes the report without offering a reinstatement or hiding the page', async () => {
    const { host, close } = await mount(<SpaceModerationPanel />);
    await fill(host.querySelector('textarea'), 'This complaint is not supported by the evidence.');
    await click(button(host, 'Dismiss report'));
    assert.equal(writes[0].body.outcome, 'dismissed'); assert.match(host.textContent, /Test shop · dismissed/);
    assert.equal(button(host, 'Reinstate public page'), undefined); await close();
  });
  await test('denied queue reads are explicit, not an empty successful review queue', async () => {
    denied = true;
    const { host, close } = await mount(<SpaceModerationPanel />);
    assert.match(host.querySelector('[role="alert"]').textContent, /moderate capability/);
    assert.ok(!host.textContent.includes('No page reports.')); assert.equal(writes.length, 0); await close();
  });
  await test('the owner sees the moderation hold, can edit content, but has no republish affordance', async () => {
    let edits = 0, publishes = 0;
    const face = { open: false, path: '/s/test-shop', originDeclared: false, view: null, reason: 'Hidden following review. Authorized reinstatement is required.', moderation: { hidden: true, hiddenAt: '2026-09-25' }, reports: { count: 1, latest: null, note: 'One report upheld.' }, note: '' };
    const { host, close } = await mount(<PublicFacePanel space={{ id: 'shop_1', name: 'Test shop', slug: 'test-shop' }} face={face} onPublish={() => publishes++} onEditSpace={() => edits++} />);
    assert.match(host.textContent, /Hidden following review/); assert.match(host.textContent, /One report upheld/);
    assert.equal(button(host, 'Publish it'), undefined); assert.ok(!host.textContent.includes('Make a public page'));
    await click(button(host, 'Edit page content')); assert.equal(edits, 1); assert.equal(publishes, 0); await close();
  });
  await test('the live All menu exposes moderation only to capable sessions', async () => {
    let target;
    const props = { open: true, place: '', onSetPlace() {}, onClose() {}, onGo(t) { target = t; } };
    const regular = await mount(<NavSheet {...props} />);
    assert.equal(regular.host.querySelector('[data-testid="menu-tile-page-moderation"]'), null); await regular.close();
    const reviewer = await mount(<NavSheet {...props} canModerate />);
    await click(reviewer.host.querySelector('[data-testid="menu-tile-page-moderation"]'));
    assert.deepEqual(target, { kind: 'moderation' }); await reviewer.close();
    const shell = fs.readFileSync(require('path').join(__dirname, 'src/app/AppShell.tsx'), 'utf8');
    assert.ok(shell.includes("hash === 'moderation'")); assert.ok(shell.includes('<SpaceModerationPanel />'));
  });
  console.log(`\nPASS ${count}`);
}
main().then(() => { dom.window.close(); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
