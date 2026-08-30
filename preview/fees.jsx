// SERVICE FEES — paying Brief through Pochi la Biashara, rendered for real
// with mocked data. Proves the member experience: the server-side price, the
// Pochi number stated honestly, the manual M-Pesa code flow, and states that
// say exactly what they are (pending is PENDING).
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement; global.Element = dom.window.Element; global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent; global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
require('./suiteauth.cjs').installSuiteSession();
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

const CATALOG = [
  { key: 'store_monthly', label: 'Your store on Brief — one month', amountKes: 250 },
  { key: 'promotion_weekly', label: 'Promote a listing for one week', amountKes: 500 }
];
const baseFee = (over = {}) => ({
  id: 'fee_1', userId: 'usr_me', service: 'store_monthly', label: CATALOG[0].label, amountKes: 250,
  mpesaCode: 'QJD31X5K2S', status: 'confirmed', refusedReason: null,
  confirmedAt: new Date().toISOString(), createdAt: new Date().toISOString(), ledgerId: 'txn_1', ...over
});
let FEES = [baseFee()];
let NEXT = null; // when set, the next pay call returns this row

global.fetch = async (url, init = {}) => {
  const path = String(url);
  const send = (b, s = 200) => ({ ok: s < 400, status: s, text: async () => JSON.stringify(b), json: async () => b });
  if (path.includes('/api/fees/pay')) {
    const body = JSON.parse(init.body ?? '{}');
    if (!CATALOG.some((x) => x.key === body.service)) return send({ error: 'unknown service' }, 400);
    if (!/^[A-Z0-9]{8,12}$/.test(body.mpesaCode ?? '')) return send({ error: 'that does not look like an M-Pesa confirmation code' }, 400);
    if (FEES.some((f) => f.mpesaCode === body.mpesaCode)) return send({ error: 'this M-Pesa code has already been recorded' }, 409);
    const svc = CATALOG.find((x) => x.key === body.service);
    const row = baseFee({ id: 'fee_new', service: svc.key, label: svc.label, amountKes: svc.amountKes, mpesaCode: body.mpesaCode, status: 'pending', confirmedAt: null });
    FEES = [row, ...FEES];
    return send({ fee: row }, 201);
  }
  if (path.includes('/api/fees/mine')) {
    return send({ pochi: '0700000000', services: CATALOG, fees: FEES });
  }
  return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
};

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

(async () => {
  const { default: ServiceFees } = await import('../src/components/ServiceFees.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(ServiceFees)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const btn = (t) => Array.from(document.querySelectorAll('button')).find((b) => text(b) === t);
  const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); }); };
  const setVal = (el, v) => {
    const d = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value');
    d.set.call(el, v); el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };

  console.log('=== the surface states its terms ===');
  check('the Pochi number is shown when configured', body().includes('Pochi la Biashara 0700000000'));
  check('the price is the server catalog price', body().includes('KES 250') && body().includes('KES 500'));
  check('a confirmed payment says CONFIRMED, not "success"', body().toUpperCase().includes('CONFIRMED'));

  console.log('\n=== the manual code flow ===');
  const code = document.querySelector('input[aria-label="M-PESA confirmation code"]');
  await act(async () => { setVal(code, 'SBK4R9T2XA'); });
  await click(btn('Submit'));
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  check('submitting a code records PENDING, and says so', body().includes('pending') && body().includes('activates when the operator confirms'), body().slice(-200));
  check('the new row renders with its code', body().includes('SBK4R9T2XA'));

  console.log('\n=== one code, one payment ===');
  await act(async () => { setVal(code, 'SBK4R9T2XA'); });
  await click(btn('Submit'));
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  check('a replayed M-Pesa code is refused with the reason', body().includes('already been recorded'), body().slice(-160));

  console.log('\n=== nothing activates on trust alone ===');
  const rows = Array.from(document.querySelectorAll('div.rounded-xl.border')).filter((d) => text(d).includes('code '));
  check('every payment row states its state', rows.length >= 2 && rows.every((r) => /pending|confirmed|refused/i.test(text(r))));

  console.log(`\nPASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
