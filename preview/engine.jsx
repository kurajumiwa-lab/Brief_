// ---------------------------------------------------------------------------
// ENGINE SUITE — the client half of the power-plant layer.
//
// Renders the real EnginePanel against a mocked engine API and asserts:
//   * the pipeline visualizer shows REAL telemetry (labels, timings, counts)
//   * the tier guardrail renders server caps + the blurred next tier
//   * the upgrade attempt surfaces the server's honest 402 verbatim
//   * the universal router lists rules + the dispatch ledger
//   * an objects delta silently fires onObjectsChanged (the live refresh wire)
//
// Nothing here asserts an animation or a fabricated number.
// ---------------------------------------------------------------------------
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const EnginePanel = require('./src/components/EnginePanel.tsx').default;

let calls = [];
let objectsRefreshed = 0;
let tierCalled = 0;

const send = (body, status = 200) => ({
  ok: status < 400, status,
  text: async () => JSON.stringify(body),
  json: async () => body
});

const STATUS = {
  engine: 'brief.engine/1',
  version: 'abc123def4567890abcdef',
  watermark: null,
  collections: { objects: 5 },
  guardrail: {
    tier: 'free', label: 'Free',
    caps: { syncIntervalMs: 30000, maxRoutes: 1, pipelineDepth: 'core' },
    micro: 'Background sync every 30s · core pipeline · 1 routing route',
    next: { tier: 'pro', label: 'Pro', micro: 'Sync every 10s · full stage telemetry · 5 routing routes' },
    billingConfigured: false
  },
  router: { signingConfigured: true, channels: [{ kind: 'webhook', configured: true }] },
  billingConfigured: false
};

const SYNC_RUN = {
  inSync: false,
  version: 'abc123def4567890abcdef',
  stages: [
    { id: 'ping', label: 'Ping Gateway', status: 'done', ms: 0.42, detail: '5 collections live' },
    { id: 'hash', label: 'Hash Comparison', status: 'done', ms: 1.13, detail: 'cold client — no prior manifest' },
    { id: 'delta', label: 'Delta Isolation', status: 'done', ms: 0.81, detail: '3 rows isolated' },
    { id: 'render', label: 'UI Render', status: 'client', ms: null, detail: '3 rows to apply' }
  ],
  deltas: { objects: { added: [{ id: 'obj_new', title: 'New event' }], updated: [], removed: [] } },
  deltaRows: 3,
  manifest: { version: 'abc123def4567890abcdef', collections: { objects: { count: 5, digest: 'x', rows: {} } } },
  guardrail: { caps: { syncIntervalMs: 30000 } }
};

global.fetch = async (url) => {
  const path = String(url);
  calls.push(path);
  if (path.includes('/api/engine/status')) return send(STATUS);
  if (path.includes('/api/engine/sync')) return send(SYNC_RUN);
  if (path.includes('/api/engine/routes') && path.includes('/test')) return send({ ok: false, results: [] });
  if (path.includes('/api/engine/routes')) return send({
    routes: [{
      id: 'ert_1', name: 'Ops hook',
      match: { signalType: 'order_paid', objectId: null },
      channels: [{ kind: 'webhook', to: 'https://hooks.example/ops' }],
      enabled: true, createdAt: '2026-08-26T00:00:00Z'
    }]
  });
  if (path.includes('/api/engine/deliveries')) return send({
    deliveries: [{ id: 'edl_1', routeId: 'ert_1', channel: 'webhook', target: 'https://hooks.example/ops', status: 'delivered', at: '2026-08-26T00:00:00Z' }]
  });
  if (path.includes('/api/engine/tier')) {
    tierCalled++;
    return send({
      ok: false, reason: 'billing_not_configured', tier: 'free', requested: 'pro',
      unlocks: 'Sync every 10s · full stage telemetry · 5 routing routes',
      detail: 'No billing rail is connected yet, so Brief will not pretend to take your money. An operator can grant this tier today.'
    }, 402);
  }
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

async function main() {
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(React.createElement(EnginePanel, { onObjectsChanged: () => { objectsRefreshed++; } }));
  });

  // Let the first heartbeat fire (scheduled ~1.5s after start).
  await act(async () => { await new Promise((r) => setTimeout(r, 2100)); });

  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === t || text(b).startsWith(t));

  console.log('=== The engine room renders from real server state ===');
  check('engine header present', body().includes('Brief Engine'));
  check('tier badge shows the server tier', body().includes('Free'));
  check('manifest version surfaced', body().includes('abc123de'));

  console.log('\n=== The linear pipeline shows REAL telemetry ===');
  check('Ping Gateway node present', body().includes('Ping Gateway'));
  check('Hash Comparison node present', body().includes('Hash Comparison'));
  check('Delta Isolation node present', body().includes('Delta Isolation'));
  check('UI Render node present', body().includes('UI Render'));
  check('real server timings shown', body().includes('0.42ms') && body().includes('1.13ms'));
  check('delta count surfaced', body().includes('3 rows merged'));
  check('the sync endpoint was actually called', calls.some((c) => c.includes('/api/engine/sync')));

  console.log('\n=== Deltas silently refresh the live feed ===');
  check('an objects delta fired onObjectsChanged', objectsRefreshed === 1, `fired ${objectsRefreshed}x`);

  console.log('\n=== The inline tier controller ===');
  check('current caps rendered', body().includes('every 30s') && body().includes('Routing routes'));
  check('blurred next tier described', body().includes('Pro') && body().includes('Sync every 10s'));
  check('unlock affordance present', Boolean(btn('Unlock Pro')));

  console.log('\n=== The upgrade attempt surfaces the honest 402 ===');
  await act(async () => { const b = btn('Unlock Pro'); if (b) b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
  check('tier endpoint called', tierCalled === 1);
  check('refusal detail shown verbatim', body().includes('will not pretend to take your money'));
  check('what pro unlocks is stated', body().includes('What Pro unlocks'));

  console.log('\n=== The universal router ===');
  check('HMAC-signed chip present', body().includes('HMAC-signed'));
  check('routing rule listed with its match', body().includes('Ops hook') && body().includes('order_paid'));
  check('dispatch ledger shows real outcomes', body().includes('delivered'));

  console.log('\n=== The guardrail respects the server interval ===');
  const syncCalls = calls.filter((c) => c.includes('/api/engine/sync')).length;
  check('no beat storms while mounted (interval respected)', syncCalls === 1, `${syncCalls} sync calls in ~2.2s`);

  console.log(`\npass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
