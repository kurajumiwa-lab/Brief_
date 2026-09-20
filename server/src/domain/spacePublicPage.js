// ---------------------------------------------------------------------------
// SPACE PUBLIC PAGE — the mirror, not a canvas.
//
// A Space's public face is the thing an owner pastes into a WhatsApp status and
// is proud of. It is NOT a second place to edit, and it is not a website
// builder: there is no theme picker, no drag-and-drop, nothing to maintain. The
// owner edits the Space; this page re-derives itself from those rows on every
// request, which is the only reason it can stay true.
//
// Why it is rendered on the server at all: the sharing channel is WhatsApp
// status and the "view once" of a link preview. Link crawlers do not run
// JavaScript, so a page that lives only inside the React bundle produces an
// empty preview card. So the HTML for /s/:slug is produced here, in the same
// process, from the same projection the API serves. No second source of truth.
//
// THE CONTRACT, enforced by these functions rather than by discipline:
//
//   * NOTHING IS INVENTED. Every sentence is built from a row: an offer, a
//     broadcast, a profile answer, a follower count. If the owner has not said
//     it, the page does not say it. No "open now" unless their own hours answer
//     contains today's day and both ends of the clock; no photo unless the
//     upload row exists and is not private evidence.
//   * A CONTACT CHANNEL IS AN ACT, NOT A DEFAULT. Nothing here publishes a
//     number the owner did not choose to publish, and there is no fake
//     "hide the digits" switch — a WhatsApp link contains them.
//   * AN EMPTY SPACE GETS AN EMPTY PAGE. "This shop is being set up" — not a
//     placeholder catalogue, not a stock image, not a zero dressed as a number.
//     The page is what forces the owner back into the Space; a mask would break
//     that loop, so the mirror is literal.
//   * NO RATINGS, NO BADGE, NO VERIFIED TICK. Brief stores no completed-order
//     reviews, so there is nothing to average and nothing to award.
//   * DOWN IS DOWN. Flip the Space to private and the page answers 404 with
//     noindex — not a cached, not a "hidden but findable", not a stale copy.
//   * THE PAGE IS READ-ONLY. The single allowed write is an abuse report, which
//     stores a row and changes nothing else, and says so in one line.
//
// One documented assumption: opening-hours arithmetic is done in East Africa
// Time, because that is the clock the launch market lives on. The page states
// which clock it read the hours against, so the assumption is visible.
//
// And one deliberate refusal: the page is NOT "category-tinted". Every shop
// gets the same plaster and the same indigo light. Tinting by category would
// need a mapping from a space's type to a colour, and a colour that means
// nothing to a buyer is decoration — worse, it invites a tier ("gold pages are
// bigger shops"), which is a rank Brief does not have. One design, done well,
// is the whole point of a page with nothing to maintain.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { getRawSpace, publicSpaceView, publicOffers } from './space.js';
import { formatAnswer } from './spaceProfile.js';
import { getUpload } from './upload.js';

const DAY = 86400000;

/** East Africa Time: fixed +03:00, no DST, so the arithmetic needs no database. */
export const EAT_OFFSET_MS = 3 * 3600000;
export const CLOCK_LABEL = 'East Africa Time';
/** How many offers one page carries before it says how many more exist. */
export const PAGE_OFFER_LIMIT = 8;
/** How many of the owner's own updates the page shows. */
export const PAGE_UPDATE_LIMIT = 3;
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const money = (value, currency) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency || 'KES'} ${grouped}`;
};

/** "14 Sep" in the clock the page is written for — never a made-up timestamp. */
function shortDate(ms) {
  if (!Number.isFinite(ms)) return null;
  const at = new Date(ms + EAT_OFFSET_MS);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${at.getUTCDate()} ${months[at.getUTCMonth()]}`;
}

function todayParts(ms = Date.now()) {
  const at = new Date(ms + EAT_OFFSET_MS);
  return { day: DAY_NAMES[at.getUTCDay()], minutes: at.getUTCHours() * 60 + at.getUTCMinutes() };
}

const toMinutes = (hhmm) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * The only open/closed claim the page is allowed to make. It is a reading of
 * the owner's OWN schedule answer — the same row that drives their maintenance
 * clock — never an inference from how busy they look. Anything missing, and the
 * page says what was stated instead of guessing at what was not.
 */
export function openState(space, { nowMs = Date.now() } = {}) {
  const value = space?.profile?.fields?.availability?.value ?? null;
  const stated = formatAnswer('availability', value) ?? null;
  if (!value) {
    return { label: null, tone: 'empty', stated, reason: 'no hours stated' };
  }
  const days = Array.isArray(value.days) ? value.days : [];
  const from = toMinutes(value.from);
  const to = toMinutes(value.to);
  const today = todayParts(nowMs);
  const clock = from !== null && to !== null;
  if (!days.length || !clock) {
    return { label: null, tone: 'empty', stated, reason: days.length ? 'no opening and closing time' : 'no days picked' };
  }
  const onDay = days.includes(today.day);
  // A day that ends before it starts is treated as spanning midnight, because
  // that is what a night shop means by "18:00–02:00".
  const inside = to > from ? today.minutes >= from && today.minutes < to : today.minutes >= from || today.minutes < to;
  const label = onDay && inside ? 'Open now' : 'Closed now';
  const until = onDay && inside ? to : null;
  const untilText = until === null ? null : `${String(Math.floor(until / 60)).padStart(2, '0')}:${String(until % 60).padStart(2, '0')}`;
  return {
    label,
    tone: onDay && inside ? 'live' : 'quiet',
    stated,
    closesAt: untilText,
    reason: onDay ? (inside ? `until ${untilText}` : 'outside the stated hours') : `${today.day} is not in the stated days`
  };
}

/**
 * A cover only renders if the bytes exist and were not filed as private
 * evidence. An owner who pasted some other id in gets a plate, not a leak.
 */
export function publicImage(space) {
  const ref = space?.image ?? null;
  if (!ref) return null;
  const match = /^\/api\/media\/file\/([\w.-]+)$/.exec(String(ref));
  if (!match) return null;
  const row = getUpload(match[1]);
  if (!row) return null;
  const purpose = row.purpose ?? 'public';
  if (purpose !== 'public') return null;
  return String(ref);
}

/**
 * The contact channel, from the owner's own answer, or null. Publishing it is
 * the owner's explicit act, and the rule is stated plainly rather than half-
 * offered: an answer here puts the digits on a public page, because a wa.me link
 * IS its digits. No answer, no button, and the Brief inbox is the alternative.
 */
export function contactChannel(space) {
  const value = space?.profile?.fields?.contactChannel?.value ?? null;
  if (!value?.phone) return null;
  const digits = String(value.phone).replace(/\D/g, '');
  if (digits.length < 9) return null;
  return {
    platform: value.platform ?? 'whatsapp',
    // The message is theirs, so it prefills: a shared page that starts a
    // sentence is how a shop turns a looker into a conversation.
    href: `https://wa.me/${digits}${value.message ? `?text=${encodeURIComponent(String(value.message).slice(0, 200))}` : ''}`,
    display: `+${digits}`,
    digits
  };
}

/**
 * The page's payload. Built from the ordinary public projection plus the three
 * things only a full page needs: the whole offer list with its real stock
 * facts, the owner's own recent updates, and the contact channel.
 */
export function publicPageView(space, { origin = null, nowMs = Date.now() } = {}) {
  const base = publicSpaceView(space);
  const contact = contactChannel(space);
  const broadcasts = store
    .filter('spaceBroadcasts', (b) => b.spaceId === space.id && !b.deletedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, PAGE_UPDATE_LIMIT)
    .map((b) => ({ kind: b.kind, text: b.text, createdAt: b.createdAt, expiresAt: b.expiresAt }));
  const open = openState(space, { nowMs });
  const operating = space.profile?.fields ?? {};
  const facts = [
    // Which arm of the business this page is, in the owner's own words. Printed
    // only when they chose it: an unstated mode is not a fact to advertise, and
    // writing "Not stated" on a public page would be us editorialising about a
    // blank field. No count of offers or orders rides along either — the numbers
    // on this page are the ones below, each one read off a row.
    ...(base.mode && base.modeLabel ? [{ key: 'mode', label: 'Which part of the business', answer: base.modeLabel }] : []),
    { key: 'what', label: 'What they say they provide', answer: formatAnswer('what', operating.what?.value) },
    { key: 'capacity', label: 'How much they can carry', answer: formatAnswer('capacity', operating.capacity?.value) },
    { key: 'coverage', label: 'Areas they serve', answer: formatAnswer('coverage', operating.coverage?.value) },
    { key: 'constraints', label: 'What they cannot do', answer: formatAnswer('constraints', operating.constraints?.value) }
  ].filter((f) => f.answer);

  // The newest real word on the page. No row, no line — an absence is not a 0.
  const stamps = [space.updatedAt, space.createdAt, ...broadcasts.map((b) => b.createdAt)]
    .map((v) => Date.parse(v ?? ''))
    .filter(Number.isFinite);
  const newest = stamps.length ? Math.max(...stamps) : null;

  const offers = offersFor(space, { limit: PAGE_OFFER_LIMIT });
  return {
    ...base,
    image: publicImage(space),
    initials: initialsOf(space.name),
    open,
    contact,
    // The hours as data, for structured markup only. Never invented: an answer
    // with one end of the clock missing yields no schedule at all.
    openingHours: openingHoursSpec(space),
    offers,
    offerCount: base.activeOfferCount,
    moreOffers: Math.max(0, base.activeOfferCount - offers.length),
    updates: broadcasts,
    facts,
    followers: base.followers ?? 0,
    lastStamp: newest ? { at: new Date(newest).toISOString(), text: shortDate(newest) } : null,
    pageUrl: origin ? `${origin}/s/${encodeURIComponent(base.slug ?? space.slug ?? '')}` : null,
    // Stated once, on the page, because it is an assumption the reader is
    // entitled to check: whose clock the "Open now" was read against.
    clock: CLOCK_LABEL,
    since: space.createdAt ?? null,
    noindex: false
  };
}

/**
 * The offers on the page — the same set the directory card shows, from the same
 * function, so a page and a card cannot disagree about a price. See
 * space.publicOffers for why this is not "everything this vendor has".
 */
function offersFor(space, { limit = PAGE_OFFER_LIMIT } = {}) {
  return publicOffers(space, { limit }).map((l) => ({
    id: l.id,
    title: String(l.title ?? ''),
    blurb: l.description ? String(l.description).slice(0, 140) : null,
    price: l.price,
    priceLabel: Number(l.price) === 0 ? 'Free' : money(l.price, l.currency ?? 'KES'),
    unit: l.unitLabel ? String(l.unitLabel) : null,
    minimum: Number.isFinite(Number(l.minOrderQuantity)) && Number(l.minOrderQuantity) > 0 ? Number(l.minOrderQuantity) : null,
    // null means "not stock-tracked", which is NOT the same claim as 0 left.
    stock: Number.isInteger(l.quantityAvailable) ? Number(l.quantityAvailable) : null,
    featured: (space.featured ?? []).includes(l.id)
  }));
}

export function initialsOf(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/**
 * `openingHoursSpecification` for structured data, from the same schedule row
 * the page reads. If either end of the clock or the day list is missing, this
 * returns null and the field is left out of the markup — search engines are not
 * given a guess to index.
 */
export function openingHoursSpec(space) {
  const value = space?.profile?.fields?.availability?.value ?? null;
  if (!value) return null;
  const from = value.from;
  const to = value.to;
  const days = Array.isArray(value.days) ? value.days.filter((d) => DAY_NAMES.includes(d)) : [];
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(from ?? '')) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(to ?? '')) || !days.length) {
    return null;
  }
  const cap = (d) => d.charAt(0).toUpperCase() + d.slice(1);
  return days.map((d) => ({
    '@type': 'OpeningHoursSpecification',
    dayofWeek: cap(d),
    opens: from,
    closes: to
  }));
}

/**
 * Why a page is not there. Each kind gets its own sentence because each is a
 * different fact: a wrong link, a private shop, a closed shop. All three are
 * noindex, so a space that came down stops being offered by search engines.
 */
export function unavailableReason(slug) {
  const key = String(slug ?? '').trim();
  if (!key) return { status: 404, kind: 'unknown', heading: 'No page by that name.', line: 'Check the link, or find shops in the Brief directory.' };
  const space = store.find('spaces', (s) => s.slug === key || s.id === key);
  if (!space) return { status: 404, kind: 'unknown', heading: 'No page by that name.', line: 'Brief has nothing at this address — not a hidden shop, just nothing.' };
  if (space.status !== 'active') {
    return { status: 404, kind: 'archived', heading: `${space.name} has closed on Trace.`, line: 'The owner archived this space, so its page is down.' };
  }
  const visibility = space.visibility ?? 'private';
  if (visibility === 'public') {
    // Race or a caller asking about a public space by id — the full page is
    // served elsewhere; this is a defensive note, not a claim.
    return { status: 404, kind: 'unknown', heading: 'No page by that name.', line: 'Check the link, or find shops in the Brief directory.' };
  }
  return {
    status: 404,
    kind: visibility === 'unlisted' ? 'unlisted' : 'private',
    heading: 'This shop is private right now.',
    line:
      visibility === 'unlisted'
        ? 'It is reachable by its id inside Brief, but it has no public page.'
        : 'The owner can put a public page up at any time; until they do, there is nothing to show here.'
  };
}

// ---------------------------------------------------------------------------
// RENDERING — plain HTML, inline CSS, no framework, no font to wait for.
// This is the artifact a phone opens on a bad network from a WhatsApp chat, so
// it must render with the first byte and never need a second request.
// ---------------------------------------------------------------------------

const ROOM_CSS = `
:root{--bg:#F7F8FA;--card:#FFFFFF;--well:#EEF1F5;--ink:#0A0E14;--muted:#5A6472;--faint:#6B7684;--line:#DCE1E8;--accent:#2563EB;--live:#047857;--quiet:#B45309;--plaster:linear-gradient(rgba(37,99,235,0.07),rgba(37,99,235,0.07)),linear-gradient(158deg,#FBFCFE 0%,#EDF1F6 100%);--lift:0 6px 20px rgba(10,14,20,0.06),inset 0 1px 0 rgba(255,255,255,0.9)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%}
a{color:var(--accent)}
.wrap{max-width:640px;margin:0 auto;padding:16px 14px 44px}
.card{background:var(--card);border-radius:22px;overflow:hidden;box-shadow:var(--lift)}
.cover{position:relative;height:168px;background:var(--plaster)}
.cover img{width:100%;height:168px;object-fit:cover;display:block;filter:saturate(1.05) contrast(1.02)}
.id{padding:0 16px 18px;margin-top:-34px}
.avatar{width:64px;height:64px;border-radius:50%;background:var(--card);box-shadow:var(--lift);display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--accent);font-size:22px}
h1{font-size:26px;margin:10px 0 2px;line-height:1.2}
.tag{margin:0;color:var(--muted);font-size:15px}
.line{margin:4px 0 0;color:var(--faint);font-size:13px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;background:var(--well);color:var(--ink);margin-top:10px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--live);display:inline-block}
.dot--quiet{background:var(--quiet)}
.cta{display:block;text-align:center;text-decoration:none;background:var(--accent);color:#fff;font-weight:800;font-size:15px;padding:14px 16px;border-radius:999px;margin-top:14px;box-shadow:var(--lift)}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 10px}
section{padding:16px}
section+section{border-top:1px solid var(--line)}
.offer{background:var(--well);border-radius:16px;padding:12px 13px;margin-bottom:8px}
.offer:last-child{margin-bottom:0}
.offer .t{font-weight:700;font-size:15px;margin:0}
.offer .p{font-size:14px;margin:4px 0 0;font-variant-numeric:tabular-nums}
.offer .n{font-size:12px;color:var(--faint);margin:3px 0 0}
.pin{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
.post{background:var(--well);border-radius:16px;padding:12px 13px;margin-bottom:8px}
.post .k{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
.post .b{margin:4px 0 0;font-size:15px}
.fact{margin:0 0 10px}
.fact dt{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--faint)}
.fact dd{margin:2px 0 0;font-size:15px}
.empty{background:var(--well);border-radius:16px;padding:16px;text-align:center;color:var(--muted);font-size:14px}
.foot{margin-top:16px;text-align:center;font-size:12px;color:var(--faint)}
.foot a{font-size:12px}
form{margin-top:10px}
textarea{width:100%;min-height:56px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);font:inherit;padding:8px}
button{background:var(--well);color:var(--ink);border:0;border-radius:999px;padding:11px 16px;font-weight:800;font-size:14px}
`;

/** The visible page. `view` must come from publicPageView — nothing here adds a figure. */
export function renderPage(view) {
  const offers = view.offers.length
    ? view.offers
        .map(
          (o) => `      <div class="offer">
${o.featured ? '        <p class="pin">Pinned by the shop</p>\n' : ''}        <p class="t">${esc(o.title)}</p>
        <p class="p">${esc(o.priceLabel ?? 'Price not listed')}${o.unit ? ` / ${esc(o.unit)}` : ''}${o.minimum ? ` · min ${o.minimum}` : ''}</p>
${o.stock !== null ? `        <p class="n">${o.stock > 0 ? `${o.stock} in hand, by their own count` : 'Sold out for now, by their own count'}</p>\n` : ''}      </div>`
        )
        .join('\n')
    : `      <div class="empty">This shop is being set up — nothing on the counter yet.</div>`;

  const updates = view.updates.length
    ? `<section>
    <h2>Latest from the shop</h2>
${view.updates
  .map(
    (b) => `    <div class="post">
      <p class="k">${esc(b.kind)} · ${esc(shortDate(Date.parse(b.createdAt)) ?? '')}</p>
      <p class="b">${esc(b.text)}</p>
    </div>`
  )
  .join('\n')}
  </section>`
    : `<section>
    <h2>Latest from the shop</h2>
    <div class="empty">No updates posted. When they post one, it appears here for 24 hours.</div>
  </section>`;

  const facts = view.facts.length
    ? `<section>
    <h2>What they stated</h2>
    <dl>
${view.facts.map((f) => `      <div class="fact"><dt>${esc(f.label)}</dt><dd>${esc(f.answer)}</dd></div>`).join('\n')}
    </dl>
  </section>`
    : '';

  const contact = view.contact
    ? `<a class="cta" href="${esc(view.contact.href)}">Chat on WhatsApp</a>
      <p class="line">${esc(view.contact.display)}</p>`
    : `<p class="line">This shop has not added a contact number, so there is nothing to call. Inquiries through Brief reach their inbox.</p>`;

  const hours = view.open.label
    ? `<span class="pill"><span class="dot${view.open.tone === 'live' ? '' : ' dot--quiet'}"></span>${esc(view.open.label)}${view.open.closesAt ? ` until ${esc(view.open.closesAt)}` : ''}</span>`
    : view.open.stated
      ? `<span class="pill">Hours stated · not checked against today</span>`
      : '';

  return `<!doctype html>
<html lang="en-KE">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- brief:public-page -->
<title>${esc(view.name)} — on Trace</title>
<meta name="description" content="${esc(DESCRIPTION_LINE(view))}" />
<meta property="og:type" content="business.business" />
<meta property="og:site_name" content="Brief" />
<meta property="og:title" content="${esc(view.name)}" />
<meta property="og:description" content="${esc(DESCRIPTION_LINE(view))}" />
${view.pageUrl ? `<meta property="og:url" content="${esc(view.pageUrl)}" />\n<link rel="canonical" href="${esc(view.pageUrl)}" />` : ''}
${view.image ? `<meta property="og:image" content="${esc(view.image)}" />\n<meta name="twitter:card" content="summary_large_image" />` : `<meta name="twitter:card" content="summary" />`}
<meta name="theme-color" content="#F7F8FA" />
<meta name="robots" content="index,follow" />
${JSON_LD(view)}
</head>
<body>
<style>${ROOM_CSS}</style>
<main class="wrap">
  <article class="card">
    <div class="cover">${view.image ? `<img src="${esc(view.image)}" alt="" />` : ''}</div>
    <div class="id">
      <div class="avatar" aria-hidden="true">${esc(view.initials || '·')}</div>
      <h1>${esc(view.name)}</h1>
      <p class="tag">${esc(view.goal || humanType(view.type))}</p>
      <p class="line">${esc([view.where, view.when].filter(Boolean).join(' · ') || 'No place or hours stated yet')}</p>
      ${hours}
      ${contact}
      <p class="line">Hours read against ${esc(view.clock)}.</p>
      <p class="line">${view.offerCount} live offer${view.offerCount === 1 ? '' : 's'}${view.followers > 0 ? ` · ${view.followers} ${view.followers === 1 ? 'person follows' : 'people follow'} this page` : ''}${view.lastStamp ? ` · last written ${esc(view.lastStamp.text)}` : ''}</p>
    </div>
  </article>
  <article class="card" style="margin-top:14px">
    <section>
      <h2>On the counter</h2>
${offers}
${view.moreOffers > 0 ? `      <p class="line">Plus ${view.moreOffers} more offer${view.moreOffers === 1 ? '' : 's'} on their Brief counter.</p>` : ''}
    </section>
${updates}
${facts}
  </article>
  <p class="foot">This page is a mirror of the shop's Brief space — they edit it in the app, and it updates here. Prices and words only; their orders, customers and money stay with them.
    <br />${brandLine(view)} · <a href="#report">Report this page</a></p>
  <section class="card" id="report" style="margin-top:14px">
    <h2>Report this page</h2>
    <p class="line">Writes a report row that Brief and the owner can read. It does not take a page down, and no automatic review exists yet — say what is wrong and someone can act on it.</p>
    <form method="post" action="/s/${esc(view.slug)}/report">
      <textarea name="reason" maxlength="500" placeholder="What is wrong with this page?" aria-label="Reason"></textarea>
      <p style="margin:8px 0 0"><button type="submit">Send the report</button></p>
    </form>
  </section>
</main>
</body>
</html>
`;
}

/**
 * The footer credit. A link appears ONLY when the deployment declared its own
 * public origin; until then it is plain words. It used to point at
 * https://brief.app, a domain this project neither owns nor resolves — a
 * decorative link to nowhere is exactly the fabricated authority this product
 * refuses, and it was on the one page a stranger trusts.
 */
function brandLine(view) {
  const origin = String(view.pageUrl ?? '').replace(/\/s\/.*$/, '');
  return origin ? `<a href="${esc(origin)}">Made with Trace</a>` : 'Made with Trace';
}

function humanType(type) {
  return String(type ?? 'business').replace(/_/g, ' ');
}

/**
 * The preview card a WhatsApp link gets. Assembled from the same rows as the
 * page, so a preview cannot promise what the page does not show.
 */
function DESCRIPTION_LINE(view) {
  const parts = [];
  if (view.open.label) parts.push(view.open.label);
  if (view.where) parts.push(view.where);
  parts.push(view.offerCount ? `${view.offerCount} live offer${view.offerCount === 1 ? '' : 's'}` : 'Setting up — nothing listed yet');
  return parts.join(' · ').slice(0, 180);
}

/**
 * LocalBusiness markup from real fields only. No aggregateRating (no reviews
 * exist), no priceRange (nobody stated one), and no openingHoursSpecification
 * unless the owner stated both ends of the clock and at least one day.
 */
function JSON_LD(view) {
  const offers = (view.offers ?? []).map((o) => ({
    '@type': 'Offer',
    name: o.title,
    price: o.price,
    priceCurrency: 'KES',
    // `InStock` is a claim about stock. An offer the owner does not
    // stock-track gets NO availability field — the absence is the true answer,
    // and search engines read a missing value as unspecified rather than as 0.
    ...(o.stock === null ? {} : { availability: o.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' })
  }));
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: view.name,
    description: DESCRIPTION_LINE(view),
    ...(view.image ? { image: view.image } : {}),
    ...(view.pageUrl ? { url: view.pageUrl } : {}),
    // No `foundingDate`. The space's createdAt is when this record started on
    // Brief, not when the shop was founded, and a crawler would publish the
    // difference as a fact about the business. Better silent than wrong.
    ...(view.where ? { address: { '@type': 'PostalAddress', addressLocality: view.where, addressCountry: 'KE' } } : {}),
    ...(view.contact ? { telephone: view.contact.display } : {}),
    ...(view.openingHours ? { openingHoursSpecification: view.openingHours } : {}),
    ...(offers.length
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'On the counter',
            itemListElement: offers.map((o) => ({ '@type': 'ItemList', item: [o] }))
          }
        }
      : {})
  };
  // `</script>` inside a JSON string would CLOSE the script tag and run as
  // markup, so every `<` is written as an escape. JSON.parse resolves it back,
  // a parser never sees a tag.
  const json = JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<script type="application/ld+json">${json}</script>`;
}

/** A one-line receipt for a write the page is allowed to make. No page content. */
export function renderNote({ heading, line }) {
  return `<!doctype html>
<html lang="en-KE">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(heading)}</title>
<meta name="robots" content="noindex,nofollow" />
<style>${ROOM_CSS}</style>
</head>
<body>
<main class="wrap">
  <article class="card"><section>
    <h1 style="margin-top:0">${esc(heading)}</h1>
    <p class="tag">${esc(line)}</p>
  </section></article>
</main>
</body>
</html>
`;
}

export function renderUnavailable(info, { origin = null } = {}) {
  return `<!doctype html>
<html lang="en-KE">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- brief:public-page -->
<title>Not on Trace</title>
<meta name="robots" content="noindex,nofollow" />
<meta property="og:title" content="${esc(info.heading)}" />
<meta property="og:description" content="${esc(info.line)}" />
<style>${ROOM_CSS}</style>
</head>
<body>
<main class="wrap">
  <article class="card">
    <section>
      <h1 style="margin-top:0">${esc(info.heading)}</h1>
      <p class="tag">${esc(info.line)}</p>
      ${origin ? `<p class="line"><a href="${esc(origin)}/#spaces">Find shops in the Brief directory</a></p>` : ''}
    </section>
  </article>
  <p class="foot">Brief does not keep a copy of a page an owner has taken down.</p>
</main>
</body>
</html>
`;
}

/**
 * The index of live public pages. Only exists when the deployment states its
 * own public origin, because an absolute URL is what a sitemap must contain —
 * guessing one from a Host header would publish somebody else's hostname.
 */
export function publicSlugs(limit = 200) {
  return store
    .filter('spaces', (s) => s.visibility === 'public' && s.status === 'active' && (s.slug ?? null))
    .slice(0, limit)
    .map((s) => ({ slug: s.slug, updatedAt: s.updatedAt ?? s.createdAt ?? null }));
}

export function sitemapXml(origin, rows = publicSlugs()) {
  const base = String(origin ?? '').replace(/\/+$/, '');
  const body = rows
    .map((r) => {
      const stamp = Date.parse(r.updatedAt ?? '');
      return `  <url><loc>${esc(`${base}/s/${r.slug}`)}</loc>${Number.isFinite(stamp) ? `<lastmod>${new Date(stamp).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/**
 * An abuse report: a row, nothing else. The page's visibility does not change,
 * because Brief has no automated takedown review and a claim of one would be a
 * promise the code cannot keep.
 */
export function reportSpace(slug, { reason, reporterId = null, referrer = null } = {}) {
  const space = store.find('spaces', (s) => (s.slug ?? null) === String(slug ?? '').trim() || s.id === slug);
  if (!space) return { error: 'no space at that address', status: 404 };
  const text = String(reason ?? '').trim().slice(0, 500);
  if (text.length < 4) return { error: 'say what is wrong in a few words', status: 400 };
  // One open report per signed-in person per space. Without this, whoever wants
  // a guardian's reward frozen just taps the form three times, and the
  // attribution flag threshold (see attribution.js) is a button, not a signal.
  if (reporterId) {
    const already = store.find('spaceAbuseReports', (r) =>
      r.spaceId === space.id && r.reporterId === reporterId && !r.handledAt);
    if (already) {
      return { reported: true, reused: true, id: already.id,
        note: 'You already have an open report on this page, so it was not filed twice.' };
    }
  }
  const row = store.insert('spaceAbuseReports', {
    id: `abr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    spaceId: space.id,
    slug: space.slug ?? null,
    reason: text,
    reporterId: reporterId ?? null,
    referrer: referrer ? String(referrer).slice(0, 200) : null,
    createdAt: new Date().toISOString(),
    handledAt: null,
    // Deliberately no severity, no category taxonomy, no "resolved" wording:
    // nobody is triaging these yet, and a field nobody fills is a lie with a
    // schema.
    outcome: null
  });
  return { reported: true, id: row.id, note: 'Recorded. It does not take the page down — Brief has no automated review, and no one has promised one.' };
}

/** What an owner sees about reports on their own space. A count of real rows. */
export function reportsForSpace(spaceId) {
  const rows = store.filter('spaceAbuseReports', (r) => r.spaceId === spaceId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return {
    count: rows.length,
    latest: rows[0] ? { reason: rows[0].reason, at: rows[0].createdAt, handled: Boolean(rows[0].handledAt) } : null,
    note: rows.length
      ? `${rows.length} report${rows.length === 1 ? '' : 's'} filed. Brief has not reviewed them, so nothing has changed about your page.`
      : 'No reports have been filed against this space.'
  };
}

/** Convenience for a route that only has an id. */
export function pageViewById(spaceId, opts) {
  const space = getRawSpace(spaceId);
  if (!space || space.visibility !== 'public' || space.status !== 'active') return null;
  return publicPageView(space, opts);
}

export { DAY as DAY_MS, esc as escapeHtml };
