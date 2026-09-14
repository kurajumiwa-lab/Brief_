// ---------------------------------------------------------------------------
// COMMITMENTS CARD — the reciprocal ledger ("owed to you" / "you owe"). Pins
// that it renders only real derived numbers, and renders NOTHING on a failed
// read (never a fabricated zero).
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
const { CommitmentsCard } = require('./src/features/home/CommitmentsCard.tsx');

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
  // --- With real data: owed-to-me + owed-by-me render, with real KES ---
  fetchHandler = async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({
      commitments: {
        owedToMe: [{ id: 'c1', kind: 'payment', fromParty: 'buyer', toParty: 'me', value: { amount: 1500, currency: 'KES' }, deadline: null, status: 'open', evidence: { table: 'orders', id: 'o1' } }],
        owedByMe: [{ id: 'c2', kind: 'repayment', fromParty: 'me', toParty: 'grp1', value: { amount: 850, currency: 'KES' }, deadline: null, status: 'open', evidence: { table: 'tableBankingLoans', id: 'l1' } }],
        fulfilled: [], lapsed: [],
        owedToMeKes: 1500, owedByMeKes: 850,
        derivedAt: '2026-09-14T00:00:00Z', note: 'derived'
      }
    })
  });
  {
    const c = mount(React.createElement(CommitmentsCard, null));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Your commitments'), 'card title renders');
    assert.ok(t.includes('Owed to you'), 'owed-to-me section renders');
    assert.ok(t.includes('KES 1,500'), 'owed-to-me amount renders');
    assert.ok(t.includes('You owe'), 'owed-by-me section renders');
    assert.ok(t.includes('KES 850'), 'owed-by-me amount renders');
    assert.ok(t.includes('every line traces to a real record'), 'honesty note renders');
  }
  pass('CommitmentsCard renders the reciprocal ledger with real KES');

  // --- Empty account -> renders nothing ---
  fetchHandler = async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({
      commitments: { owedToMe: [], owedByMe: [], fulfilled: [], lapsed: [], owedToMeKes: 0, owedByMeKes: 0, derivedAt: '2026-09-14T00:00:00Z', note: 'derived' }
    })
  });
  {
    const c = mount(React.createElement(CommitmentsCard, null));
    await flush();
    assert.equal(text(c), '', 'nothing to say -> renders nothing');
  }
  pass('CommitmentsCard renders nothing when there are no open commitments');

  // --- Failed read -> renders nothing ---
  fetchHandler = async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'authentication required' }) });
  {
    const c = mount(React.createElement(CommitmentsCard, null));
    await flush();
    assert.equal(text(c), '', 'failed read -> renders nothing (no fake zero)');
  }
  pass('CommitmentsCard renders nothing when the read fails');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
