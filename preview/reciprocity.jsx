// ---------------------------------------------------------------------------
// RECIPROCITY CARD — the social-debt surface. Pins that it renders only real
// favors, and renders NOTHING on empty/failed reads (never a fabricated entry).
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
const { ReciprocityCard } = require('./src/features/home/ReciprocityCard.tsx');

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
  // --- With real favors ---
  fetchHandler = async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({
      reciprocity: {
        owedToMe: [
          { id: 'r1', kind: 'loan_guarantee', fromParty: 'g1', toParty: 'me', value: { amount: 5000, currency: 'KES' }, status: 'open', createdAt: '2026-09-10T00:00:00Z', fulfilledAt: null, evidence: { table: 'tableBankingLoans', id: 'l1' } },
          { id: 'r2', kind: 'recommendation', fromParty: 'p1', toParty: 'me', value: null, status: 'open', createdAt: '2026-09-12T00:00:00Z', fulfilledAt: null, evidence: { table: 'coopPartnerships', id: 'c1' } }
        ],
        owedByMe: [{ id: 'r3', kind: 'delivery_cover', fromParty: 'me', toParty: 'a1', value: { amount: 20, currency: 'KES' }, status: 'open', createdAt: '2026-09-13T00:00:00Z', fulfilledAt: null, evidence: { table: 'pickups', id: 'p1' } }],
        fulfilled: [],
        aging: [{ id: 'r4', kind: 'loan_guarantee', fromParty: 'g2', toParty: 'me', value: { amount: 1000, currency: 'KES' }, status: 'open', createdAt: '2026-08-01T00:00:00Z', fulfilledAt: null, evidence: { table: 'tableBankingLoans', id: 'l2' }, ageDays: 44 }],
        windowDays: 14, derivedAt: '2026-09-14T00:00:00Z', note: 'derived'
      }
    })
  });
  {
    const c = mount(React.createElement(ReciprocityCard, null));
    await flush();
    const t = text(c);
    assert.ok(t.includes('Reciprocity'), 'card title renders');
    assert.ok(t.includes('Went out of their way for you'), 'owed-to-me section renders');
    assert.ok(t.includes('guaranteed your loan'), 'loan-guarantee favor labeled');
    assert.ok(t.includes('vouched for you'), 'recommendation favor labeled');
    assert.ok(t.includes('1 favor is over 14 days old'), 'aging favor surfaces');
    // No fabricated KES figure for favors without a real value.
    assert.ok(!t.includes('KES 2,040'), 'no invented sector story');
  }
  pass('ReciprocityCard renders only real favors');

  // --- Empty -> renders nothing ---
  fetchHandler = async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({
      reciprocity: { owedToMe: [], owedByMe: [], fulfilled: [], aging: [], windowDays: 14, derivedAt: '2026-09-14T00:00:00Z', note: 'derived' }
    })
  });
  {
    const c = mount(React.createElement(ReciprocityCard, null));
    await flush();
    assert.equal(text(c), '', 'nothing to say -> renders nothing');
  }
  pass('ReciprocityCard renders nothing when there are no favors');

  // --- Failed read -> renders nothing ---
  fetchHandler = async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'authentication required' }) });
  {
    const c = mount(React.createElement(ReciprocityCard, null));
    await flush();
    assert.equal(text(c), '', 'failed read -> renders nothing');
  }
  pass('ReciprocityCard renders nothing when the read fails');

  console.log('\nPASS ' + count);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
