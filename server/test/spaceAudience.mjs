// ---------------------------------------------------------------------------
// SPACE AUDIENCE — follows, views, broadcasts, insights, pins.
//
// This is the module where a product is most tempted to invent, so every test
// here is a check that the number is either a row or nothing:
//   * a follower exists only because a person wrote the row, and only for a
//     public, active space;
//   * a view is a public page opening — the owner's own looks are counted
//     separately and excluded from the figure the owner is shown;
//   * conversion is null when its denominator is empty, and a sector benchmark
//     is ALWAYS null: no such data exists in Brief;
//   * a broadcast reports notification rows created and nothing about reads,
//     because there are no read receipts;
//   * a pin is the vendor's own choice, validated against their own active
//     offers, capped at three.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-audience-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const spaces = await import("../src/domain/space.js");
const aud = await import("../src/domain/spaceAudience.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const DAY = 86400000;
const owner = auth.createUser({ handle: "au_owner", password: "a good passphrase" });
const fan = auth.createUser({ handle: "au_fan", password: "a good passphrase" });
const other = auth.createUser({ handle: "au_other", password: "a good passphrase" });

const sp = spaces.createSpace({ ownerId: owner.id, name: "Jj Cakes", type: "business", goal: "First 20 customers" });

// ---------------------------------------------------------------------------
await test("a slug is minted once and survives a rename", () => {
  assert.equal(sp.slug, "jj-cakes", "derived from the name");
  spaces.updateSpace(sp.id, { name: "Jj Cake Studio", visibility: "public" }, { callerId: owner.id });
  assert.equal(store.find("spaces", (s) => s.id === sp.id).slug, "jj-cakes", "the printed link still works");
  const twin = spaces.createSpace({ ownerId: other.id, name: "Jj Cakes", type: "business", visibility: "public" });
  assert.equal(twin.slug, "jj-cakes-2", "a collision takes a numeric tail, never a cute word");
});

await test("a follow is a row a person wrote, on a space that can be followed", () => {
  const before = spaces.createSpace({ ownerId: owner.id, name: "Private Room", type: "business" });
  assert.equal(aud.followSpace(before.id, fan.id).status, 409, "a private space has no audience to gain");
  assert.equal(aud.followSpace(sp.id, owner.id).status, 403, "you do not follow your own shop");

  const first = aud.followSpace(sp.id, fan.id);
  assert.equal(first.following, true);
  assert.equal(first.followers, 1, "the count is the row");
  const again = aud.followSpace(sp.id, fan.id);
  assert.equal(again.reused, true, "tapping twice does not double the number");
  assert.equal(again.followers, 1);

  const list = aud.followersOf(sp.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].displayName, "au_fan", "the owner can see WHO follows their own space");

  const off = aud.unfollowSpace(sp.id, fan.id);
  assert.equal(off.followers, 0, "unfollowing really removes it");
  aud.followSpace(sp.id, fan.id);
});

await test("a view is a page opening, and the owner's own looks are set apart", () => {
  const privateOne = store.find("spaces", (s) => s.name === "Private Room");
  assert.equal(aud.recordView(privateOne.id, { viewerId: fan.id }), false, "no page, no view");

  aud.recordView(sp.id, { viewerId: fan.id });
  aud.recordView(sp.id, { viewerId: other.id });
  aud.recordView(sp.id, { viewerId: owner.id });
  aud.recordView(sp.id, { viewerId: owner.id });

  const v = aud.viewsFor(sp.id, { windowDays: 7, nowMs: Date.now(), excludeUserId: owner.id });
  assert.equal(v.views, 2, "two strangers opened it");
  assert.equal(v.ownViewsExcluded, 2, "and the read admits the owner's two were dropped");
  assert.equal(v.viewers, null, "no visitor reference was stored, so distinct people is unknown, not 2");

  // Old rows leave the window rather than being deleted.
  store.insert("signals", {
    id: "sig_old_view", type: "space_viewed", circleId: null, blockId: null, sourceId: null,
    objectId: null, actorId: fan.id, value: null,
    metadata: { spaceId: sp.id }, createdAt: new Date(Date.now() - 30 * DAY).toISOString()
  });
  assert.equal(aud.viewsFor(sp.id, { windowDays: 7, excludeUserId: owner.id }).views, 2, "a 30-day-old view is out of a 7-day count");
});

await test("insights are arithmetic, and a benchmark never exists", () => {
  const row = spaces.getRawSpace(sp.id);
  const i = aud.insightsFor(row, { windowDays: 7, nowMs: Date.now() });
  assert.equal(i.windowDays, 7);
  assert.equal(i.inquiries.newInWindow, 0, "no conversation rows, so zero — not a dash, because zero IS the truth here");
  assert.equal(i.orders.total, 0);
  assert.equal(i.takeHome.currency, null, "no settled orders, so no currency is claimed");
  assert.equal(i.takeHome.value, 0);
  assert.equal(i.conversion.inquiriesToOrdersPct, null, "an empty denominator gives no percentage");
  assert.equal(i.benchmark, null, "no sector average, ever");
  assert.ok(i.unavailable.some((u) => /sector/i.test(u)), "and the read says what it cannot tell you");
  assert.ok(i.unavailable.some((u) => /who viewed/i.test(u)), "including that viewers are not identified");
  assert.match(i.note, /em dash|—/);

  // A real inquiry and a real settled order move the numbers.
  store.insert("spaceConversations", {
    id: "cv_i", spaceId: sp.id, status: "new", customerName: "Wanjiku", customerContact: "",
    messages: [{ from: "customer", text: "Can you do 12?", at: new Date().toISOString() }], createdAt: new Date().toISOString()
  });
  store.insert("orders", {
    id: "ord_i", buyerId: fan.id, vendorId: sp.vendorId, listingId: "lst_i", quantity: 2,
    total: 2400, currency: "KES", status: "settled", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  const after = aud.insightsFor(spaces.getRawSpace(sp.id), { windowDays: 7 });
  assert.equal(after.inquiries.newInWindow, 1);
  assert.equal(after.inquiries.awaitingYourReply, 1, "a 'new' conversation is one the vendor owes a reply to");
  assert.equal(after.orders.newInWindow, 1);
  assert.equal(after.takeHome.value, 2400);
  assert.equal(after.takeHome.currency, "KES");
  assert.equal(after.conversion.inquiriesToOrdersPct, 100, "1 of 1 inquiry became an order — arithmetic, stated");
  assert.equal(after.benchmark, null, "and still no industry average to compare to");
});

await test("a broadcast reaches real followers, expires on its own, and says nothing about reads", () => {
  const none = store.find("spaces", (s) => s.name === "Private Room");
  const lonely = aud.postBroadcast(none.id, { actorId: owner.id, text: "Back on Friday", kind: "update" });
  assert.equal(lonely.error, undefined);
  assert.equal(lonely.delivery.audience, 0);
  assert.match(lonely.delivery.note, /Nobody follows this space yet/, "an empty audience is stated, not hidden");

  const b = aud.postBroadcast(sp.id, { actorId: owner.id, text: "Oven fixed — open from 6 tomorrow", kind: "hours" });
  assert.ok(b.broadcast.expiresAt, "the expiry is a real timestamp");
  assert.equal(Date.parse(b.broadcast.expiresAt) - Date.parse(b.broadcast.createdAt), aud.BROADCAST_TTL_HOURS * 3600000);
  assert.equal(b.delivery.notified, 1, "one notification row was created");
  assert.equal(b.delivery.channels.sms, "not_configured", "no SMS is claimed");
  assert.equal(b.delivery.channels.whatsapp, "not_configured", "no WhatsApp is claimed");
  assert.match(b.delivery.note, /read receipt/, "and the unknown stays unknown");

  const notif = store.all("notifications").find((n) => n.metadata?.broadcastId === b.broadcast.id);
  assert.ok(notif, "the follower really has a notification row");
  assert.equal(notif.userId, fan.id);

  assert.equal(aud.broadcastsFor(sp.id).length, 1);
  store.insert("spaceBroadcasts", {
    id: "spb_old", spaceId: sp.id, kind: "update", text: "last week",
    createdAt: new Date(Date.now() - 3 * DAY).toISOString(),
    expiresAt: new Date(Date.now() - 2 * DAY).toISOString(), deletedAt: null
  });
  assert.equal(aud.broadcastsFor(sp.id).length, 1, "an expired broadcast is not live");
  assert.equal(aud.broadcastsFor(sp.id, { includeExpired: true }).length, 2, "but it is still history");

  assert.match(aud.postBroadcast(sp.id, { actorId: owner.id, text: "hi", kind: "update" }).error, /act on/, "a one-word broadcast is refused");
  assert.match(aud.postBroadcast(sp.id, { actorId: owner.id, text: "boosted for reach", kind: "boost" }).error, /kind must be one of/);
  assert.equal(aud.postBroadcast(sp.id, { actorId: fan.id, text: "not yours", kind: "update" }).status, 403, "a follower cannot broadcast from someone's shop");
  assert.equal(aud.deleteBroadcast(b.broadcast.id, { actorId: fan.id }).status, 403, "nor delete one");
  assert.equal(aud.deleteBroadcast(b.broadcast.id, { actorId: owner.id }).removed, true);
  assert.equal(aud.broadcastsFor(sp.id).length, 0, "taken down, and the row survives as a tombstone rather than vanishing");
});

await test("templates are the vendor's words, capped, and nobody else's to edit", () => {
  const bad = aud.createTemplate(sp.id, { actorId: owner.id, label: "", body: "hello there" });
  assert.match(bad.error, /short label/);
  for (let i = 0; i < 20; i++) aud.createTemplate(sp.id, { actorId: owner.id, label: `t${i}`, body: `message ${i} is long enough` });
  assert.equal(aud.templatesFor(sp.id).length, aud.TEMPLATE_MAX, "the cap is real");
  assert.equal(aud.templatesFor(sp.id)[0].spaceId, sp.id, "they belong to this space");
  const id = aud.templatesFor(sp.id)[0].id;
  assert.equal(aud.updateTemplate(id, { actorId: other.id, body: "hijacked" }).status, 403);
  assert.equal(aud.updateTemplate(id, { actorId: owner.id, body: "Order confirmed for Saturday 10am" }).template.body, "Order confirmed for Saturday 10am");
  assert.match(aud.updateTemplate(id, { actorId: owner.id, body: "x" }).error, /message itself/);
  assert.equal(aud.deleteTemplate(id, { actorId: owner.id }).removed, true);
});

await test("a pin is the vendor's choice, validated and capped", () => {
  const a = spaces.createSpaceOffer(sp.id, { title: "Six-cup cake", price: 1200, callerId: owner.id });
  const b = spaces.createSpaceOffer(sp.id, { title: "Twelve-cup cake", price: 2600, callerId: owner.id });
  const c = spaces.createSpaceOffer(sp.id, { title: "Cupcakes x 24", price: 3000, callerId: owner.id });
  for (const o of [a, b, c]) spaces.publishSpaceOffer(sp.id, o.id, { callerId: owner.id });
  const strangerOffer = spaces.createSpaceOffer(store.find("spaces", (x) => x.ownerId === other.id).id, { title: "Not yours", price: 10, callerId: other.id });

  assert.throws(() => spaces.setFeatured(sp.id, { callerId: owner.id, listingIds: [a.id, b.id, c.id, strangerOffer.id] }), /at most 3/);
  assert.throws(() => spaces.setFeatured(sp.id, { callerId: owner.id, listingIds: [strangerOffer.id] }), /only your own active offers/);
  assert.throws(() => spaces.setFeatured(sp.id, { callerId: fan.id, listingIds: [a.id] }), /Not authorized/);

  const pinned = spaces.setFeatured(sp.id, { callerId: owner.id, listingIds: [c.id, a.id] });
  assert.deepEqual(pinned.featured, [c.id, a.id], "the vendor's order is kept, not re-sorted by any ranking");

  const card = spaces.findPublicSpace(sp.slug);
  assert.deepEqual(
    card.sampleOffers.map((o) => o.title),
    ["Cupcakes x 24", "Six-cup cake", "Twelve-cup cake"],
    "the public counter leads with the pinned offers, then the rest"
  );
  assert.equal(card.sampleOffers[2].featured, false, "an unpinned offer is explicitly not pinned");
  assert.equal(card.sampleOffers[0].featured, true);
  assert.ok(card.broadcasts.every((x) => x.text !== undefined), "live updates ride along on the public card");
  assert.ok(!("revenueKes" in card) && !("metrics" in card) && !("ownerId" in card), "and no private economics leak");
});

await test("a followed space that goes private leaves the follower's list", () => {
  const before = aud.followedSpaces(fan.id);
  assert.equal(before.length, 1);
  spaces.updateSpace(sp.id, { visibility: "private" }, { callerId: owner.id });
  assert.equal(aud.followedSpaces(fan.id).length, 0, "no stale card is shown");
  spaces.updateSpace(sp.id, { visibility: "public" }, { callerId: owner.id });
  assert.equal(aud.followedSpaces(fan.id).length, 1, "and it returns when the shop reopens");
  assert.equal(aud.followedSpaces(null).length, 0);
});

await test("API: the audience rails are wired, gated, and public only where they should be", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (p, m = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: m, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  try {
    const pub = await call(`/api/public/spaces/${sp.slug}`);
    assert.equal(pub.status, 200, "the shopfront page needs no session — that is the point of a link");
    assert.equal(pub.body.space.slug, "jj-cakes");
    assert.equal(typeof pub.body.space.followers, "number");
    const missing = await call("/api/public/spaces/no-such-shop");
    assert.equal(missing.status, 404, "an unknown slug is not a private space in disguise");

    assert.equal((await call(`/api/spaces/${sp.id}/audience`)).status, 401, "the audience panel needs a session");
    assert.equal((await call(`/api/spaces/${sp.id}/follow`, "POST")).status, 401, "so does following");

    const A = (await call("/api/auth/register", "POST", { handle: "au_api_" + Date.now().toString(36), password: "a good passphrase" })).body;
    const aud1 = await call(`/api/spaces/${sp.id}/audience`, "GET", undefined, A.token);
    assert.equal(aud1.status, 200);
    assert.equal(aud1.body.canManage, false, "a stranger gets no management view");
    assert.equal(aud1.body.insights, null, "and none of the vendor's numbers");
    const noBroadcast = await call(`/api/spaces/${sp.id}/broadcasts`, "POST", { text: "not mine to post", kind: "update" }, A.token);
    assert.equal(noBroadcast.status, 403, "nor the right to broadcast from it");
    const followed = await call(`/api/spaces/${sp.id}/follow`, "POST", {}, A.token);
    assert.equal(followed.status, 200, "but they can follow a public shop");
    assert.equal(followed.body.followers >= 1, true);
    const mineNow = await call("/api/spaces/followed/mine", "GET", undefined, A.token);
    assert.equal(mineNow.status, 200);
    assert.equal(mineNow.body.spaces.length, 1, "and it shows up on their street");
    assert.equal(mineNow.body.spaces[0].slug, "jj-cakes");
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
