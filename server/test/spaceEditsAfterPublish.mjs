// ---------------------------------------------------------------------------
// EDITING AFTER PUBLISHING — a space is never frozen by going public, and its
// offers keep moving only through the transitions the server allows.
//
// The questions this answers with evidence, not reassurance:
//   * can I rename a public space? does the directory show it, immediately?
//     (the directory is derived per read — there is no copy to update)
//   * can somebody else edit what I published? (no)
//   * can I still maintain the profile answers of a public space? (yes)
//   * if I change an offer's price, does a buyer's already-placed order move?
//     (no: the order keeps the total it was created with)
//   * can I withdraw, and can I un-withdraw? (withdraw is terminal by design,
//     because the ledger refers to what the listing was; re-listing = a new offer)
//   * can a client PATCH a status past the lifecycle table? (status is not a
//     patchable field)
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-space-edits-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const spaces = await import("../src/domain/space.js");
const listings = await import("../src/domain/listing.js");
const profile = await import("../src/domain/spaceProfile.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const owner = auth.createUser({ handle: "ed_owner", password: "a good passphrase" });
const stranger = auth.createUser({ handle: "ed_stranger", password: "a good passphrase" });

const sp = spaces.createSpace({ ownerId: owner.id, name: "Amina Cakes", type: "business", goal: "First 20 customers", targetValueKes: 100000 });
spaces.updateSpace(sp.id, { visibility: "public" }, { callerId: owner.id });

// ---------------------------------------------------------------------------
await test("a public space can be renamed and re-described, and the directory reflects it on the next read", () => {
  const before = spaces.listPublicSpaces(20).find((x) => x.id === sp.id);
  assert.equal(before.name, "Amina Cakes", "it was listed under the old name");

  const updated = spaces.updateSpace(sp.id, { name: "Amina Cake Studio", goal: "200 cakes a month", targetValueKes: null }, { callerId: owner.id });
  assert.equal(updated.name, "Amina Cake Studio");
  assert.equal(updated.targetValueKes, null, "a cleared target is null, not a fabricated 0");

  const after = spaces.listPublicSpaces(20).find((x) => x.id === sp.id);
  assert.equal(after.name, "Amina Cake Studio", "the public card reads the row, so there is no stale copy");
  assert.equal(after.goal, "200 cakes a month");
});

await test("publishing does not hand anyone else the pen", () => {
  assert.throws(
    () => spaces.updateSpace(sp.id, { name: "Hijacked", visibility: "private" }, { callerId: stranger.id }),
    /not authorized/i,
    "a stranger cannot rewrite or un-publish somebody's public space"
  );
  assert.equal(store.find("spaces", (s) => s.id === sp.id).name, "Amina Cake Studio", "and nothing was written");
});

await test("the space file stays maintainable once public, with server timestamps", () => {
  const res = profile.setProfile(sp.id, { callerId: owner.id, fields: { capacity: { value: 40, unit: "kg", per: "day" } } });
  assert.deepEqual(res.changed, ["capacity"]);
  const row = store.find("spaces", (s) => s.id === sp.id);
  assert.equal(row.profile.fields.capacity.value.value, 40);
  assert.ok(Date.now() - Date.parse(row.profile.fields.capacity.updatedAt) < 60_000, "stamped now, by the server");
  assert.equal(row.profile.fields.capacity.updatedBy, owner.id);
  // And a public space's declared facts are what a buyer reads.
  const card = spaces.publicSpaceView(row);
  assert.equal(card.operating.fields.capacity.answer, "40 kg/day");
});

await test("an offer edits after publishing, through its lawful moves only", () => {
  const offer = spaces.createSpaceOffer(sp.id, { title: "Two-tier celebration cake", price: 4500, currency: "KES", callerId: owner.id });
  assert.equal(offer.status, "draft", "an offer starts as a draft");

  const published = spaces.publishSpaceOffer(sp.id, offer.id, { callerId: owner.id });
  assert.equal(published.status, "active", "publishing is a real transition");

  // The price is editable while live — with a reason, and the reason is kept.
  // (Amended 2026-09-20: a published money change now needs `reason` and appends
  // a revision row. The offer stays editable; what it can no longer do is change
  // quietly.)
  const repriced = listings.updateListing(offer.id, { price: 3900, reason: "eggs and flour came down at the market" });
  assert.equal(repriced.price, 3900, "a live offer's price can be changed");
  assert.equal(repriced.status, "active", "and an edit never moves it through the lifecycle");
  {
    const [rev] = listings.revisionsFor(offer.id);
    assert.deepEqual([rev.field, rev.before, rev.after], ["price", 4500, 3900], "the change is on the record with its true before-value");
    assert.equal(rev.reason, "eggs and flour came down at the market", "in the seller's own words");
  }
  assert.throws(() => listings.updateListing(offer.id, { price: 4100 }), /say why/, "a silent repricing is what is gone, not the ability to reprice");

  // ...but a status sent as a content field is not a patchable field at all.
  const sneaky = listings.updateListing(offer.id, { status: "draft" });
  assert.equal(sneaky.status, "active", "status cannot be written by PATCH — the transition table is the only door");

  // Pause is real: the offer stops taking orders while paused, then resumes.
  assert.equal(listings.transitionListing(offer.id, "paused").listing.status, "paused");
  const blocked = listings.orderableReason(store.find("listings", (l) => l.id === offer.id));
  assert.equal(blocked.ok, false, "a paused offer is genuinely not orderable");
  assert.match(blocked.reason, /paused/, "and the reason a buyer sees is the real one");
  assert.equal(listings.transitionListing(offer.id, "active").listing.status, "active");
  assert.equal(listings.orderableReason(store.find("listings", (l) => l.id === offer.id)).ok, true, "resuming makes it orderable again");

  // Withdraw is terminal BY DESIGN, and says why in the refusal.
  assert.equal(listings.transitionListing(offer.id, "archived").listing.status, "archived");
  assert.throws(
    () => listings.transitionListing(offer.id, "active"),
    /invalid listing transition/,
    "a withdrawn offer does not come back, because orders already refer to what it was"
  );
});

await test("a price change after an order never rewrites the order the buyer placed", () => {
  const offer = spaces.createSpaceOffer(sp.id, { title: "Six-cup tray", price: 1200, currency: "KES", quantityAvailable: 10, callerId: owner.id });
  spaces.publishSpaceOffer(sp.id, offer.id, { callerId: owner.id });

  const order = spaces.createSpaceOrder({ spaceId: sp.id, offerId: offer.id, quantity: 3, customerName: "Wanjiku", callerId: owner.id });
  assert.equal(order.total, 3600, "the order carries the total it was created with");

  listings.updateListing(offer.id, { price: 2000, reason: "butter and sugar went up" });
  const stillSame = store.find("orders", (o) => o.id === order.id);
  assert.equal(stillSame.total, 3600, "and the new price does not reach back into it");

  // An archived/paused listing stops taking orders, with a reason a buyer reads.
  // Re-sending the SAME price is not an event: it needs no reason and writes no
  // row — the gate catches changes, not form submissions.
  const beforeNoop = listings.revisionsFor(offer.id).length;
  listings.updateListing(offer.id, { price: 2000 });
  assert.equal(listings.revisionsFor(offer.id).length, beforeNoop, "an unchanged price is not recorded as a change");
  const check = listings.orderableReason(store.find("listings", (l) => l.id === offer.id));
  assert.equal(check.ok, true, "an active offer is still orderable");
  listings.transitionListing(offer.id, "archived");
  const after = listings.orderableReason(store.find("listings", (l) => l.id === offer.id));
  assert.equal(after.ok, false);
  assert.match(after.reason, /archived/, "and the refusal explains itself");
});

await test("deleting a space withdraws its own offers, and leaves history alone", () => {
  const extra = spaces.createSpaceOffer(sp.id, { title: "Goodbye cake", price: 900, callerId: owner.id });
  spaces.publishSpaceOffer(sp.id, extra.id, { callerId: owner.id });
  const victim = store.find("spaces", (s) => s.id === sp.id);
  const ownListingIds = store.filter("listings", (l) => l.spaceId === victim.id).map((l) => l.id);

  const result = spaces.deleteSpace(victim.id, { callerId: owner.id });
  assert.equal(result.removed, true);
  assert.equal(store.find("spaces", (s) => s.id === victim.id), null, "the space row is gone");
  for (const id of ownListingIds) {
    assert.equal(store.find("listings", (l) => l.id === id).status, "archived", "its offers are withdrawn, not deleted");
  }
  // The placed order survives its space being deleted — economic history is append-only.
  const orders = store.filter("orders", (o) => o.spaceId === victim.id);
  assert.ok(orders.length >= 1, "the order record is still there");
  assert.ok(store.filter("spaceActivities", (a) => a.spaceId === victim.id).length >= 1, "and so is its activity trail");
});

console.log(`\nPASS ${count}`);
process.exit(0);
