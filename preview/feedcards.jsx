const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'https://brief.test/',
  pretendToBeVisual: true
});
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
const { FeedComposer } = require('./src/components/FeedComposer.tsx');

// ---------------------------------------------------------------------------
// FEED CARD RENDERING SUITE
//
// Every card must communicate WHAT / WHERE / WHEN / WHY / SOURCE using only
// the safe public feed fields. This suite renders the real FeedComposer
// against a mocked feed and asserts each of the eight content types carries
// those signals.
// ---------------------------------------------------------------------------

const now = new Date();
const iso = (offsetMs) => new Date(now.getTime() + offsetMs).toISOString();
// Calendar-relative, never wall-clock-relative: 'tomorrow 09:00' is always
// labelled Tomorrow, at any hour the suite runs. An offset like now+29h
// flips to a weekday name when run late in the evening -- a flake the
// calendar form cannot produce.
const tomorrow9am = (() => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString(); })();
const day = (offsetDays) => new Date(now.getTime() + offsetDays * 86400000).toISOString().slice(0, 10);

const feed = {
  hero: [],
  discovery: [
    {
      id: 'c_news', type: 'news', title: 'Breaking: city water restored',
      summary: 'Supply returned this morning.',
      createdAt: iso(-2 * 3600000),
      locationName: 'CBD, Nairobi',
      media: null, metadata: {},
      temporal: { status: 'current', startsAt: null, endsAt: null, deadlineAt: null, expiresAt: null },
      sourceNames: ['City Wire'], sourceCount: 1
    },
    {
      id: 'c_alert', type: 'alert', title: 'Power cut in Kilimani',
      summary: 'Crews on site.',
      createdAt: iso(-3600000),
      locationName: 'Kilimani',
      media: null, metadata: { area: 'Kilimani' },
      temporal: { status: 'current', startsAt: null, endsAt: null, deadlineAt: null, expiresAt: null },
      sourceNames: ['Neighbourhood Telegram'], sourceCount: 1
    },
    {
      id: 'c_offer', type: 'offer', title: 'Coffee shop 2-for-1 this week',
      summary: 'At the junction branch.',
      createdAt: iso(-5 * 3600000),
      locationName: 'Yaya Centre',
      media: null, metadata: { area: 'Kilimani' },
      temporal: { status: 'active', startsAt: null, endsAt: null, deadlineAt: iso(2 * 86400000), expiresAt: null },
      sourceNames: ['Shop Telegram'], sourceCount: 2
    },
    {
      id: 'c_business', type: 'business', title: 'Kawangware hardware store now open Sundays',
      summary: 'New hours.',
      createdAt: iso(-3 * 86400000),
      locationName: 'Kawangware',
      media: null, metadata: { area: 'Kawangware' },
      temporal: { status: 'current', startsAt: null, endsAt: null, deadlineAt: null, expiresAt: null },
      sourceNames: ['Business Channel'], sourceCount: 1
    },
    {
      id: 'c_announcement', type: 'announcement', title: 'Estate AGM on Friday',
      summary: 'All residents invited.',
      createdAt: iso(-4 * 3600000),
      locationName: 'South B',
      media: null, metadata: { area: 'South B', dateCanonical: day(2) },
      temporal: { status: 'current', startsAt: null, endsAt: null, deadlineAt: null, expiresAt: null, dayOfWeek: 'friday' },
      sourceNames: ['Estate Telegram'], sourceCount: 1
    },
    {
      id: 'c_place', type: 'place', title: 'City Market produce section',
      summary: 'Open daily 4AM-6PM.',
      createdAt: iso(-20 * 86400000),
      locationName: 'CBD, Nairobi',
      media: null, metadata: { area: 'CBD' },
      temporal: { status: 'current', startsAt: null, endsAt: null, deadlineAt: null, expiresAt: null },
      sourceNames: ['City Guide'], sourceCount: 1
    }
  ],
  opportunities: [
    {
      id: 'c_opportunity', type: 'opportunity', title: 'Green Commerce Grant applications open',
      summary: 'KES 500k for sustainable retail.',
      createdAt: iso(-2 * 3600000),
      locationName: 'Nairobi',
      media: null, metadata: { deadlineCanonical: day(5) },
      temporal: { status: 'active', startsAt: null, endsAt: null, deadlineAt: iso(5 * 86400000), expiresAt: null },
      sourceNames: ['Grants RSS'], sourceCount: 1
    }
  ],
  more: [
    {
      id: 'c_event', type: 'experience', title: 'Rooftop Saturday creators meetup',
      summary: 'Bring your portfolio.',
      createdAt: iso(-2 * 3600000),
      locationName: 'Kilimani Studio',
      media: null, metadata: { area: 'Kilimani', eventStart: tomorrow9am },
      temporal: { status: 'upcoming', startsAt: tomorrow9am, endsAt: null, deadlineAt: null, expiresAt: null },
      sourceNames: ['Creator Hub', 'City Wire'], sourceCount: 2
    }
  ],
  tea: null,
  moreTea: [],
  counts: { objects: 8, tea: 0, deduped: 0 }
};

let requestNo = 0;
let lastFeedUrl = null;
global.fetch = async (url) => {
  requestNo += 1;
  const send = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
  const u = String(url);
  if (u.includes('/api/feed')) {
    lastFeedUrl = u;
    return send({ feed, meta: { apiVersion: '1', generatedAt: new Date().toISOString(), location: null, limit: 50 }, mediaProvider: { configured: false } });
  }
  if (u.includes('/api/collections')) return send({ collections: [] });
  if (u.includes('/api/banners')) return send({ banners: [] });
  return send({});
};

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

async function main() {
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(FeedComposer, { onOpen: () => undefined, onOpenTea: () => undefined })); });
  await settle();
  const text = () => (document.body.textContent || '').replace(/\s+/g, ' ').trim();
  let pass = 0;
  let fail = 0;
  const check = (name, condition, detail = '') => {
    if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
    else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
  };
  const body = text();

  console.log('=== Feed cards: WHAT / WHERE / WHEN / WHY / SOURCE ===');

  // WHAT — the title of every card type.
  check('news card renders its title', body.includes('Breaking: city water restored'));
  check('alert card renders its title', body.includes('Power cut in Kilimani'));
  check('offer card renders its title', body.includes('Coffee shop 2-for-1 this week'));
  check('business card renders its title', body.includes('Kawangware hardware store now open Sundays'));
  check('announcement card renders its title', body.includes('Estate AGM on Friday'));
  check('opportunity card renders its title', body.includes('Green Commerce Grant applications open'));
  check('place card renders its title', body.includes('City Market produce section'));
  check('event card renders its title', body.includes('Rooftop Saturday creators meetup'));

  // WHAT — the type label chip.
  check('alert is labelled as an Alert', body.includes('Alert'));
  check('offer is labelled as an Offer', body.includes('Offer'));
  check('event is labelled as an Event', body.includes('Event'));

  // WHERE — location names and extracted areas.
  check('cards show WHERE (locationName)', body.includes('Yaya Centre') && body.includes('Kilimani Studio'));
  check('cards show WHERE (area fallback)', body.includes('Kawangware'));

  // WHEN — temporal chips from the safe temporal projection.
  check('upcoming event shows WHEN (Tomorrow)', body.includes('Tomorrow'));
  check('ending offer shows WHEN (Ends)', /Ends \w+/.test(body));
  check('news shows a fresh age readout', /(h ago|Just now)/.test(body));

  // WHY — urgency signals.
  check('alert carries the WHY chip', body.includes('Power cut in Kilimani') && /Alert/.test(body));
  check('ending-soon offer carries Ending soon', body.includes('Ending soon'));

  // SOURCE — visible provenance.
  check('cards show SOURCE (single source)', body.includes('City Wire'));
  check('cards show SOURCE (multi-source count)', body.includes('+1'));

  // Sections still compose as before.
  check('the Nearby section renders', body.includes('Nearby'));
  check('the Offers section renders', body.includes('Offers'));
  check('the Upcoming section renders', body.includes('Upcoming'));
  // Every card in this fixture has no real photo — the type glyph IS the
  // visual. Assert the fallback actually renders icons, never a grey box.
  check('no-image cards render a type glyph (svg)', document.querySelectorAll('svg').length >= 8);

  console.log('\n=== Category scoping: server-side type + contextual emptiness ===');

  // A category-scoped feed must be requested from the server with type=...
  await act(async () => {
    root.render(React.createElement(FeedComposer, {
      onOpen: () => undefined, onOpenTea: () => undefined, type: 'news', onFeedStatus: () => undefined
    }));
  });
  await settle();
  check('a category tab requests the typed feed from the server', lastFeedUrl && lastFeedUrl.includes('type=news'), lastFeedUrl || 'no feed request');
  const headings = [...document.querySelectorAll('h2')].map((h) => (h.textContent || '').trim());
  check('a typed feed renders one category grid', headings.includes('News'));

  // A category+area with no data renders an honest, scoped empty state.
  const emptyFeed = {
    hero: [], discovery: [], opportunities: [], more: [], tea: null, moreTea: [],
    counts: { objects: 0, tea: 0, deduped: 0 }
  };
  await act(async () => {
    root.render(React.createElement(FeedComposer, {
      onOpen: () => undefined, onOpenTea: () => undefined,
      type: 'news', area: 'Westlands', feed: emptyFeed
    }));
  });
  await settle();
  const emptyBody = text();
  check('an empty category names the category and the place', emptyBody.includes('No news in Westlands yet'), emptyBody.slice(0, 200));
  check('an empty category suggests another location', emptyBody.includes('Try another location'));

  // A broken photo must fall back to the type glyph instead of a dead image.
  const brokenFeed = {
    hero: [], discovery: [{
      id: 'b_news', type: 'news', title: 'Story with a broken photo',
      summary: 'The image host is unreachable.',
      createdAt: iso(-3600000), locationName: 'CBD',
      media: { url: 'https://cdn.example/dead.jpg' }, metadata: {},
      temporal: { status: 'current', startsAt: null, endsAt: null, deadlineAt: null, expiresAt: null },
      sourceNames: ['City Wire'], sourceCount: 1
    }], opportunities: [], more: [], tea: null, moreTea: [],
    counts: { objects: 1, tea: 0, deduped: 0 }
  };
  await act(async () => {
    root.render(React.createElement(FeedComposer, {
      onOpen: () => undefined, onOpenTea: () => undefined, feed: brokenFeed
    }));
  });
  await settle();
  const img = document.querySelector('img[src="https://cdn.example/dead.jpg"]');
  check('a broken photo card starts with its image element', Boolean(img));
  if (img) {
    await act(async () => {
      img.dispatchEvent(new window.Event('error'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  const afterError = text();
  check('a failed photo falls back to the type glyph', !document.querySelector('img[src="https://cdn.example/dead.jpg"]') && document.querySelectorAll('svg').length >= 1);
  check('the title survives the image failure', afterError.includes('Story with a broken photo'));

  console.log(`\nPASSED ${pass}   FAILED ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
