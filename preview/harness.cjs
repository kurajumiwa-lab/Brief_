// ---------------------------------------------------------------------------
// SHARED DOM HARNESS
//
// Brief no longer ships seed objects -- the stream is populated from
// /api/objects. Suites that need a populated app therefore have to SERVE
// their fixtures rather than rely on a product constant.
//
// This module does that in one place:
//
//   * converts client-shaped fixtures into server-shaped rows (the inverse of
//     objectFromServer, including relationship verbs), so the suites exercise
//     the real load path instead of bypassing it;
//   * boots JSDOM, installs the fetch mock, mounts <App/>, and returns the
//     usual query/click helpers.
//
// Fixtures live in fixtures.cjs and are owned by the tests, never shipped.
// ---------------------------------------------------------------------------

/**
 * Client fixture -> server row.
 *
 * objectFromServer() reads verificationStatus, provenance[] and
 * relationships[]; the fixtures use isVerified/sourceType and typed id
 * fields. Converting here keeps the assertions written against the shape
 * authors already know while still going through the real adapter.
 */
function toServerRow(o) {
  const relationships = [];
  if (o.locationObjectId) relationships.push({ verb: 'located_at', targetId: o.locationObjectId, target: null });
  if (o.parentObjectId) relationships.push({ verb: 'part_of', targetId: o.parentObjectId, target: null });
  if (o.providerObjectId) relationships.push({ verb: 'provided_by', targetId: o.providerObjectId, target: null });
  for (const id of o.relatedObjectIds ?? []) {
    relationships.push({ verb: 'related_to', targetId: id, target: null });
  }

  const provenance = (o.sourceType || o.sourceId || o.sourceUrl)
    ? [{
        sourceId: o.sourceId ?? null,
        platform: o.sourceType ?? null,
        sourceUrl: o.sourceUrl ?? null,
        userHasAccess: true
      }]
    : [];

  return {
    id: o.id,
    type: o.type,
    title: o.title,
    category: o.category ?? null,
    summary: o.summary ?? '',
    locationName: o.locationName ?? null,
    verificationStatus: o.isVerified ? 'verified' : 'unverified',
    lastVerifiedAt: o.lastVerifiedAt ?? null,
    validityWindowDays: o.validityWindowDays ?? null,
    publication: o.publication ?? 'public',
    metadata: o.metadata ?? null,
    createdAt: o.createdAt ?? '2026-01-01T00:00:00Z',
    provenance,
    relationships,
    sourceCount: provenance.length,

    // Presentational fields the server does not model. objectFromServer
    // ignores them; they ride along so fixture-driven suites can still assert
    // on labels and imagery that the client sets from its own catalogue.
    imageUrl: o.imageUrl,
    actionLabel: o.actionLabel,
    actionType: o.actionType,
    creatorName: o.creatorName,
    trustScore: o.trustScore
  };
}

/**
 * Boot a full <App/> with the given fixtures served over fetch.
 *
 * @param {object}   opts
 * @param {any[]}    opts.objects   client-shaped fixture objects
 * @param {any[]}    opts.sources
 * @param {any[]}    opts.campaigns
 * @param {any[]}    opts.circles
 * @param {any[]}    opts.rawItems
 * @param {object}   opts.routes    extra url-substring -> body overrides
 */
async function boot(opts = {}) {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    { url: 'https://brief.test/', pretendToBeVisual: true });

  global.window = dom.window;
  // Node >=21 ships a getter-only `navigator` global, so a plain
  // `global.navigator = ...` silently fails and the app would keep seeing
  // Node's navigator (no clipboard). Define it properly so the jsdom
  // navigator — including clipboard mocks installed by suites — is what
  // client code actually reads.
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    writable: true,
    configurable: true
  });
  global.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.Node = dom.window.Node;
  global.MouseEvent = dom.window.MouseEvent;
  global.getComputedStyle = dom.window.getComputedStyle;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.open = () => null;

  const objects = (opts.objects ?? []).map(toServerRow);
  const routes = opts.routes ?? {};

  const reply = (body) => ({
    ok: true, status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body
  });

  global.fetch = async (url) => {
    const u = String(url);
    for (const [frag, body] of Object.entries(routes)) {
      if (u.includes(frag)) return reply(typeof body === 'function' ? body(u) : body);
    }
    if (u.includes('/api/objects')) return reply({ objects });
    if (u.includes('/api/raw-items')) return reply({ rawItems: opts.rawItems ?? [] });
    if (u.includes('/api/sources')) return reply({ sources: opts.sources ?? [] });
    if (u.includes('/api/campaigns')) return reply({ campaigns: opts.campaigns ?? [] });
    if (u.includes('/api/circles')) return reply({ circles: opts.circles ?? [] });
    if (u.includes('/api/config')) return reply({ publicOrigin: null });
    return { ok: false, status: 404, text: async () => '{}', json: async () => ({}) };
  };
  dom.window.fetch = global.fetch;

  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = require('react-dom/test-utils');
  const App = require('./src/App.tsx').default;

  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(App)); });
  // Let the object/source/campaign loads settle before anything is asserted.
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const body = () => text(document.body);
  const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 10)); }); };
  const click = async (el) => {
    if (!el) throw new Error('click() called with no element -- the target was not found');
    await act(async () => {
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  };
  const buttons = () => Array.from(document.querySelectorAll('button'));
  const btn = (t) => buttons().find((b) => text(b) === t || text(b).startsWith(t));
  const allBtns = (t) => buttons().filter((b) => text(b).includes(t));
  const goto = async (dest, section) => {
    const d = btn(dest);
    if (d) await click(d);
    if (section) {
      const s = btn(section);
      if (s) await click(s);
    }
    await settle();
  };

  return { dom, document, act, text, body, click, btn, allBtns, buttons, goto, settle };
}

module.exports = { boot, toServerRow };
