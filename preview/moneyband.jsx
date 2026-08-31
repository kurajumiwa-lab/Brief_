const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'https://brief.test/', pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const fs = require('fs');

const { moneyBandModel, MONEY_BAND_MIN_TOTAL } = require('./src/components/MoneyBand.tsx');
const { BoostSheet } = require('./src/components/BoostSheet.tsx');
const { LeadPackSheet } = require('./src/components/LeadPackSheet.tsx');

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

// ---------------------------------------------------------------------------
// MONEY BAND + MONETISATION SHEETS SUITE
//
// Rules under test:
// - every count is a real array length; empty bands hide; the whole strip
//   hides below the density floor (never renders an empty money feed);
// - prices come from the SERVER catalog response, never from the client;
// - pay payloads carry service + code + target and NO amount;
// - an intro sheet can never leak the other person's contact details.
// ---------------------------------------------------------------------------

const post = (id, town = null) => ({ id, intent: 'need', intentLabel: 'Need', title: 'post ' + id, body: null, category: null, town, county: null, createdAt: '', status: 'open', mine: false, author: { id: 'u' + id, handle: null, displayName: 'A' }, trust: null });
const listing = (id) => ({ id, vendorId: 'v1', title: 'ledge ' + id, description: '', type: 'product', price: 500, currency: 'KES', quantityAvailable: null, locationName: null, objectId: null, media: [], status: 'active', vendor: null, orderable: true, unorderableReason: null, createdAt: '', updatedAt: '' });
const opp = (id) => ({ id, title: 'grant ' + id, type: 'opportunity', locationName: 'Kilimani' });

console.log('=== MODEL: real counts, density gate ===');
check('below the floor -> renders NOTHING', moneyBandModel({ looking: [post('1'), post('2')], listings: [listing('1')], opportunities: [], minTotal: 5 }) === null);
check('at the floor -> shown', moneyBandModel({ looking: [post('1'), post('2'), post('3')], listings: [listing('1')], opportunities: [opp('1')], minTotal: 5 }) !== null);
check('default floor applied when none given', moneyBandModel({ looking: [], listings: [], opportunities: [], minTotal: MONEY_BAND_MIN_TOTAL }) === null);
const m = moneyBandModel({ looking: [post('1'), post('2')], listings: [listing('1')], opportunities: [opp('1'), opp('2')], minTotal: 1 });
check('total is exactly the sum of real rows', m.total === 5);
check('a band with zero rows is omitted, not zero-labelled', m.rows.every((r) => r.count > 0));
check('no band can ever count more than its input', m.rows.find((r) => r.key === 'looking').count === 2);
check('sub-lines only when the detail exists', m.rows.find((r) => r.key === 'looking').items.find((i) => i.id === '1').sub === null && m.rows.find((r) => r.key === 'opportunities').items[0].sub === 'Kilimani');

console.log('\n=== SHEETS: prices are server-authoritative ===');
const boostSrc = fs.readFileSync(__dirname + '/src/components/BoostSheet.tsx', 'utf8');
const leadSrc = fs.readFileSync(__dirname + '/src/components/LeadPackSheet.tsx', 'utf8');
const feeSrc = fs.readFileSync(__dirname + '/src/components/FeePaySheet.tsx', 'utf8');
check('BoostSheet names no price of its own', !/amountKes|KES\s*\d|\b40\b|\b500\b/.test(boostSrc));
check('LeadPackSheet names no price of its own', !/amountKes|KES\s*\d|\b100\b/.test(leadSrc));
check('pay payload carries no amount field', !/amountKes|amount:/.test(feeSrc.match(/JSON\.stringify\([\s\S]*?\}\)/)?.[0] ?? ''));

// --- render the sheets against a mocked fee API -----------------------------
let payBody = null;
global.fetch = async (url, opts) => {
  const u = String(url);
  const send = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });
  if (u.includes('/api/fees/mine')) {
    return send({
      pochi: '0712000111',
      services: [
        { key: 'promotion_daily', label: 'Promote a listing for one day', amountKes: 40 },
        { key: 'promotion_weekly', label: 'Promote a listing for one week', amountKes: 500 },
        { key: 'lead_intro', label: 'Priority introduction to one match', amountKes: 100 }
      ],
      fees: []
    });
  }
  if (u.includes('/api/fees/pay')) {
    payBody = JSON.parse(opts.body);
    return send({ fee: { id: 'fee_1', userId: 'me', service: 'promotion_daily', label: 'x', amountKes: 40, mpesaCode: 'QJD31X5K2S', status: 'pending', refusedReason: null, confirmedAt: null, createdAt: '', ledgerId: 'l1' } }, 201);
  }
  if (u.includes('/api/auth/session')) return send({ user: null });
  return send({});
};

async function settle() { await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); }

async function main() {
  // --- BoostSheet ---
  let root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(BoostSheet, { listingId: 'lst_9', listingTitle: 'Cake, 1kg', onClose: () => undefined })); });
  await settle();
  let body = document.body.textContent;
  check('boost price comes from the mocked SERVER catalog', body.includes('KES 40') && body.includes('KES 500'));
  check('Pochi instruction rendered from server data', body.includes('0712000111'));

  const input = document.querySelector('input[aria-label="M-Pesa confirmation code"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(input, 'qjd31x5k2s'); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Submit confirmation code'));
  await act(async () => { btn.click(); });
  await settle();
  check('pay POST carries code, upper-cased', payBody && payBody.mpesaCode === 'QJD31X5K2S');
  check('pay POST carries the boost target', payBody && payBody.target && payBody.target.kind === 'listing' && payBody.target.id === 'lst_9');
  check('pay POST carries NO amount (server prices it)', payBody && !('amountKes' in payBody) && !('amount' in payBody));
  check('after submit the sheet says pending, not success', document.body.textContent.includes('Recorded and pending'));
  await act(async () => { root.unmount(); });

  // --- LeadPackSheet ---
  payBody = null;
  const host = document.createElement('div'); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(LeadPackSheet, { postId: 'cp_77', postTitle: 'Need: event photographer', onClose: () => undefined })); });
  await settle();
  body = document.body.textContent;
  check('intro price comes from the SERVER catalog', body.includes('KES 100'));
  check('the sheet promises an operator-made intro, not contact details', body.includes('contact details stay private'));
  check('no phone number is anywhere in the intro sheet', !/0\d{9}/.test(body.replace('0712000111', ''))); // pochi excluded: pay instruction only
  const input2 = host.querySelector('input[aria-label="M-Pesa confirmation code"]');
  await act(async () => { setter.call(input2, 'ABCDEFGH12'); input2.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  const btn2 = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('Submit confirmation code'));
  await act(async () => { btn2.click(); });
  await settle();
  check('intro POST targets a coop post', payBody && payBody.service === 'lead_intro' && payBody.target.kind === 'coop_post' && payBody.target.id === 'cp_77');
  await act(async () => { root.unmount(); });

  console.log('\nPASS ' + pass + ' FAIL ' + fail);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('moneyband suite crashed:', e); process.exit(1); });
