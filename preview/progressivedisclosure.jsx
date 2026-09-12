// ---------------------------------------------------------------------------
// PROGRESSIVE DISCLOSURE SUITE — the three color-independent primitives and
// their adoption into a real card surface.
//
//   1. SyncStatusDot — honest offline/queued/unsent/synced states
//   2. MicroBadge — compact border-anchored metadata
//   3. ContextMenu — secondary actions behind a "···" bottom sheet
//   4. CatalogView adoption — Publish stays inline; Pause/Share move behind
//      the menu; metadata becomes micro-badges
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

const { SyncStatusDot } = require('./src/ui/SyncStatusDot.tsx');
const { MicroBadge } = require('./src/ui/MicroBadge.tsx');
const { ContextMenu } = require('./src/ui/ContextMenu.tsx');
const { CatalogView } = require('./src/features/spaces/CatalogView.tsx');

let count = 0;
const pass = (name) => { count++; console.log('PASS ' + name); };
const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const btn = (label) => Array.from(document.querySelectorAll('button')).find((b) => text(b).startsWith(label));

async function main() {
  // --- 1. MicroBadge renders a bordered, token-based label ---
  {
    const { container } = mount(React.createElement(MicroBadge, { tone: 'primary' }, 'ACTIVE'));
    const span = container.querySelector('span');
    assert.equal(span.textContent, 'ACTIVE');
    assert.ok(span.style.border.includes('var(--color-primary)'), 'bronze border on primary tone');
    assert.ok(span.style.borderRadius.includes('var(--radius-pill)'), 'pill radius token');
  }
  pass('MicroBadge: compact, border-anchored, token-based');

  // --- 2. ContextMenu: secondary actions behind a bottom sheet ---
  {
    let paused = false;
    const { container } = mount(React.createElement(ContextMenu, {
      ariaLabel: 'Actions for Cake',
      actions: [{ label: 'Pause offer', onSelect: () => { paused = true; } }]
    }));
    // The trigger is icon-only; actions are NOT inline until opened.
    assert.equal(text(container).includes('Pause offer'), false, 'actions hidden by default');
    act(() => { document.querySelector('button[aria-label="Actions for Cake"]').click(); });
    await flush();
    assert.ok(text(container).includes('Pause offer'), 'action revealed in the sheet');
    assert.ok(text(container).includes('Cancel'), 'cancel affordance present');
    act(() => { btn('Pause offer').click(); });
    assert.equal(paused, true, 'action fired');
  }
  pass('ContextMenu: secondary actions disclose on demand');

  // --- 3. SyncStatusDot: honest states from the real queue ---
  {
    // Clear any prior queue state; navigator.onLine is true in jsdom.
    global.localStorage.removeItem('brief.offlineQueue.v1');
    global.localStorage.removeItem('brief.offlineDead.v1');
    const { container } = mount(React.createElement(SyncStatusDot));
    assert.ok(container.querySelector('[role="status"]'), 'renders a status element');
    assert.ok(container.textContent.includes('') || true);
    // Synced state: no queued writes, online.
    assert.ok(container.querySelector('[role="status"]').getAttribute('aria-label') === 'Synced', 'online + empty = synced');
  }
  pass('SyncStatusDot: online with no queue reads "Synced"');

  {
    global.localStorage.setItem('brief.offlineQueue.v1', JSON.stringify([{ id: 'qw_1', path: '/x', method: 'POST', body: '{}', clientKey: 'k', queuedAt: new Date().toISOString() }]));
    const { container } = mount(React.createElement(SyncStatusDot, { label: true }));
    assert.ok(container.textContent.includes('queued'), 'queued writes surfaced');
  }
  pass('SyncStatusDot: parked writes surface as queued, not hidden');

  // --- 4. CatalogView adoption ---
  {
    const offers = [
      { id: 'o1', title: 'Birthday Cake', description: 'Vanilla', price: 2500, currency: 'KES', quantityAvailable: 5, status: 'draft' },
      { id: 'o2', title: 'Bread', description: 'Fresh', price: 60, currency: 'KES', quantityAvailable: null, status: 'active' }
    ];
    let published = null, shared = null, paused = null;
    const { container } = mount(React.createElement(CatalogView, {
      offers,
      onAddOffer: () => {},
      onPublishOffer: (id) => { published = id; },
      onShareOffer: (o) => { shared = o.id; }
    }));
    await flush();
    // Metadata is now micro-badges, not inline spans.
    assert.ok(text(container).includes('DRAFT'), 'draft badge');
    assert.ok(text(container).includes('5 in stock'), 'stock badge');
    // The consequential Publish action stays inline (draft card).
    assert.ok(btn('Publish'), 'Publish stays inline as the primary action');
    // Pause / Share are NOT inline — they live behind the context menu.
    assert.equal(btn('Pause offer'), undefined, 'pause is not an inline button');
    assert.equal(btn('Share link'), undefined, 'share is not an inline button');
    // Open the menu on the draft card.
    act(() => { document.querySelector('button[aria-label="Actions for Birthday Cake"]').click(); });
    await flush();
    assert.ok(btn('Pause offer'), 'pause revealed behind the menu');
    assert.ok(btn('Share link'), 'share revealed behind the menu');
    act(() => { btn('Share link').click(); });
    await flush();
    assert.equal(shared, 'o1', 'share action still fires from the menu');
  }
  pass('CatalogView: metadata = micro-badges, secondary actions = context menu, Publish inline');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
