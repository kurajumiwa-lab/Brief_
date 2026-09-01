// F4 / T8 — the operator desk. A separate authenticated surface: offered from
// the menu only to sessions carrying an operator capability, never a sixth
// consumer destination, every call re-checked server-side.
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react'); const { createRoot } = require('react-dom/client'); const { act } = require('react-dom/test-utils');
const fs = require('fs');
const AdminDesk = require('./src/components/AdminDesk.tsx').AdminDesk;
const MenuSheet = require('./src/components/MenuSheet.tsx').MenuSheet;
const briefSrc = fs.readFileSync(__dirname + '/src/api/briefApi.ts', 'utf8');
// Phase 3 note: full-screen overlays (incl. MenuSheet mount, which carries the
// operator gate) live in src/screens/OverlaysShell.tsx; the behavioral
// invariant asserted below is unchanged, so read that file too.
const appSrc = (fs.readFileSync(__dirname + '/src/App.tsx', 'utf8') + '\n' + fs.readFileSync(__dirname + '/src/model/core.tsx', 'utf8') + '\n' + fs.readFileSync(__dirname + '/src/screens/OverlaysShell.tsx', 'utf8'));
const routesSrc = fs.readFileSync(__dirname + '/src/nav/routes.ts', 'utf8');
const deskSrc = fs.readFileSync(__dirname + '/src/components/AdminDesk.tsx', 'utf8');

const ADMIN = { id: 'u_admin', handle: 'admin', displayName: 'Admin', capabilities: ['ops.read', 'ops.run', 'moderate', 'finance', 'admin'] };
const NOBODY = { id: 'u_x', handle: 'x', displayName: 'X', capabilities: [] };

async function main() {
  let pass = 0, fail = 0;
  const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };
  const text = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const click = async el => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); }); };
  const btn = t => Array.from(document.querySelectorAll('button')).find(b => text(b) === t || text(b).startsWith(t));

  console.log('=== The desk renders its eight stations ===');
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(AdminDesk, { open: true, onClose: () => {}, me: ADMIN })); });
  for (const t of ['Health', 'Attention', 'Ingestion', 'Content', 'Media', 'Commerce', 'Security', 'Diagnostics']) {
    check(`station ${t} is offered`, !!btn(t));
  }
  check('the desk names the capabilities the session carries', body().includes('ops.read'));

  console.log('\n=== Every station is honest without a server ===');
  for (const t of ['Health', 'Attention', 'Ingestion', 'Content', 'Media', 'Commerce', 'Security', 'Diagnostics']) {
    const b = btn(t); if (b) await click(b);
    const txt = body();
    check(`${t} shows a loading/empty/error state, never invention`,
      /loading|no |none|needs the|unavailable|error|refused|capability/i.test(txt), txt.slice(0, 80));
  }

  console.log('\n=== Authority is the session\'s, and the desk says so ===');
  await act(async () => { root.render(React.createElement(AdminDesk, { open: true, onClose: () => {}, me: NOBODY })); });
  check('a capability-less session is told it carries none', body().includes('no operator capability'));
  const commerceTab = btn('Commerce'); if (commerceTab) await click(commerceTab);
  check('commerce names the finance capability it lacks', body().includes('finance capability'));
  await act(async () => { root.render(React.createElement(AdminDesk, { open: false, onClose: () => {}, me: ADMIN })); });
  check('a closed desk renders nothing', body() === '');
  await act(async () => { root.unmount(); });

  console.log('\n=== The menu offers the desk only to operators ===');
  const root2 = createRoot(document.getElementById('root'));
  await act(async () => { root2.render(React.createElement(MenuSheet, { open: true, onClose: () => {}, onSelect: () => {}, onSelectCity: () => {}, selectedLocation: 'Nairobi', canOperate: false })); });
  check('without capabilities there is no Operate entry', !btn('Operate'));
  await act(async () => { root2.render(React.createElement(MenuSheet, { open: true, onClose: () => {}, onSelect: () => {}, onSelectCity: () => {}, selectedLocation: 'Nairobi', canOperate: true })); });
  check('an operator sees the Operate entry', !!btn('Operate'));
  await act(async () => { root2.unmount(); });

  console.log('\n=== Source guards ===');
  check('App gates the entry on real session capabilities', /canOperate=\{briefApi\.isOperator\(sessionUser\)\}/.test(appSrc));
  check('the desk is an overlay, not a destination', /adminOpen/.test(appSrc) && !/'admin'/.test(appSrc.match(/export type Destination =[^;]*;/)[0]));
  check('routes carry the admin overlay on the query string', /admin/.test(routesSrc) && /q\.get\('admin'\) === '1'/.test(routesSrc) && /q\.set\('admin', '1'\)/.test(routesSrc));
  check('§4: the desk fetches only through briefApi', !/fetch\(/.test(deskSrc));
  check('the operator bindings exist client-side', ['/api/ops/diagnostics', '/api/ops/verification', '/api/ops/disputes', '/api/ops/ticket-listings', '/api/ops/roles', '/api/economic/reconcile'].every(p => briefSrc.includes(p)));
  check('a dispute is never given a fake resolve button', !/resolveDispute/.test(deskSrc) && /terminal/i.test(deskSrc));

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('admin suite crashed:', e); process.exit(1); });
