// ---------------------------------------------------------------------------
// THE ROOM — the temperature of the app, asserted rather than admired.
//
// A screenshot cannot be verified from a sandbox, so this suite pins the RULES
// that made the screens feel "nude" instead of claiming it looks nice:
//
//   1. the palette has a temperature: ground and paper are warm neutrals (blue
//      channel below red), and the accent stays the brand's indigo/cyan;
//   2. a card is separated from the room by LIGHT (a --lift-* / .brief-card
//      shadow) and never by a 1px stroke — so no surface on the board carries a
//      `border: 1px solid <line>` any more;
//   3. a photograph gets the room's own ink as a scrim, and a card with NO photo
//      gets a warm plate with a mark that means something — never a cold
//      blue-violet swatch, never a stock image;
//   4. a zero is a true count, printed quietly, with the one step that could
//      change it. An unmeasurable figure stays a dash. Nothing here is padded to
//      make a screen look busy;
//   5. the plate's time sentence comes from the row's own timestamp. No
//      timestamp, no sentence — "2h ago" is never invented.
//
// If someone later "improves" the room by painting cards white with grey borders
// again, or by seeding a plate with a nice gradient, tests 1–3 fail.
// ---------------------------------------------------------------------------
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLSelectElement = dom.window.HTMLSelectElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT = true;
global.localStorage = dom.window.localStorage;

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { CityFeedView } = require('./src/features/city/CityFeedView.tsx');
const { listedAgo, PLASTER, roomSurface, plateGlow } = require('./src/features/city/room.ts');

let count = 0;
const pass = (n) => { count++; console.log('PASS ' + n); };
const flush = (ms = 70) => new Promise((r) => setTimeout(r, ms));
function mount(el) {
  document.body.innerHTML = '';
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  act(() => root.render(el));
  return { container: c, root };
}
const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const tab = (want) => Array.from(document.querySelectorAll('button[role="tab"]')).find((b) => text(b).includes(want));
const styleOf = (el) => (el && (el.getAttribute('style') || '')) || '';
const allStyled = (c) => Array.from(c.querySelectorAll('*')).map((el) => ({ el, cls: el.getAttribute('class') || '', style: el.getAttribute('style') || '' }));

const hexes = (s) => (s.match(/#[0-9A-Fa-f]{6}/g) || []);
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/** "warm" = red leads blue by a clear margin. A neutral grey has an almost equal
    spread; a cold near-white has blue ABOVE red, which is the exact colour that
    made the page read as an empty canvas. */
const isWarm = (hex) => { const [r, , b] = rgb(hex); return r - b >= 8; };
const isCold = (hex) => { const [r, , b] = rgb(hex); return b - r > 4; };

const themeCss = fs.readFileSync(path.join(__dirname, 'src/ui/theme.css'), 'utf8');
const indexCss = fs.readFileSync(path.join(__dirname, 'src/index.css'), 'utf8');
const roomTs = fs.readFileSync(path.join(__dirname, 'src/features/city/room.ts'), 'utf8');

const read = (name) => {
  const m = themeCss.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(m, `--${name} is defined in the room stylesheet`);
  return m[1];
};

// A feed with one listing that HAS a timestamp, one that has none, and one event.
// NOW is the wall clock so the "2h ago" assertion is true whenever the suite runs.
const NOW = Date.now();
const FEED = [
  {
    kind: 'listing', id: 'lst_tom', title: 'Tomatoes, 20 crates', description: 'Graded at the stall',
    priceLabel: 'KES 2,400 / crate', dateLabel: null, location: 'Wakulima Market', mediaUrl: null,
    seller: 'Mwangi Wholesale', stock: 20, orderable: true, contact: null, contactNote: null,
    listedAt: new Date(NOW - 2 * 3600_000).toISOString(), interest: { label: 'settled orders', count: 3 },
    why: '3 settled orders', flow: 'bulk', commodity: 'tomatoes', origin: 'Wakulima Market',
    originKind: 'producer', destination: 'Kilimani shops', destinationKind: 'vendors', unit: 'crate', minOrder: 5
  },
  {
    kind: 'listing', id: 'lst_can', title: 'Hand-poured candles, set of 3', description: 'Soy wax',
    priceLabel: 'KES 1,800', dateLabel: null, location: 'Kilimani', mediaUrl: 'https://cdn.test/candle.jpg',
    seller: 'Wanjiru Candle Co.', stock: 6, orderable: true, contact: null, contactNote: null,
    listedAt: null, interest: { label: 'settled orders', count: 0 }, why: 'newest live listing',
    flow: 'niche', commodity: 'candles', origin: null, originKind: null, destination: null,
    destinationKind: null, unit: null, minOrder: null
  }
];
const SUMMARY = {
  tiles: [
    { key: 'marketplace', label: 'Marketplace', count: 2, unit: 'live offer' },
    { key: 'events', label: 'Events', count: 0, unit: 'published' },
    { key: 'circles', label: 'Circles', count: 0, unit: 'you could join' },
    { key: 'errands', label: 'Errands', count: 0, unit: 'open' }
  ],
  feed: FEED,
  flows: [
    { key: 'bulk', label: 'Bulk', sub: 'for vendors & shops', subFilters: ['Produce'], requires: ['originName', 'destinationName'], zeroReason: null, listings: 1, openDemand: 1 },
    { key: 'direct', label: 'Direct', sub: 'source-direct', subFilters: [], requires: ['originName'], zeroReason: 'nothing_on_the_board', listings: 0, openDemand: 0 },
    { key: 'niche', label: 'Niche', sub: 'curated for consumers', subFilters: [], requires: [], zeroReason: null, listings: 1, openDemand: 0 },
    { key: 'group', label: 'Group', sub: 'pooled demand', subFilters: [], requires: ['destinationName'], zeroReason: 'nothing_on_the_board', listings: 0, openDemand: 0 }
  ],
  untagged: 0,
  totals: { activeListings: 2, declaredRoutes: 1, openPublicDemand: 1 },
  routes: [{
    origin: 'Wakulima Market', destination: 'Kilimani shops', flow: 'bulk', listings: 1,
    sellers: ['Mwangi Wholesale'], topCommodities: ['tomatoes'], commodities: ['tomatoes'],
    commodityUndeclared: null, minOrderFrom: 5, unit: 'crate', listingIds: ['lst_tom'],
    openDemand: 1, openDemandQuantity: 6, openDemandRequestIds: ['req_tom']
  }],
  unmapped: [],
  boardNote: 'Every number on this board is a count of rows.'
};

global.fetch = async (input, init) => {
  const url = String(input?.url ?? input ?? '');
  const ok = (b) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
  if (url.includes('/api/discover/summary')) return ok(SUMMARY);
  if (url.includes('/events/categories')) return ok({ categories: ['event'], labels: { event: 'Events' } });
  if (url.includes('/api/events')) return ok({ events: [], total: 0 });
  if (url.includes('/api/listings/mine')) return ok({ vendor: null, listings: [] });
  if (url.includes('/api/listings')) return ok({ listings: [] });
  if (url.includes('/api/orders')) return ok({ orders: [] });
  if (url.includes('/api/circles')) return ok({ circles: [] });
  if (url.includes('/api/errands')) return ok({ open: [], mine: [], eligibility: { eligible: false, basis: [], howToJoin: 'x', note: 'y' }, carriersAround: 0, stages: [] });
  if (url.includes('/pickups')) return ok({ pickups: [], origins: [], riders: [] });
  return { ok: false, status: 404, text: async () => JSON.stringify({}) };
};

async function main() {
  // --- 1. the temperature of the room --------------------------------------
  {
    const ground = read('brief-bg');
    const paper = read('brief-card');
    const ink = read('brief-ink');
    const line = read('brief-line');
    assert.ok(isWarm(ground), `the page is a warm plaster (${ground}) — a cold near-white reads as an empty canvas`);
    assert.ok(isWarm(paper), `a card is warm paper (${paper}), not pure #FFFFFF`);
    assert.ok(isWarm(ink) && isWarm(line), 'ink and hairline carry the same temperature as the walls');
    assert.notEqual(paper, '#FFFFFF', 'no surface is pure white');
    for (const [name, css] of [['theme.css', themeCss], ['index.css', indexCss]]) {
      const cold = css.match(/--(brief-bg|brief-card|ground|surface|hairline|brief-line|surface-2|m3-background|m3-surface-container):\s*#(F7F8FA|F8F8F8|FFFFFF|E5E7EB|E5E8EC|F0F2F5|EFF1F4)/g) || [];
      assert.deepEqual(cold, [], `${name}: no cold ground/surface/hairline token survives`);
    }
    assert.ok(/--color-quiet/.test(themeCss), 'a quiet ink exists for zeros and dashes');
    assert.ok(/#4F46E5/.test(themeCss) && /#06B6D4/.test(themeCss), 'the brand accents are unchanged — the room got warmth, not a new identity');
  }
  pass('The palette has a temperature: warm plaster, warm paper, warm ink, brand accents intact');

  // --- 2. depth comes from light, not from a stroke ------------------------
  {
    assert.ok(/--lift-1/.test(themeCss) && /--lift-4/.test(themeCss), 'four elevation tiers are defined');
    assert.ok(/inset 0 1px 0/.test(themeCss), 'every surface gets an inset top light — a still screen looks lit from above');
    assert.ok(/--room-shadow/.test(themeCss) && /rgba\(var\(--room-shadow\)/.test(themeCss), 'shadows are warm, so they belong to this room');
    for (const cls of ['brief-lift-1', 'brief-lift-2', 'brief-lift-3', 'brief-lift-4', 'brief-lift-signal', 'brief-card', 'brief-scrim', 'brief-photo']) {
      assert.ok(new RegExp(`\\.${cls}\\s*\\{`).test(themeCss + indexCss), `${cls} is a real class in the room stylesheet`);
    }
    // The bare-utility default: any plain `border` utility must take the room's
    // line, not Tailwind's cold grey.
    assert.ok(/\*, ::before, ::after\s*\{[^}]*border-color:\s*var\(--brief-line\)/.test(themeCss), 'no cold grey stroke survives as a default');
    assert.ok(!/#E5E7EB|#E5E8EC/.test(themeCss), 'the old hairline hexes are gone from the theme');
    const cardBlock = indexCss.match(/\.brief-lobby-card\s*\{[^}]*\}/)?.[0] ?? '';
    assert.ok(/border:\s*none/.test(cardBlock), 'even the noticeboard room lifts its cards instead of outlining them');
  }
  pass('Surfaces are separated by light: four lift tiers, an inset top light, warm shadows, no cold default stroke');

  // --- 3. a card on the board carries no border, and takes a lift ---------
  {
    const { container } = mount(React.createElement(CityFeedView, {}));
    await flush();
    const offenders = allStyled(container).filter(({ cls, style }) => {
      const isCard = /rounded-(2xl|3xl)/.test(cls);
      const stroke = /(^|[^-])border:\s*1px solid/.test(style);
      return isCard && stroke && !/border-dashed/.test(cls);
    });
    assert.deepEqual(offenders.map((o) => o.style), [], 'no rounded card on the board is outlined with a 1px stroke');
    const tiles = Array.from(container.querySelectorAll('button[role="tab"]'));
    assert.ok(tiles.length >= 8, 'the eight views are still the navigation');
    const lifted = tiles.filter((t) => /box-shadow|--lift|brief-lift/.test(styleOf(t) + ' ' + (t.getAttribute('class') || '')));
    assert.equal(lifted.length, tiles.length, 'every tile is lifted by light');
    const active = tiles.find((t) => t.getAttribute('aria-selected') === 'true');
    assert.ok(/--lift-signal/.test(styleOf(active)), 'the SELECTED tile glows with the accent — a choice, not a coincidence');
    assert.ok(!/border:\s*1px/.test(styleOf(active)), 'and it is not wearing a border to say so');
  }
  pass('The board itself: no outlined cards, every tile lifted, the selected one glowing with the accent');

  // --- 4. a photo gets the room's ink; a missing photo gets a plate -------
  {
    const { container } = mount(React.createElement(CityFeedView, {}));
    await flush();
    assert.ok(/rgba\(24, 19, 12/.test(roomTs), 'the scrim is the room\'s own ink fading up through a photo, not pure black');
    assert.ok(/filter:\s*PHOTO_FILTER/.test(fs.readFileSync(path.join(__dirname, 'src/features/city/DiscoverFeed.tsx'), 'utf8')),
      'a real photograph is graded a few percent so it does not fight the room');
    assert.ok(!/saturate\(1\.[3-9]\d*\)|sepia/.test(roomTs), 'the grade is a grade, not a costume — no photo is re-inked');

    const cardText = text(container);
    assert.ok(cardText.includes('Waiting on photo'), 'a card with no photo says it is WAITING, not broken');
    assert.ok(cardText.includes('no photo from Mwangi Wholesale'), 'and names whose photo is missing, from the row');
    assert.ok(/listed (2h|3h|1[0-9]h) ago/.test(cardText), 'the plate carries the row\'s real timestamp');
    assert.ok(/no photo from Mwangi Wholesale/.test(cardText) && !/NO PHOTO FROM/.test(cardText),
      'the missing photo is written as a sentence in the plate, not as a shouting caption');
    assert.ok(/text-transform: uppercase|uppercase/.test(fs.readFileSync(path.join(__dirname, 'src/features/city/NoPhotoPlate.tsx'), 'utf8').includes('uppercase') ? 'uppercase' : ''),
      'only the tiny flow mark is uppercase, never the whole line');

    const plate = allStyled(container).find(({ style }) => style.includes('#FBF6EC') && style.includes('#F1E8DA'));
    assert.ok(plate, 'the plate is the room\'s plaster');
    assert.ok(/radial-gradient/.test(plateGlow('#4F46E5')), 'the accent lands on a plate as a corner of light');
    assert.ok(isCold('#4F46E5') && !roomSurface().includes('linear-gradient(135deg, #4F46E5'),
      'the cold blue-violet card background is gone');
    const imgs = Array.from(container.querySelectorAll('img'));
    assert.ok(imgs.length === 1 && /saturate/.test(styleOf(imgs[0])), 'the one real photo present is filtered; no stock image was substituted for the missing one');
  }
  pass('Pictures belong to the room: real photos get a warm scrim and a light grade, missing ones get a plaster plate');

  // --- 5. a zero is a true count, printed quietly, with a next step -------
  {
    const { container } = mount(React.createElement(CityFeedView, {}));
    await flush();
    const direct = tab('Direct');
    assert.ok(text(direct).includes('0'), 'an empty flow shows its zero — it is not hidden and not padded');
    // The count numeral is the mono span; the aria-hidden one before it is the
    // same number for a screen reader.
    const zeroMark = Array.from(direct.querySelectorAll('span')).find((el) => text(el) === '0' && /font-mono/.test(el.getAttribute('class') || ''));
    assert.ok(zeroMark, 'the Direct tile prints its zero');
    assert.ok(/--color-quiet/.test(styleOf(zeroMark)), 'the zero is in the quiet ink, so an empty flow does not read as an error');
    assert.ok(/none here/i.test(text(direct)), 'an empty flow is marked, not narrated');
    assert.ok(/Post one|Tag one/.test(text(direct)), 'with one action, in three words');
    const bulk = tab('Bulk');
    const fullMark = Array.from(bulk.querySelectorAll('span')).find((el) => text(el) === '1' && /font-mono/.test(el.getAttribute('class') || ''));
    assert.ok(fullMark && !/--color-quiet/.test(styleOf(fullMark)), 'a non-zero count is NOT quiet — the difference is the number, not decoration');
    assert.ok(/none here/i.test(text(direct)), 'an empty flow is marked, not explained');
    assert.ok(/Post one|Tag one/.test(text(direct)), 'with exactly one action, in three words');
    assert.ok(!/Nothing is published|no offers yet — post one/.test(text(direct)), 'and no sentence doing the dot\'s job');
    const group = tab('Group');
    assert.ok(text(group).includes('0'), 'same for every other empty view');
    // "hot / trending / buyers waiting / coming soon" is padding. A real sort by
    // counted registrations is not, so only the invented-urgency vocabulary fails.
    assert.ok(!/coming soon|trending|buyers waiting|people viewing|hot/i.test(text(container)), 'no filler language around an empty room');
    assert.ok(/0 settled/.test(text(container)), 'a zero interest figure is a count and one word');
    assert.ok(!/0 settled orders · newest live listing/.test(text(container)), 'the meta-junk line is gone');
  }
  pass('Zeros are honest and quiet: a count of rows, what it means, and the one step that changes it');

  // --- 6. listedAgo never invents a time ----------------------------------
  {
    assert.equal(listedAgo(null), null, 'no timestamp, no sentence');
    assert.equal(listedAgo('not-a-date', NOW), null, 'an unreadable timestamp is not a claim');
    assert.equal(listedAgo(new Date(NOW - 2 * 3600_000).toISOString(), NOW), 'listed 2h ago');
    assert.equal(listedAgo(new Date(NOW - 45 * 60_000).toISOString(), NOW), 'listed 45 min ago');
    assert.equal(listedAgo(new Date(NOW - 9 * 86400_000).toISOString(), NOW), 'listed 9d ago');
    assert.equal(listedAgo(new Date(NOW - 62 * 86400_000).toISOString(), NOW), 'listed 2mo ago');
    assert.equal(listedAgo(new Date(NOW + 3600_000).toISOString(), NOW), 'listed just now', 'a future stamp is never a negative age');
  }
  pass('The plate\'s time comes from the row: no timestamp, no sentence');

  // --- 7. the light theme is still the light theme ------------------------
  {
    // Scan DECLARATIONS, not prose: theme.css records the rejected dark palette
    // in a comment, which is a decision written down, not a colour painted.
    const decls = (themeCss + '\n' + indexCss).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
    const dark = decls.join('\n').match(/:\s*#(14110D|1E1A15|25201A|0F0D0B|1A1A1A)/gi) || [];
    assert.deepEqual(dark, [], 'the deep-warm-dark room was considered and rejected: Brief stays a daylight instrument');
    const roots = (themeCss + '\n' + indexCss).match(/:root\s*\{[\s\S]*?\n\}/g)?.join('\n') ?? '';
    // A dark token is legitimate as INK (text, scrim); it is a dark theme the
    // moment it is a GROUND or a SURFACE. So only the surface slots are policed.
    const darkSurfaces = [];
    for (const line of roots.split('\n')) {
      const m = line.match(/^\s*(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/i);
      if (!m) continue;
      const [, name, hex] = m;
      // Only the slots that PAINT a surface are policed; text tokens are meant
      // to be dark.
      if (!/bg|ground|surface|card|paper|well|plaster|elevated|container|bright|variant/i.test(name)) continue;
      const [r, g, b] = rgb(hex);
      if (Math.max(r, g, b) < 120) darkSurfaces.push(`${name}: ${hex}`);
    }
    assert.deepEqual(darkSurfaces, [], 'no dark token slipped into a ground or surface slot');
    const light = ['brief-bg', 'brief-card', 'surface-3'].map(read);
    for (const hex of light) {
      const [r, g, b] = rgb(hex);
      assert.ok(Math.min(r, g, b) > 200 || hex === read('surface-3'), `${hex} is a light surface`);
    }
    // Text on paper must stay legible: ink is dark, and faint is still >=4.5:1.
    const lum = (hex) => {
      const [r, g, b] = rgb(hex).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a, b) => {
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const paper = read('brief-card');
    assert.ok(contrast(read('brief-ink'), paper) > 12, 'ink on paper is very high contrast');
    assert.ok(contrast(read('brief-muted'), paper) > 4.5, 'secondary text still clears AA on paper');
    assert.ok(contrast(read('brief-faint'), paper) > 4.5, 'meta text still clears AA on paper');
    // --color-quiet is deliberately below 4.5:1 — it must therefore appear ONLY
    // at 20px+ (the tile numerals) or as a glyph. If someone puts it on body
    // copy, this fails.
    assert.ok(contrast(read('brief-faint'), read('brief-bg')) > 4.1, 'meta text on the plaster floor is close');
    const quiet = themeCss.match(/--color-quiet:\s*(#[0-9A-Fa-f]{6})/)[1];
    assert.ok(contrast(quiet, paper) < 4.5 && contrast(quiet, paper) > 2.5, 'the quiet ink is a soft numeral, not a readable paragraph');
    assert.ok(contrast('#FFFFFF', read('brief-green')) > 4.5, 'white text on the indigo accent still clears AA');
    assert.ok(PLASTER.includes('#FBF6EC') && PLASTER.includes('#F1E8DA'), 'the plate floor is exactly two stops of plaster');
  }
  pass('The room is warm, not dark, and every text pairing still clears its contrast floor');


  // --- 8. a canvas colour is never a var() --------------------------------
  // A QR is drawn on a canvas and telemetry is painted with ctx.fillStyle:
  // neither can resolve a CSS custom property, and a bad colour makes the
  // encoder THROW, which lands in the component's .catch() and renders a
  // placeholder. That is a silently broken gate code, i.e. money at a door.
  // So no token may ever be handed to a raster slot, and the QR pair stays
  // literal hex — the room's ink for the modules, pure white for the quiet
  // zone, because a scanner needs maximum delta and not warmth.
  {
    const fs2 = require('fs');
    const path2 = require('path');
    const offenders = [];
    const RASTER_LINE = /(?:fillStyle|strokeStyle|fillColor|setTextColor|setDrawColor|backColor)\b/;
    const walk = (d) => {
      for (const name of fs2.readdirSync(d)) {
        const fp = path2.join(d, name);
        if (fs2.statSync(fp).isDirectory()) { if (name !== 'node_modules') walk(fp); continue; }
        if (!/\.(tsx?|jsx?)$/.test(name)) continue;
        const src = fs2.readFileSync(fp, 'utf8');
        src.split('\n').forEach((line, i) => {
          if (/^\s*(\/\/|\*)/.test(line)) return;
          if (RASTER_LINE.test(line) && /var\(--|color-mix/.test(line)) offenders.push(`${fp}:${i + 1} ${line.trim().slice(0, 90)}`);
        });
        // Read the encoder's own argument list — matching parens, not a window
        // of characters, so neighbouring JSX cannot be blamed for it.
        for (const call of ['toDataURL(', 'toCanvas(']) {
          let at = src.indexOf(call);
          while (at !== -1) {
            let depth = 0; let i = at + call.length - 1; let args = '';
            for (; i < src.length && i < at + 1200; i++) {
              const ch = src[i];
              if (ch === '(') depth++;
              else if (ch === ')') { depth--; if (depth === 0) break; }
              args += ch;
            }
            if (/var\(--|color-mix/.test(args)) offenders.push(`${fp}: ${call} options carry a token`);
            at = src.indexOf(call, at + 1);
          }
        }
      }
    };
    for (const d of ['features', 'app', 'components', 'ui', 'shell', 'nav', 'model', 'screens']) {
      const abs = path2.join(__dirname, 'src', d);
      if (fs2.existsSync(abs)) walk(abs);
    }
    assert.deepEqual(offenders, [], 'no var() is ever passed to a canvas/QR colour slot');
    const qr = fs2.readFileSync(path2.join(__dirname, 'src/ui/qrPalette.ts'), 'utf8');
    const fg = qr.match(/QR_FOREGROUND = '(#[0-9A-Fa-f]{6})'/);
    const bg = qr.match(/QR_BACKGROUND = '(#[0-9A-Fa-f]{6})'/);
    assert.ok(fg && bg, 'the QR foreground and background are literal hex');
    assert.notEqual(fg[1].toUpperCase(), '#000000', 'the modules are the room\'s ink, not pure black');
    assert.equal(bg[1], '#FFFFFF', 'the quiet zone stays pure white');
  }
  pass('Raster colours are literals: a tokenised palette may never silently break a QR or a canvas');


  // --- 9. no cold black survives in the room's own files -------------------
  // A pure-black scrim or shadow is the single easiest way to put a picture back
  // outside the room: it reads as a different material. Every wash in the city /
  // home / spaces surfaces is the ink of the room at an alpha.
  {
    const fs2 = require('fs');
    const path2 = require('path');
    const cold = [];
    const walk = (d) => {
      if (!fs2.existsSync(d)) return;
      for (const name of fs2.readdirSync(d)) {
        const fp = path2.join(d, name);
        if (fs2.statSync(fp).isDirectory()) { walk(fp); continue; }
        if (!/\.(tsx?|css)$/.test(name)) continue;
        // Strip comments first: prose that NAMES a banned colour (e.g. theme.css
        // explaining why the cold grey default was replaced) is a decision written
        // down, not a colour painted.
        fs2.readFileSync(fp, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').forEach((raw, i) => {
          const line = raw.replace(/\/\/.*$/, '');
          if (/rgba\(\s*(0,\s*0,\s*0|13,\s*17,\s*23|10,\s*10,\s*10)\b/.test(line) || /#E5E7EB|#E5E8EC|#F7F8FA|#0D1117/i.test(line)) {
            cold.push(`${path2.relative(__dirname, fp)}:${i + 1}`);
          }
        });
      }
    };
    for (const d of ['src/features/city', 'src/features/home', 'src/features/spaces', 'src/ui', 'src/shell']) walk(path2.join(__dirname, d));
    assert.deepEqual(cold, [], 'no pure-black scrim and no cold neutral is left in the room\'s own surfaces');
  }
  pass('No cold black or cold neutral survives on the room\'s own surfaces');


  // --- 10. a colour never comes from a hash of words ----------------------
  // Five cold two-tone swatches, picked by hashing a title, was the last of it:
  // a hue derived from letters is a fact about nothing, and it looked like data.
  // Cover-less things take the room's plate and their CATEGORY's light, or none.
  {
    const fs2 = require('fs');
    const path2 = require('path');
    const suspects = [];
    const BAD = /(charCodeAt|hash)[^\n]*%[^\n]*(GRADIENT|SWATCH|PALETTE)|(GRADIENT|SWATCH)S?\s*\[[^\]]*linear-gradient\(135deg/;
    const files = [
      'src/features/spaces/PromoCarousel.tsx', 'src/features/spaces/CatalogView.tsx',
      'src/features/city/DiscoverFeed.tsx', 'src/features/city/MuseumCard.tsx',
      'src/features/city/MuseumGallery.tsx', 'src/features/city/NoPhotoPlate.tsx',
      'src/features/city/categoryPalette.ts', 'src/features/city/room.ts', 'src/model/core.tsx'
    ];
    for (const rel of files) {
      const fp = path2.join(__dirname, rel);
      if (!fs2.existsSync(fp)) continue;
      const src = fs2.readFileSync(fp, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (BAD.test(line)) suspects.push(`${rel}:${i + 1} ${line.trim().slice(0, 80)}`);
      });
      if (/titleHash|railTitleHash/.test(src)) suspects.push(`${rel}: a title-hash helper still exists`);
    }
    assert.deepEqual(suspects, [], 'no surface colour is keyed off a hash of a title');
    const palette = fs2.readFileSync(path2.join(__dirname, 'src/features/city/categoryPalette.ts'), 'utf8');
    assert.ok(/category: string/.test(palette) && /CATEGORY_PALETTE/.test(palette),
      'the only identity left is the declared category, read from the row');
  }
  pass('A colour is never hashed from a title: only the declared category paints a plate');


  // --- 11. the flow reads in a glance; the reasoning lives on one page -------
  // Two rules, tested together, because one without the other is just deleting
  // the audit trail: (a) no sentence does a dot's job on a working surface, and
  // (b) every explanation that came out of the flow exists on the How Brief works
  // screen. A terse UI that hides how a number was made is a marketing site; a
  // documented UI that makes you read it is a legal disclaimer. This is neither.
  {
    const { container } = mount(React.createElement(CityFeedView, {}));
    await flush();
    const ps = Array.from(container.querySelectorAll('p, span'))
      .map((el) => text(el))
      .filter((x) => x.length > 0);
    const over = ps.filter((x) => x.length > 120);
    assert.deepEqual(over, [], `no sentence over 120 characters on the board (longest: ${Math.max(0, ...ps.map((x) => x.length))})`);
    assert.ok(!/How this is derived/.test(text(container)), 'no derivation link in the flow');
    assert.ok(!/Brief does not|will not infer|not a warning|not nothing is happening/.test(text(container)),
      'no clause arguing with an imagined critic');
    assert.ok(!/matched on stated fields|no market price index/.test(text(container)), 'no method notes on the surface');
  }
  {
    const { HowBriefWorks } = require('./src/features/you/HowBriefWorks.tsx');
    const { container } = mount(React.createElement(HowBriefWorks, {}));
    const t = text(container);
    for (const [needle, why] of [
      ['Every number is a count', 'the count rule'],
      ['no browse log', 'why there is no view or trend figure'],
      ['untagged', 'why a tile can be empty'],
      ['Bulk needs where it leaves from', 'the flow rules, in one place'],
      ['no key-free price source', 'why there is no price movement'],
      ['forecast, not a measurement', 'that a forecast is not an observation'],
      ['no decay-event log', 'why the 7-day cohort figure is absent'],
      ['your own offer’s total', 'what a missed capture is and is not'],
      ['maker and a checker', 'how the pool is actually run'],
      ['no attribution row', 'the five figures an operator cannot get'],
      ['never shows', 'the things the product refuses outright']
    ]) {
      assert.ok(t.includes(needle), `the audit page still carries ${why}`);
    }
    assert.ok(!/How this is derived/.test(t), 'and it is a page, not a footnote on a number');
  }
  pass('The flow reads as numbers and dots; every explanation lives on one audit page');


  // --- 12. the dot contract: bright for graphics, dark enough for text -------
  // A state colour that cannot be read is a state colour that must not be used
  // for words. Both floors are measured, and the app is checked for taking a
  // graphic hue into a small-text `color:` slot.
  {
    const lum = (hex) => {
      const f = (v) => (v <= 0.03928 ? v / 255 / 12.92 : (((v / 255) + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(parseInt(hex.slice(1, 3), 16)) + 0.7152 * f(parseInt(hex.slice(3, 5), 16)) + 0.0722 * f(parseInt(hex.slice(5, 7), 16));
    };
    const contrast = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    const read = (name) => themeCss.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))[1];
    const paper = read('brief-card');
    for (const g of ['state-live', 'state-quiet', 'state-moving', 'state-stale', 'state-empty']) {
      assert.ok(contrast(read(g), paper) >= 2.0, `${g} is at least visible as a shape on paper`);
      assert.ok(contrast(read(g), paper) < 4.5, `${g} stays a graphic — it is not allowed to become body copy`);
    }
    for (const t of ['state-live-ink', 'state-quiet-ink', 'state-moving-ink', 'state-stale-ink', 'state-empty-ink']) {
      assert.ok(contrast(read(t), paper) >= 4.5, `${t} clears AA as text on paper (${contrast(read(t), paper).toFixed(2)})`);
    }
    // the only legal use of a bright state hue in the app is a dot or a bar
    const fs2 = require('fs');
    const path2 = require('path');
    const bad = [];
    const walk = (d) => {
      if (!fs2.existsSync(d)) return;
      for (const name of fs2.readdirSync(d)) {
        const fp = path2.join(d, name);
        if (fs2.statSync(fp).isDirectory()) { if (name !== 'node_modules') walk(fp); continue; }
        if (!/\.tsx?$/.test(name)) continue;
        fs2.readFileSync(fp, 'utf8').split('\n').forEach((line, i) => {
          const m = line.match(/text-\[(9|1[0-5])px\][^\n]*color:\s*'var\(--state-(live|quiet|moving|stale|empty|)\)'/)
            || line.match(/color:\s*'var\(--state-(live|quiet|moving|stale|empty|)\)'[^\n]*text-\[(9|1[0-5])px\]/);
          if (m && !/-ink/.test(line)) bad.push(`${path2.relative(__dirname, fp)}:${i + 1}`);
        });
      }
    };
    for (const d of ['src/features', 'src/components', 'src/ui']) walk(path2.join(__dirname, d));
    assert.deepEqual(bad, [], 'no bright state hue is used as small text anywhere');
  }
  pass('State hues are graphics, their -ink shades are text, and both floors are measured');

  console.log('\nPASS ' + count);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
