// ---------------------------------------------------------------------------
// POSITION CARD — the honest "position in time" surface. Pins that it renders
// only real derived numbers (missed captures, expiring quotes, still-open
// demand), and renders NOTHING when the read fails — never a fake "all clear".
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
const { PositionCard } = require('./src/features/home/PositionCard.tsx');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 40) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return c;
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

let fetchHandler;
global.fetch = async (input) => fetchHandler(String(input?.url ?? input ?? ''));

async function main() {
  // --- With real data: missed + expiring + open render honestly ---
  fetchHandler = async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({
      position: {
        decay: {
          expiringQuotes: [{ quoteId: 'q1', requestId: 'r1', title: 'Catering for 50', validUntil: '2026-09-20', hoursLeft: 24 }],
          waitlist: [],
          override: null,
          overdueInstallments: 0
        },
        missedCapture: { count: 1, recent: [{ requestId: 'r2', title: 'Catering for 50', at: '2026-09-12T00:00:00Z' }] },
        open: { total: 2, top: [{ requestId: 'r3', title: '200kg of Irish potatoes', category: 'produce', location: 'Wakulima', severityLabel: 'No supplier yet', collective: false }] },
        derivedAt: '2026-09-14T00:00:00Z',
        note: 'derived'
      }
    })
  });
  {
    const c = mount(React.createElement(PositionCard, null));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Your position'), 'card title renders');
    assert.ok(t.includes('1 proposal you made went to someone else'), 'missed capture renders');
    assert.ok(t.includes('1 proposal expiring'), 'expiring quote renders');
    assert.ok(t.includes('2 requests still open near you'), 'open demand renders');
    assert.ok(t.includes('200kg of Irish potatoes'), 'open gap title renders');
    // No invented KES figure, no tier/badge.
    assert.ok(!/KES\s*[0-9]/.test(t), 'no fabricated KES figure');
    assert.ok(!/Bronze|Silver|Verified Partner|rider queue/.test(t), 'no fabricated tier/badge/queue');
  }
  pass('PositionCard renders only real derived numbers — no fabrication');

  // --- When the read fails, it renders NOTHING (never a fake empty) ---
  fetchHandler = async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'authentication required' }) });
  {
    const c = mount(React.createElement(PositionCard, null));
    await flush();
    assert.equal(text(c), '', 'a failed read renders nothing (no fake all-clear)');
  }
  pass('PositionCard renders nothing when the position read fails');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
