// ---------------------------------------------------------------------------
// SPACE PUBLIC PAGE — the mirror, tested for the things a mirror must not do.
//
// The public page is the asset owners will paste into WhatsApp, so the whole
// risk is that it says something the Space does not. These tests pin that:
//
//   * "Open now" is a reading of the owner's own stated hours, on an injected
//     clock — no hours, no claim; a summary sentence, no claim;
//   * a cover renders only when the upload row exists AND is not private
//     evidence;
//   * a phone number is not printed unless the owner ticked the box, and a
//     stranger never gets the digits in the page source;
//   * follower counts and offer counts are row counts: a zero count renders as
//     an empty state, never as a padded figure, and "no updates" says so;
//   * an empty space yields an EMPTY page ("This shop is being set up"), not a
//     placeholder catalogue or a stock photo;
//   * private / unlisted / archived spaces answer 404 with noindex — the page
//     comes down the moment the owner flips visibility, with no stale copy;
//   * the one write a stranger gets (an abuse report) stores a row and changes
//     nothing else, and its copy promises no review and no takedown;
//   * a name containing markup is escaped, in the body and in the preview tags;
//   * LocalBusiness JSON-LD carries no aggregateRating and no priceRange,
//     because Brief has no reviews and nobody stated a price range;
//   * and the sitemap refuses to publish absolute URLs when the deployment has
//     not declared its own origin — guessing a hostname is not honest.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-publicpage-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const spaces = await import("../src/domain/space.js");
const page = await import("../src/domain/spacePublicPage.js");
const prof = await import("../src/domain/spaceProfile.js");
const audience = await import("../src/domain/spaceAudience.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const owner = auth.createUser({ handle: "pp_owner", password: "a good passphrase" });
const fan = auth.createUser({ handle: "pp_fan", password: "a good passphrase" });
const token = auth.issueSession(owner.id).token;

// A fixed "now": Friday 18 September 2026, 10:00 in East Africa Time
// (Date.UTC(2026,8,18) really is a Friday — the day matters for the claim).
const FRI_10AM_EAT = Date.UTC(2026, 8, 18, 7, 0, 0);

function makeSpace(overrides = {}) {
  return spaces.createSpace({
    ownerId: owner.id,
    name: overrides.name ?? "Jj Cakes",
    type: "business",
    goal: "Birthday cakes in Narok",
    visibility: "public",
    ...overrides.space
  });
}

const setProfile = (id, fields) => spaces.updateSpace(id, { profile: fields }, { callerId: owner.id });

// ---------------------------------------------------------------------------
await test("open now is read from the owner's own hours, never inferred", () => {
  const sp = makeSpace();
  setProfile(sp.id, { availability: { days: ["fri"], from: "08:00", to: "18:00" } });
  const open = page.openState(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT });
  assert.equal(open.label, "Open now");
  assert.equal(open.closesAt, "18:00", "it names the closing time it read");

  const atEleven = page.openState(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT + 4 * 3600000 });
  assert.equal(atEleven.label, "Open now", "11:00 is inside 08:00-18:00");
  const atSeven = page.openState(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT - 3 * 3600000 });
  assert.equal(atSeven.label, "Closed now", "07:00 is before it opens");
  assert.match(atSeven.reason, /outside the stated hours/);
});

await test("a day list without a clock, or a summary alone, yields NO claim", () => {
  const sp = makeSpace();
  setProfile(sp.id, { availability: { days: ["mon", "tue", "wed", "thu", "fri"] } });
  let view = page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT });
  assert.equal(view.open.label, null, "days without hours cannot prove open-ness");
  assert.equal(view.openingHours, null, "and nothing goes into the structured data");

  setProfile(sp.id, { availability: { summary: "we open when we open" } });
  view = page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT });
  assert.equal(view.open.label, null, "a free-text summary is not a clock");
  assert.equal(view.open.stated, "we open when we open", "it is still shown as their words");

  const html = page.renderPage(view);
  assert.ok(!/Open now|Closed now/i.test(html), "the page says neither");
});

await test("a night shop's crossing-midnight hours are understood", () => {
  const sp = makeSpace();
  setProfile(sp.id, { availability: { days: ["fri"], from: "20:00", to: "02:00" } });
  const atTen = page.openState(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT });
  assert.equal(atTen.label, "Closed now", "10:00 is daytime");
  const atElevenPm = page.openState(store.find("spaces", (s) => s.id === sp.id), { nowMs: Date.UTC(2026, 8, 18, 20, 30) });
  assert.equal(atElevenPm.label, "Open now", "23:30 EAT is inside 20:00-02:00");
});

await test("an empty space yields an empty page, not a fake storefront", () => {
  const sp = makeSpace({ name: "Empty Shop" });
  const view = page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT });
  assert.equal(view.offers.length, 0);
  assert.equal(view.offerCount, 0);
  const html = page.renderPage(view);
  assert.match(html, /This shop is being set up/);
  assert.match(html, /No updates posted/);
  // No invented anything on a bare page.
  for (const banned of ["★", "rating", "reviews", "verified", "Popular", "trending", "Recommended", "customers served", "in the last", "people are viewing"]) {
    assert.ok(!html.toLowerCase().includes(banned.toLowerCase()), `the page must not contain "${banned}"`);
  }
});

await test("a cover only renders when the upload exists and is public", () => {
  const sp = makeSpace();
  store.insert("uploads", { id: "upl_public", ownerId: owner.id, purpose: "public", mimeType: "image/jpeg", sha256: "x" });
  store.insert("uploads", { id: "upl_private", ownerId: owner.id, purpose: "private_evidence", mimeType: "image/jpeg", sha256: "y" });

  spaces.updateSpace(sp.id, { image: "/api/media/file/upl_public" }, { callerId: owner.id });
  assert.equal(page.publicImage(store.find("spaces", (s) => s.id === sp.id)), "/api/media/file/upl_public");

  spaces.updateSpace(sp.id, { image: "/api/media/file/upl_private" }, { callerId: owner.id });
  assert.equal(page.publicImage(store.find("spaces", (s) => s.id === sp.id)), null, "private evidence is never a storefront cover");

  spaces.updateSpace(sp.id, { image: "/api/media/file/nope" }, { callerId: owner.id });
  assert.equal(page.publicImage(store.find("spaces", (s) => s.id === sp.id)), null, "a reference to nothing renders nothing");

  spaces.updateSpace(sp.id, { image: "https://evil.example/x.png" }, { callerId: owner.id });
  assert.equal(page.publicImage(store.find("spaces", (s) => s.id === sp.id)), null, "a foreign URL is not a Brief image");
});

await test("a contact channel is an act: no answer, no button, no number", () => {
  const sp = makeSpace({ name: "Contact Shop" });
  let view = page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT });
  assert.equal(view.contact, null, "nothing is invented to fill the button");
  let html = page.renderPage(view);
  assert.match(html, /has not added a contact number/);
  assert.ok(!/wa\.me/.test(html), "no dead link, no link to a number nobody gave");

  setProfile(sp.id, { contactChannel: { platform: "whatsapp", phone: "+254 700 111 222", message: "Hi, is a 2kg cake free today?" } });
  view = page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT });
  assert.equal(view.contact.digits, "254700111222", "normalised, so the link is derivable and not guessed");
  html = page.renderPage(view);
  assert.match(html, /href="https:\/\/wa\.me\/254700111222\?text=Hi%2C%20is%20a%202kg%20cake%20free%20today%3F"/, "the owner's own sentence prefills");
  assert.match(html, /Chat on WhatsApp/);
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(ld.telephone, "+254700111222", "the number they published is the number indexed");
});

await test("an unsupported platform is refused rather than linked anyway", () => {
  const sp = makeSpace();
  let threw = null;
  try {
    spaces.updateSpace(sp.id, { profile: { contactChannel: { platform: "telegram", phone: "+254700111222" } } }, { callerId: owner.id });
  } catch (err) { threw = String(err.message ?? err); }
  assert.match(threw ?? "", /only link a WhatsApp number/, "no invented Telegram deep link");
});

await test("a follower count is a count of rows, and zero is not shown as a stat", () => {
  const sp = makeSpace();
  let html = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT }));
  assert.ok(!/0 people follow/.test(html), "a zero follower count is silence, not a figure");
  audience.followSpace(sp.id, fan.id);
  html = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT }));
  assert.match(html, /1 person follows this page/, "one row reads as one, singular");
});

await test("a name carrying markup is escaped in the body and in the preview", () => {
  const sp = makeSpace({ name: "Evil <script>alert(1)</script>" });
  const view = page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT });
  const html = page.renderPage(view);
  assert.ok(!html.includes("<script>alert(1)</script>"), "no script survives into the page");
  assert.ok(!html.includes("<script>alert(1)"), "not even inside an attribute");
  assert.match(html, /&lt;script&gt;/, "it renders as words");
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.ok(ld.name.includes("<script>"), "the data keeps the literal text, quoted");
});

await test("structured data never claims a rating, a review or a price range", () => {
  const sp = makeSpace();
  setProfile(sp.id, { availability: { days: ["fri"], from: "08:00", to: "18:00" } });
  const draft = spaces.createSpaceOffer(sp.id, { title: "Cake", price: 4500, currency: "KES", type: "product" });
  // A draft is not on the counter. Only a published offer reaches a buyer.
  let preHtml = page.renderPage(page.publicPageView(store.find("spaces", (x) => x.id === sp.id), { nowMs: FRI_10AM_EAT }));
  assert.match(preHtml, /This shop is being set up/, "a draft stays invisible to the public page");
  spaces.publishSpaceOffer(sp.id, draft.id, { callerId: owner.id });
  const html = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT }));
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(ld.aggregateRating, undefined, "Brief stores no reviews, so nothing to average");
  assert.equal(ld.review, undefined);
  assert.equal(ld.priceRange, undefined, "nobody stated one");
  assert.ok(ld.hasOfferCatalog.itemListElement[0].item[0].price > 0, "the price it does state is the listing's");
  assert.equal(ld.hasOfferCatalog.itemListElement[0].item[0].availability, undefined,
    "an offer nobody stock-tracks is not claimed in stock");
  assert.equal(ld.foundingDate, undefined, "the row's createdAt is not the shop's birthday");
});

await test("a stock figure is the owner's number; no number is not zero", () => {
  const sp = makeSpace();
  const created = spaces.createSpaceOffer(sp.id, { title: "Matatu parts", price: 1200, currency: "KES", type: "product" });
  spaces.publishSpaceOffer(sp.id, created.id, { callerId: owner.id });
  const offer = { id: created.id };
  let html = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT }));
  assert.ok(!/in hand/.test(html), "untracked stock says nothing about stock");
  store.update("listings", offer.id, { quantityAvailable: 8 });
  {
    const ldHtml = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT }));
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(ldHtml)[1]);
    assert.equal(ld.hasOfferCatalog.itemListElement[0].item[0].availability, "https://schema.org/InStock",
      "eight in hand, by their own count, is a claim the markup may repeat");
  }
  html = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT }));
  assert.match(html, /8 in hand, by their own count/);
  store.update("listings", offer.id, { quantityAvailable: 0 });
  {
    const ldHtml = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT }));
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(ldHtml)[1]);
    assert.equal(ld.hasOfferCatalog.itemListElement[0].item[0].availability, "https://schema.org/OutOfStock");
  }
  html = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT }));
  assert.match(html, /Sold out for now/, "a true zero is allowed, and says what it means");
});

await test("the arm of the business is printed when named, and silent when not", () => {
  const bulk = spaces.createSpace({ ownerId: owner.id, name: "Bulk Room", visibility: "public", mode: "wholesale" });
  const v = page.publicPageView(store.find("spaces", (x) => x.id === bulk.id), { origin: "https://t.test" });
  const fact = v.facts.find((f) => f.key === "mode");
  assert.ok(fact, "a named mode is a fact on the page");
  assert.equal(fact.answer, "Wholesale", "in the server's own word, not a client's");
  const html = page.renderPage(v);
  assert.ok(html.includes("Wholesale"), "and it reaches the served HTML");
  assert.ok(!/Top rated|Premium seller|Best price/i.test(html), "naming an arm is not a badge, a rank or a boost");

  const quiet = spaces.createSpace({ ownerId: owner.id, name: "Unmarked Room", visibility: "public" });
  const q = page.publicPageView(store.find("spaces", (x) => x.id === quiet.id), { origin: "https://t.test" });
  assert.ok(!q.facts.some((f) => f.key === "mode"), "an unstated mode yields no fact at all");
  const qhtml = page.renderPage(q);
  assert.ok(!/Not stated|mode not stated/i.test(qhtml), "and the page never editorialises about the blank field");
});

await test("a private space is not a page in disguise", () => {
  const sp = spaces.createSpace({ ownerId: owner.id, name: "Hidden Counter", visibility: "private" });
  const info = page.unavailableReason(sp.slug);
  assert.equal(info.status, 404);
  assert.equal(info.kind, "private");
  const html = page.renderUnavailable(info);
  assert.match(html, /noindex/, "a page that came down stops being offered");
  assert.match(html, /This shop is private right now/);

  const unlisted = spaces.createSpace({ ownerId: owner.id, name: "Quiet Room", visibility: "unlisted" });
  assert.equal(page.unavailableReason(unlisted.slug).kind, "unlisted");

  assert.equal(page.unavailableReason("no-such-shop-anywhere").kind, "unknown");
});

await test("the one public write stores a row and changes nothing else", () => {
  const sp = makeSpace({ name: "Reported Shop" });
  const result = page.reportSpace(sp.slug, { reason: "Prices here are not their prices" });
  assert.equal(result.reported, true);
  const row = store.find("spaceAbuseReports", (r) => r.id === result.id);
  assert.equal(row.spaceId, sp.id);
  assert.equal(row.handledAt, null, "nothing pretends a review happened");
  assert.equal(row.outcome, null);
  const after = store.find("spaces", (s) => s.id === sp.id);
  assert.equal(after.visibility, "public", "a report does not take a page down");

  const tooShort = page.reportSpace(sp.slug, { reason: "hi" });
  assert.equal(tooShort.status, 400, "a one-word report is not a row worth keeping");
  assert.equal(store.filter("spaceAbuseReports", (r) => r.spaceId === sp.id).length, 1);

  const missing = page.reportSpace("no-such-slug", { reason: "whatever it was" });
  assert.equal(missing.status, 404);

  const ownerRead = page.reportsForSpace(sp.id);
  assert.equal(ownerRead.count, 1);
  assert.match(ownerRead.note, /Brief has not reviewed them/);
  // The receipt copy must not promise a takedown.
  const receipt = page.renderNote({ heading: "Reported.", line: result.note });
  assert.ok(!/will be removed|taken down|review within/i.test(receipt), "no promise of moderation");
});

// ---------------------------------------------------------------------------
// The HTTP surface, mounted exactly as production mounts it.
// ---------------------------------------------------------------------------
const { default: app } = await import("../src/index.js");
const srv = app.listen(0);
const port = srv.address().port;
const get = async (p, opts = {}) => {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, opts);
  const text = await r.text();
  return { status: r.status, text, headers: r.headers };
};
const api = async (p, method = "GET", body, tok = token) => {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

await test("GET /s/:slug serves a rendered page and records exactly one view", async () => {
  const sp = makeSpace({ name: "Sticker Shop" });
  const before = store.filter("signals", (s) => s.type === "space_viewed" && s.metadata?.spaceId === sp.id).length;
  const res = await get(`/s/${sp.slug}`);
  assert.equal(res.status, 200);
  assert.match(res.text, /<!-- brief:public-page -->/);
  assert.equal(res.headers.get("cache-control"), "no-store, no-cache, must-revalidate", "a mirror must never cache into a stale reflection");
  const after = store.filter("signals", (s) => s.type === "space_viewed" && s.metadata?.spaceId === sp.id).length;
  assert.equal(after - before, 1, "opening the page is a view");

  // The in-app mirror reads the same data, so a page opening counts once there
  // too — whichever renderer drew the page.
  const json = await get(`/api/public/spaces/${sp.slug}/page`);
  assert.equal(json.status, 200);
  let after2 = store.filter("signals", (s) => s.type === "space_viewed" && s.metadata?.spaceId === sp.id).length;
  assert.equal(after2 - after, 1, "a page opening is a page opening");

  // The directory card is a name scrolling past. It is not a visit.
  const card = await get(`/api/public/spaces/${sp.slug}`);
  assert.equal(card.status, 200);
  after2 = store.filter("signals", (s) => s.type === "space_viewed" && s.metadata?.spaceId === sp.id).length;
  assert.equal(after2 - after, 1, "reading the card adds nothing to the count");
});

await test("a private space's URL answers 404 with an honest page", async () => {
  const sp = spaces.createSpace({ ownerId: owner.id, name: "Not For You", visibility: "private" });
  const res = await get(`/s/${sp.slug}`);
  assert.equal(res.status, 404);
  assert.match(res.text, /This shop is private right now/);
  assert.match(res.text, /noindex/);
  assert.ok(!res.text.includes(sp.id), "the private space's id is not leaked");
});

await test("a page follows the space: publish an offer, and it appears", async () => {
  const sp = makeSpace({ name: "Follow Me Shop" });
  let res = await get(`/s/${sp.slug}`);
  assert.match(res.text, /This shop is being set up/);
  const created = await api(`/api/spaces/${sp.id}/offers`, "POST", { title: "Kachumbali tomatoes", price: 300, currency: "KES", type: "product" });
  assert.equal(created.status, 201);
  await api(`/api/spaces/${sp.id}/offers/${created.body.offer.id}/publish`, "POST", {});
  res = await get(`/s/${sp.slug}`);
  assert.match(res.text, /Kachumbali tomatoes/);
  assert.match(res.text, /KES 300/);
  assert.ok(!/This shop is being set up/.test(res.text), "the empty state went away by itself");
  assert.match(res.text, /1 live offer/);
});

await test("a page goes down when the owner flips it private", async () => {
  const sp = makeSpace({ name: "Down Goes It" });
  assert.equal((await get(`/s/${sp.slug}`)).status, 200);
  await api(`/api/spaces/${sp.id}`, "PATCH", { visibility: "private" });
  const res = await get(`/s/${sp.slug}`);
  assert.equal(res.status, 404);
  assert.match(res.text, /private right now/);
});

await test("the owner's public-page read mirrors what a stranger sees, plus reports", async () => {
  const sp = makeSpace({ name: "Owner View Shop" });
  page.reportSpace(sp.slug, { reason: "Impersonating another shop" });
  const res = await api(`/api/spaces/${sp.id}/public-page`);
  assert.equal(res.status, 200);
  assert.equal(res.body.path, `/s/${sp.slug}`);
  assert.equal(res.body.open, true);
  assert.equal(res.body.reports.count, 1);
  assert.match(res.body.reports.note, /has not reviewed/, "no fake moderation status");
  assert.match(res.body.note, /mirror/, "the copy says what it is");
  // The stranger's projection and the owner's view agree, because they are
  // literally the same function.
  const stranger = await api(`/api/public/spaces/${sp.slug}/page`, 'GET', undefined, null);
  const a = JSON.parse(JSON.stringify(res.body.view)); delete a.noindex;
  const b = stranger.body.space; delete b.noindex;
  assert.deepEqual(a, b, "no better shop is shown to the owner than to the buyer");

  const notMine = await api(`/api/spaces/${sp.id}/public-page`, "GET", undefined, auth.issueSession(fan.id).token);
  assert.equal(notMine.status, 403, "a stranger may not read the owner's panel");
});

await test("the report form works without JavaScript", async () => {
  const sp = makeSpace({ name: "Form Shop" });
  const res = await get(`/s/${sp.slug}/report`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "reason=This+shop+does+not+exist"
  });
  assert.equal(res.status, 200);
  assert.match(res.text, /Reported\./);
  const rows = store.filter("spaceAbuseReports", (r) => r.spaceId === sp.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, "This shop does not exist");
});

await test("a page read returns only the caller's own follow row", async () => {
  const sp = makeSpace({ name: "Follow Row Shop" });
  const anon = await api(`/api/public/spaces/${sp.slug}/page`, "GET", undefined, null);
  assert.equal(anon.status, 200);
  assert.equal(anon.body.space.following, undefined, "a stranger is not offered a state they cannot have");
  const mine = await api(`/api/public/spaces/${sp.slug}/page`, "GET", undefined, auth.issueSession(fan.id).token);
  assert.equal(mine.body.space.following, false, "a member who has not followed gets false, not silence");
  audience.followSpace(sp.id, fan.id);
  const after = await api(`/api/public/spaces/${sp.slug}/page`, "GET", undefined, auth.issueSession(fan.id).token);
  assert.equal(after.body.space.following, true, "and true once their row exists");
  assert.equal((await api(`/api/public/spaces/${sp.slug}/page`, "GET", undefined, null)).body.space.following, undefined,
    "the row is never broadcast to others");
});

await test("the sitemap refuses to invent an origin, and lists only live pages", async () => {
  const none = await get("/sitemap-spaces.xml");
  assert.equal(none.status, 503, "no declared origin, no absolute URLs published");
  assert.match(none.text, /BRIEF_PUBLIC_ORIGIN/);
  process.env.BRIEF_PUBLIC_ORIGIN = "https://brief.app";
  const sp = makeSpace({ name: "Sitemap Shop" });
  const hidden = spaces.createSpace({ ownerId: owner.id, name: "Sitemap Hidden", visibility: "private" });
  const res = await get("/sitemap-spaces.xml");
  assert.equal(res.status, 200);
  assert.match(res.text, new RegExp(`/s/${sp.slug}`));
  assert.ok(!res.text.includes(hidden.slug), "a private space is not in the index");
  assert.ok(!/changefreq|priority/.test(res.text), "no SEO theatre");
  delete process.env.BRIEF_PUBLIC_ORIGIN;
});

await test("the source never contains a fabricated counter or badge", () => {
  const src = fs.readFileSync(new URL("../src/domain/spacePublicPage.js", import.meta.url), "utf8");
  for (const banned of ["aggregateRating", "verified business", "trusted seller", "X people viewing", "streak", "leaderboard", "top rated"]) {
    const hit = src.toLowerCase().includes(banned.toLowerCase());
    // banned words may appear in a comment naming the refusal — check they do
    // not appear in a rendered string.
    if (hit) {
      const lines = src.split("\n").filter((l) => l.toLowerCase().includes(banned.toLowerCase()));
      assert.ok(lines.every((l) => l.trim().startsWith("*") || l.trim().startsWith("//") || l.includes("No aggregateRating")), `"${banned}" only appears as a refusal: ${lines[0]?.trim()}`);
    }
  }
  const rendered = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.name === "Sticker Shop"), { nowMs: FRI_10AM_EAT }));
  assert.ok(!/views|viewed/i.test(rendered), "the public page shows no view count at all");
});

await test("leaving the contact channel blank is a choice, never a to-do", () => {
  const sp = makeSpace({ name: "Quiet Contact" });
  const row = store.find("spaces", (s) => s.id === sp.id);
  const maint = prof.maintenanceFor(row);
  const byKey = Object.fromEntries(maint.fields.map((f) => [f.key, f.state]));
  assert.equal(byKey.contactChannel, "skipped", "an optional answer nobody gave is not 'unanswered'");
  assert.equal(maint.fields.filter((f) => f.state === "unanswered").length, maint.unanswered,
    "the count is only the required questions, so a skipped optional one is not in it");
  assert.equal(maint.answered + maint.unanswered + 1, maint.fields.length, "skipped is its own state, counted nowhere");
  const q = prof.editorialQueueFor(row);
  assert.ok(!q.some((i) => i.field === "contactChannel"), "it never appears on the to-do list");
  // Once answered it behaves like every other field: it can go stale.
  setProfile(sp.id, { contactChannel: { platform: "whatsapp", phone: "+254700111222" } });
  const answered = prof.maintenanceFor(store.find("spaces", (s) => s.id === sp.id), { now: Date.now() });
  assert.equal(answered.fields.find((f) => f.key === "contactChannel").state, "current");
});

await test("no branch can respond twice — a brace-depth scan, with its own self-test", () => {
  // Why a static scan and not an HTTP assertion: the bug this catches is
  // `res.status(503).send(msg)` followed by more writes in the same block.
  // Express has already flushed, so the client sees a clean 503 and a status
  // assertion passes, while the server logs ERR_HTTP_HEADERS_SENT and the error
  // handler runs against a finished response. Only the shape of the code shows it.
  const scan = (src) => {
    const bad = [];
    let depth = 0;
    const respondedAt = new Map();
    (Array.isArray(src) ? src : src.split("\n")).forEach((raw, i) => {
      const line = raw.replace(/\/\/.*$/, "");
      // Braces only. Counting '(' (or ';') as an opener drifts the depth upward
      // on every call, so the "same block" test never lines up and the rule looks
      // green while catching nothing.
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      // `res.status(503).type('text/plain').send(x)` is a write too, so the test
      // is "this line reaches a response method on res", not "res.send(".
      const isWrite = /\bres\b[^;]*\.(send|json|end)\(/.test(line);
      const guarded = /^\s*return\b/.test(line) || /\breturn\s+res\./.test(line);
      if (isWrite && !guarded) respondedAt.set(depth, i + 1);
      else if ((/\bres\.(setHeader|type|status)\(/.test(line) || isWrite) && respondedAt.has(depth)) {
        bad.push(`${i + 1}: writes after the response was sent at line ${respondedAt.get(depth)}`);
        respondedAt.delete(depth);
      }
      depth += opens - closes;
      // Forget marks only when their BLOCK closes (a shallower depth). Clearing
      // at equal depth wiped the mark on the very line that set it, which is how
      // a lint rule quietly becomes a no-op.
      for (const k of [...respondedAt.keys()]) if (k > depth) respondedAt.delete(k);
    });
    return bad;
  };
  // the detector is proved on the bug it was written for, and on the fix
  assert.deepEqual(
    scan(["  if (!origin) {", "    res.status(503).type('text/plain').send(msg);", "    res.setHeader('Cache-Control', 'no-store');", "  }"]),
    ["3: writes after the response was sent at line 2"],
    "the scan must catch a setHeader after a send"
  );
  assert.deepEqual(scan(["  if (!origin) {", "    return res.status(503).send(msg);", "  }"]), [], "a returned send is fine");
  const src = fs.readFileSync(new URL("../src/routes/spaces.js", import.meta.url), "utf8");
  assert.deepEqual(scan(src), [], "no handler in the spaces router can respond twice");
});

await test("the page honours the app's type floor and shadow-not-stroke rule", () => {
  const src = fs.readFileSync(new URL("../src/domain/spacePublicPage.js", import.meta.url), "utf8");
  const css = src.slice(src.indexOf("const ROOM_CSS"), src.indexOf("`;", src.indexOf("const ROOM_CSS")));
  const sizes = [...css.matchAll(/font(?:-size)?:\s*(?:\d+(?:\.\d+)?px\/)?(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 8, "the sheet declares its type scale");
  assert.ok(Math.min(...sizes) >= 11, `the smallest type on a public page is 11px (found ${Math.min(...sizes)}px)`);
  const cardRule = /\.card\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.ok(!/border:/.test(cardRule), "a card is lifted by shadow, never outlined");
  assert.ok(/box-shadow:var\(--lift\)/.test(cardRule), "and the lift is the same construction the app uses");
  // A hairline is still legal where it is genuinely a line: an input's ring.
  assert.ok(/textarea\{[^}]*border:1px solid var\(--line\)/.test(css), "an input keeps its ring — the rule bans outlining cards, not drawing lines");
  // the room's own steps, not a foreign grey
  assert.ok(css.includes("--bg:#F7F8FA") && css.includes("--card:#FFFFFF"), "the page wears the room: cool near-white, white card");
  assert.ok(css.includes("--accent:#2563EB"), "one accent, the same blue as the app");
});

await test("the page carries one brand, and the rename cannot half-land here", () => {
  const sp = makeSpace({ name: "Brand Check Shop" });
  const html = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT }));
  assert.match(html, /<title>Brand Check Shop — on Trace<\/title>/, "the share-preview title carries the product name");
  assert.ok(!/on Brief/.test(html), "no half-renamed string survives on a page a stranger reads");
  const gone = page.renderUnavailable(page.unavailableReason(sp.slug));
  assert.ok(!/on Brief/.test(gone), "and not on the page that answers when a shop comes down");
});

await test("hours are attributed to a named clock on the page", () => {
  const sp = makeSpace({ name: "Clock Shop" });
  const html = page.renderPage(page.publicPageView(store.find("spaces", (s) => s.id === sp.id), { nowMs: FRI_10AM_EAT }));
  assert.match(html, /Hours read against East Africa Time/);
});

srv.close();
console.log(`PASSED ${count} FAILED 0`);
