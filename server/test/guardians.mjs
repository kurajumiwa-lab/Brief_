// ---------------------------------------------------------------------------
// GUARDIANS (shop-level attribution) — "you registered this shop, so you have a
// reason to care".
//
// The idea pays people for bringing businesses in and pressures them to keep
// those businesses honest. Both halves are easy to fake, so these tests are the
// gates, the arithmetic and the absences:
//
//   * a claim credits NOTHING until the shop's own owner confirms it, and the
//     window opens at confirmation, not at the claim;
//   * an owner cannot attribute their own shop, a second claimant is refused with
//     a reason, a private shop cannot be claimed, and pending claims are capped
//     because each one is somebody else's notification;
//   * a dispute is a wall: nobody gets to re-claim that shop, so "claim, get
//     refused, claim again" is not a way to notify a merchant forever;
//   * the credit is POINTS on settled orders, written into the referral log, so
//     one pool and one cap govern every distribution share — and this module
//     opens no ledger of its own;
//   * a shop already held by a field agent earns its guardian nothing;
//   * complaints count only from signed-in reporters, one open report per person,
//     so a reward cannot be frozen by tapping a public form three times;
//   * past the flag threshold the credit pauses and the guardian is told; past
//     the suspension threshold it freezes and an operator is told — and the shop
//     stays up, because there is no reviewer in this product;
//   * and no rating, star, complaint rate or standing score exists anywhere in
//     the projection, because Brief holds no review rows for a shop's orders.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-guardians-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const spaces = await import("../src/domain/space.js");
const listings = await import("../src/domain/listing.js");
const orders = await import("../src/domain/order.js");
const ledger = await import("../src/domain/ledger.js");
const referrals = await import("../src/domain/referrals.js");
const fieldAgent = await import("../src/domain/fieldAgent.js");
const g = await import("../src/domain/guardians.js");
const page = await import("../src/domain/spacePublicPage.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const user = (handle) => auth.createUser({ handle, password: "a good passphrase" });
const owner = user("gu_owner");
const guardian = user("gu_guardian");
const rival = user("gu_rival");
const buyer = user("gu_buyer");

const sp = spaces.createSpace({ ownerId: owner.id, name: "Kikao Hardware", type: "business", visibility: "public" });
const listing = listings.createListing({ vendorId: sp.vendorId, title: "20kg cement", price: 850, currency: "KES" });
store.update("listings", listing.id, { status: "active" });

/** The honest settle path: an order with a settled ledger transaction behind it. */
function settledOrder(listingId = listing.id, buyerId = buyer.id) {
  const order = orders.createOrder({ listingId, buyerId, quantity: 1 });
  const total = Number(order.totals?.total ?? order.total ?? 0);
  const tx = ledger.createTransaction({ amount: total, type: "order_payment", description: "test", counterparty: buyerId });
  ledger.transitionTransaction(tx.id, "pending");
  ledger.transitionTransaction(tx.id, "confirmed");
  ledger.transitionTransaction(tx.id, "settled");
  orders.attachTransaction(order.id, tx.id);
  orders.transitionOrder(order.id, "fulfilled"); // this is where referral events fire
  return orders.transitionOrder(order.id, "settled");
}

const linkFor = (spaceId) => store.find("attributions", (a) =>
  a.spaceId === (spaceId ?? sp.id) && ["pending_owner", "active"].includes(a.status));

// ---------------------------------------------------------------------------
await test("a claim is pending, and it credits nothing until the shop confirms", () => {
  const out = g.claimSpace({ actorId: guardian.id, spaceId: sp.id, note: "I walked them through signing up" });
  assert.equal(out.attribution.status, "pending_owner");
  assert.equal(out.attribution.note, "I walked them through signing up");
  assert.match(out.note, /credits nothing until/);
  settledOrder();
  const standing = g.standingFor(store.find("attributions", (a) => a.id === out.attribution.id));
  assert.equal(standing.points, 0, "an order settled through the shop, and a pending link still has no credit");
  assert.equal(standing.status, "pending_owner");
  assert.match(standing.note, /Nothing accrues/);
});

await test("only the shop's owner can open the gate", () => {
  const row = linkFor();
  assert.throws(() => g.confirmClaim({ actorId: rival.id, attributionId: row.id }), /only the shop owner/);
  assert.equal(store.find("attributions", (a) => a.id === row.id).status, "pending_owner", "a stranger cannot confirm on their behalf");
  const out = g.confirmClaim({ actorId: owner.id, attributionId: row.id });
  assert.equal(out.attribution.status, "active");
  assert.ok(out.attribution.startsAt && out.attribution.expiresAt, "the window opens at confirmation");
  assert.equal(out.pointsPerHundredKes, g.GUARDIAN_POINTS_PER_HUNDRED_KES);
});

await test("the credit is points on settled orders, in the referral log, not a balance", () => {
  const row = linkFor();
  settledOrder();
  const events = store.filter("referralEvents", (e) => e.kind === "guardian_order" && e.referrerId === guardian.id);
  assert.equal(events.length, 1, "only the order that settled AFTER confirmation is credited — the pending one produced nothing");
  assert.equal(events[0].points, Math.floor(850 / 100) * g.GUARDIAN_POINTS_PER_HUNDRED_KES, "floor of KES 100s, never rounded up");
  const standing = g.standingFor(store.find("attributions", (a) => a.id === row.id));
  assert.equal(standing.settledOrders, 1, "one settled order inside the window, not both");
  assert.equal(standing.points, events.reduce((n, e) => n + e.points, 0));
  assert.equal(standing.grossKes, undefined, "the shop's turnover is not the guardian's to read");
  assert.ok(!("kes" in standing) && !("balance" in standing), "no money column exists to fudge");
  // and the ledger is untouched: this module opens no second book
  assert.equal(store.filter("ledgerTransactions", (t) => t.type === "attribution_override").length, 0);
  // replaying the fulfilment cannot mint a second credit
  const before = store.filter("referralEvents", (e) => e.key === events[0].key).length;
  referrals.recordOrder(events[0].key.split(":")[1]);
  assert.equal(store.filter("referralEvents", (e) => e.key === events[0].key).length, before, "idempotent per order");
});

await test("the window opens at confirmation, so pre-claim orders are out", () => {
  const shopOwner = user("gu_win_owner");
  const shop = spaces.createSpace({ ownerId: shopOwner.id, name: "Window Shop", visibility: "public" });
  const l = listings.createListing({ vendorId: shop.vendorId, title: "hinges", price: 4000, currency: "KES" });
  store.update("listings", l.id, { status: "active" });
  const made = g.claimSpace({ actorId: rival.id, spaceId: shop.id });
  settledOrder(l.id); // before confirmation: no credit
  assert.equal(store.filter("referralEvents", (e) => e.kind === "guardian_order" && e.referrerId === rival.id).length, 0);
  g.confirmClaim({ actorId: shopOwner.id, attributionId: made.attribution.id });
  const before = store.filter("referralEvents", (e) => e.kind === "guardian_order" && e.referrerId === rival.id).length;
  settledOrder(l.id); // after confirmation: credit
  const after = store.filter("referralEvents", (e) => e.kind === "guardian_order" && e.referrerId === rival.id).length;
  assert.equal(after - before, 1, "it pays from the confirmation forward, which is the honest direction");
});

await test("refusals: self-claim, second claimant, private shop, no session", () => {
  const other = spaces.createSpace({ ownerId: owner.id, name: "Second Counter", visibility: "public" });
  assert.throws(() => g.claimSpace({ actorId: owner.id, spaceId: other.id }), /your own space/, "an owner cannot pay themselves");
  assert.throws(() => g.claimSpace({ actorId: rival.id, spaceId: sp.id }), /already claimed/, "first claim holds the slot");
  assert.throws(() => g.claimSpace({ actorId: guardian.id, spaceId: sp.id }), /already hold/, "and repeating it is not a second claim");
  const hidden = spaces.createSpace({ ownerId: user("gu_priv").id, name: "Private Thing" });
  assert.throws(() => g.claimSpace({ actorId: guardian.id, spaceId: hidden.id }), /public, active/);
  assert.throws(() => g.claimSpace({ spaceId: sp.id }), /sign in/);
  assert.throws(() => g.claimSpace({ actorId: guardian.id, spaceId: "nope" }), /no such space/);
});

await test("a dispute is a wall, and the shop's words are kept verbatim", () => {
  const shopOwner = user("gu_disp_owner");
  const shop = spaces.createSpace({ ownerId: shopOwner.id, name: "Disputed Depot", visibility: "public" });
  const made = g.claimSpace({ actorId: buyer.id, spaceId: shop.id });
  const out = g.disputeClaim({ actorId: shopOwner.id, attributionId: made.attribution.id, reason: "nobody registered me, I signed up myself" });
  assert.equal(out.attribution.status, "disputed");
  assert.match(out.attribution.revokeReason, /signed up myself/);
  assert.match(out.note, /cannot be claimed again/);
  for (const who of [buyer.id, guardian.id, rival.id]) {
    assert.throws(() => g.claimSpace({ actorId: who, spaceId: shop.id }), /disputed an introduction before/, "for anybody, not just the loser");
  }
  const note = store.filter("notifications", (n) => n.userId === buyer.id).at(-1);
  assert.ok(note && /disputed your claim/i.test(note.title), "the claimant is told, in the app");
});

await test("revoking needs a reason; a revoked shop can be re-claimed, a disputed one cannot", () => {
  const shopOwner = user("gu_rev_owner");
  const shop = spaces.createSpace({ ownerId: shopOwner.id, name: "Revoke Shop", visibility: "public" });
  const out = g.claimSpace({ actorId: guardian.id, spaceId: shop.id });
  assert.throws(() => g.revokeClaim({ actorId: guardian.id, attributionId: out.attribution.id, reason: "eh" }), /reason/);
  assert.throws(() => g.revokeClaim({ actorId: rival.id, attributionId: out.attribution.id, reason: "not my business" }), /not yours/);
  const revoked = g.revokeClaim({ actorId: guardian.id, attributionId: out.attribution.id, reason: "they never answered me" });
  assert.equal(revoked.attribution.status, "revoked");
  assert.ok(store.find("notifications", (n) => n.userId === shopOwner.id && /attribution ended/i.test(n.title)), "the other party is told");
  const again = g.claimSpace({ actorId: rival.id, spaceId: shop.id });
  assert.equal(again.attribution.status, "pending_owner", "an ending is not an accusation");
});

await test("pending claims are capped, because each one is somebody else's notification", () => {
  const spammer = user("gu_spam");
  for (let i = 0; i < g.PENDING_CLAIM_CAP; i++) {
    const shop = spaces.createSpace({ ownerId: user(`gu_v${i}`).id, name: `Cap Shop ${i}`, visibility: "public" });
    g.claimSpace({ actorId: spammer.id, spaceId: shop.id });
  }
  const extra = spaces.createSpace({ ownerId: user("gu_v_extra").id, name: "Cap overflow", visibility: "public" });
  assert.throws(() => g.claimSpace({ actorId: spammer.id, spaceId: extra.id }), /cap is/, "the refusal states its reason");
  assert.equal(linkFor(extra.id), null, "the refused claim wrote nothing");
});

await test("no stacking: a vendor an agent holds cannot also pay a guardian", () => {
  const shopOwner = user("gu_ag_owner");
  const agent = user("gu_agent");
  const shop = spaces.createSpace({ ownerId: shopOwner.id, name: "Agent Held Shop", visibility: "public" });
  fieldAgent.claimVendor({ agentId: agent.id, vendorId: shop.vendorId, claimType: "full_registration" });
  assert.throws(() => g.claimSpace({ actorId: guardian.id, spaceId: shop.id }), /field agent already holds/, "refused up front, not zeroed later");
});

await test("reports: only signed-in rows count, one per person", () => {
  const a = page.reportSpace(sp.slug, { reason: "Prices on the page are not their prices", reporterId: rival.id });
  assert.equal(a.reported, true);
  assert.equal(g.reportCount(sp.id), 1);
  const again = page.reportSpace(sp.slug, { reason: "still wrong", reporterId: rival.id });
  assert.equal(again.reused, true, "the same person tapping twice is not two reports");
  assert.equal(g.reportCount(sp.id), 1);
  page.reportSpace(sp.slug, { reason: "different person", reporterId: buyer.id });
  assert.equal(g.reportCount(sp.id), 2, "a second person is a second report");
  page.reportSpace(sp.slug, { reason: "anonymous hit" });
  page.reportSpace(sp.slug, { reason: "another anonymous one" });
  assert.equal(g.reportCount(sp.id), 2, "an anonymous form cannot freeze anybody's credit");
  assert.equal(store.filter("spaceAbuseReports", (r) => r.spaceId === sp.id).length, 4, "all four rows still exist for the owner to read");
});

await test("the complaint loop pauses the credit, tells the guardian, and leaves the shop up", () => {
  for (const who of ["gu_r1", "gu_r2"]) page.reportSpace(sp.slug, { reason: "not answering buyers", reporterId: user(who).id });
  assert.equal(g.reportCount(sp.id), 4);
  const row = linkFor();
  assert.equal(g.effectiveStatus(row).status, "flagged", "3+ open reports pause the link");
  const before = g.standingFor(store.find("attributions", (a) => a.id === row.id)).points;
  const l = store.find("listings", (x) => x.id === listing.id);
  void l;
  // a settled order while flagged must produce nothing
  const orders0 = store.filter("referralEvents", (e) => e.kind === "guardian_order").length;
  settledOrder();
  assert.equal(store.filter("referralEvents", (e) => e.kind === "guardian_order").length, orders0, "the pause has a consequence");
  assert.equal(g.standingFor(store.find("attributions", (a) => a.id === row.id)).points, before);
  const swept = g.reviewLinks();
  assert.ok(swept.reviewed >= 1, "the sweep saw it");
  assert.match(swept.note, /does not remove a shop/);
  const note = store.filter("notifications", (n) => n.userId === guardian.id).at(-1);
  assert.ok(note && /report/i.test(note.title + note.body), "the guardian is told in the app, not by an invented push channel");
  assert.equal(store.find("spaces", (s) => s.id === sp.id).status, "active", "the shop is still up");

  for (let i = 0; i < 3; i++) page.reportSpace(sp.slug, { reason: "still unresolved", reporterId: user(`gu_r${i + 3}`).id });
  assert.equal(g.effectiveStatus(store.find("attributions", (a) => a.id === row.id)).status, "suspended");
  for (const r of store.filter("spaceAbuseReports", (x) => x.spaceId === sp.id && !x.handledAt)) {
    store.update("spaceAbuseReports", r.id, { handledAt: new Date().toISOString() });
  }
  assert.equal(g.effectiveStatus(store.find("attributions", (a) => a.id === row.id)).status, "active",
    "the status is derived, so a resolved report stops costing the guardian today");
});

await test("an expired window ends the credit on read, with no cron", () => {
  const row = linkFor();
  store.update("attributions", row.id, { expiresAt: new Date(Date.now() - 1000).toISOString() });
  const status = g.effectiveStatus(store.find("attributions", (a) => a.id === row.id));
  assert.equal(status.status, "expired");
  assert.match(status.reason, /window closed/);
  const l = store.find("listings", (x) => x.id === listing.id);
  const orders0 = store.filter("referralEvents", (e) => e.kind === "guardian_order").length;
  settledOrder(l.id);
  assert.equal(store.filter("referralEvents", (e) => e.kind === "guardian_order").length, orders0, "expired earns nothing");
  store.update("attributions", row.id, { expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() });
});

await test("the network view shows rows, names its absences, and never a rating", () => {
  const net = g.networkFor(guardian.id);
  assert.ok(net.businesses.some((b) => b.spaceName === "Kikao Hardware"));
  assert.ok(net.totals.claimed >= 1);
  assert.deepEqual(net.channels, { inApp: "created", sms: "not_configured", whatsapp: "not_configured" }, "no imaginary push channel");
  // Scan the DATA, not the sentence that explains each absence: the unavailable
  // list literally contains the word "ratings", because it says there are none.
  const json = JSON.stringify({ businesses: net.businesses, totals: net.totals }).toLowerCase();
  for (const banned of ["rating", "stars", "★", "verified", "standing", "percentile", "rank", "tier", "score"]) {
    assert.ok(!json.includes(banned), `the guardian view must not contain "${banned}"`);
  }
  // Money keys: `pointsPerHundredKes` is a RATE name the guardian needs to see
  // their own terms; a money FIELD (gross/revenue/total) is the shop's business.
  const keys = new Set(net.businesses.flatMap((b) => Object.keys(b)));
  const moneyKeys = [...keys].filter((k) => /kes$/i.test(k) && k !== "pointsPerHundredKes");
  assert.deepEqual(moneyKeys, [], "no money field is exposed to a guardian");
  assert.ok(net.unavailable.some((u) => /no review rows/i.test(u)), "and it says why there is no rating");
  assert.ok(net.unavailable.some((u) => /charges no such fee/i.test(u)), "and why there is no percentage cut");
  const shop = g.forSpace(sp.id);
  assert.match(shop.terms, /rewards pool, never out of what you earn/, "the shop is told, while it is live, that nothing is deducted from it");
  assert.match(shop.terms, /point per KES 100/, "with the number, not a percentage of their revenue");
  assert.match(shop.note, /no mediator/, "and told what a dispute does and does not do");
  assert.equal(shop.attribution.status, "active");
});

await test("the unit economics stay inside the distribution budget", () => {
  // The worst-case cash value of one guardian credit on one order, at the
  // pool's own conversion rate, must sit under the platform-wide cap.
  const kesPerOrder = 100000; // a KES 100,000 order
  const points = Math.floor(kesPerOrder / 100) * g.GUARDIAN_POINTS_PER_HUNDRED_KES;
  const cash = points * referrals.CONVERSION.ptsToKes;
  assert.ok(cash / kesPerOrder < referrals.DISTRIBUTION_CAP, `${cash} on ${kesPerOrder} must fit under ${referrals.DISTRIBUTION_CAP}`);
  assert.ok(g.FLAG_AFTER_REPORTS < g.SUSPEND_AFTER_REPORTS, "pause before freeze");
  assert.equal(referrals.POINTS.guardianPerHundred, g.GUARDIAN_POINTS_PER_HUNDRED_KES, "one number, not two that can drift");
});

await test("the module cannot contain an invented score, and opens no ledger", () => {
  const src = fs.readFileSync(new URL("../src/domain/guardians.js", import.meta.url), "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n")
    // Prose that NAMES an absence is the point of the unavailable list, so
    // string literals are stripped before the identifier scan.
    .replace(/'[^'\n]*'/g, "''")
    .replace(/`[^`]*`/g, "''");
  // Whole identifiers, not substrings: "stars" is inside `startsAt`, and a scan
  // that flags a field name is a scan people will switch off.
  for (const banned of ["rating_avg", "aggregateRating", "stars", "rating", "leaderboard", "streak", "badge", "tier", "score", "revenueKes", "grossKes"]) {
    assert.ok(!new RegExp(`\\b${banned}\\b`, "i").test(code), `"${banned}" must not exist here`);
  }
  assert.ok(!/createTransaction|ledger\.js/.test(code), "no second money path is opened by this module");
  const moneys = code.match(/KES\s?\d{3,}/gi) ?? [];
  assert.deepEqual(moneys, [], "no money figure is written into this module");
});

// ---------------------------------------------------------------------------
// HTTP: authority, and the fact that nobody else can read your network.
// ---------------------------------------------------------------------------
const { default: app } = await import("../src/index.js");
const srv = app.listen(0);
const port = srv.address().port;
const http = async (p, method = "GET", body, tok = auth.issueSession(guardian.id).token) => {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

await test("API: wired, gated, and party-scoped", async () => {
  const anon = await fetch(`http://127.0.0.1:${port}/api/guardians/mine`);
  assert.equal(anon.status, 401, "a network is not public data");
  const mine = await http("/api/guardians/mine");
  assert.equal(mine.status, 200);
  assert.ok(Array.isArray(mine.body.network.businesses));
  // the rate is stated where the earning is shown, and it is the real one
  assert.equal(mine.body.network.conversion.ptsToKes, referrals.CONVERSION.ptsToKes);
  assert.equal(mine.body.network.conversion.minPoints, referrals.CONVERSION.minPoints);
  assert.equal(mine.body.network.conversion.poolAvailableKes, referrals.rewardPool().availableKes);
  assert.ok(mine.body.network.conversion.pointsAvailable >= 0, "the balance is their own, counted");
  // The buyer DID claim one shop in the dispute test, so "empty" is the wrong
  // expectation. The right one: a network read returns only that person's own
  // claims, never somebody else's.
  const buyerUser = store.find("users", (u) => u.handle === "gu_buyer");
  const other = await http("/api/guardians/mine", "GET", undefined, auth.issueSession(buyerUser.id).token);
  const theirs = store.filter("attributions", (a) => a.actorId === buyerUser.id).map((a) => a.id);
  assert.ok(other.body.network.businesses.length > 0, "their own claim is visible to them");
  assert.deepEqual(other.body.network.businesses.map((b) => b.attributionId).sort(), theirs.slice().sort(),
    "and nothing else is");
  assert.ok(other.body.network.businesses.every((b) => b.status === "disputed"), "the disputed one reads as disputed");

  const shopOwner = user("gu_http_owner");
  const shop = spaces.createSpace({ ownerId: shopOwner.id, name: "HTTP Depot", visibility: "public" });
  const made = await http("/api/guardians/claim", "POST", { spaceId: shop.id, note: "met them at the market" }, auth.issueSession(rival.id).token);
  assert.equal(made.status, 201);
  const denied = await http(`/api/spaces/${shop.id}/guardian`, "GET", undefined, auth.issueSession(buyer.id).token);
  assert.equal(denied.status, 403, "a stranger may not read who introduced a shop");
  const read = await http(`/api/spaces/${shop.id}/guardian`, "GET", undefined, auth.issueSession(shopOwner.id).token);
  assert.equal(read.body.attribution.status, "pending_owner");
  assert.equal(read.body.canConfirm, true);
  const conf = await http(`/api/guardians/${made.body.attribution.id}/confirm`, "POST", {}, auth.issueSession(rival.id).token);
  assert.equal(conf.status, 403, "the claimant cannot confirm their own claim over the shop");
  const ok = await http(`/api/guardians/${made.body.attribution.id}/confirm`, "POST", {}, auth.issueSession(shopOwner.id).token);
  assert.equal(ok.status, 200);
  const ops = await http("/api/ops/guardians/review", "POST", {}, auth.issueSession(buyer.id).token);
  assert.equal(ops.status, 403, "the sweep is an operator action, not a member one");
});

srv.close();
console.log(`PASSED ${count} FAILED 0`);
