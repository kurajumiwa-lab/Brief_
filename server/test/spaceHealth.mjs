// ---------------------------------------------------------------------------
// SPACE HEALTH — the operator's activation dashboard. Derived by scanning
// spaces against their real offers/orders; rates are null (not 0) when there
// is nothing to measure. "Activated within 7 days" is the doc's headline:
// the earliest offer sits inside the space's first week.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-spacehealth-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const spaces = await import("../src/domain/space.js");
const analytics = await import("../src/domain/analytics.js");
const listings = await import("../src/domain/listing.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const user = (handle) => auth.createUser({ handle, password: "spacehealth-pw" });

const owner = user("sh_owner");
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

test("with zero spaces, rates are null (unmeasured, not zero)", () => {
  const h = analytics.dashboard().spaces;
  assert.equal(h.total, 0);
  assert.equal(h.activationRate, null);
  assert.equal(h.activationRate7d, null);
  assert.equal(h.economicRate, null);
});

test("a space with an offer is activated; without is not", () => {
  const withOffer = spaces.createSpace({ ownerId: owner.id, name: "Activated" });
  spaces.createSpaceOffer(withOffer.id, { title: "Cakes", price: 500, callerId: owner.id });

  const empty = spaces.createSpace({ ownerId: owner.id, name: "Bare" });

  const h = analytics.dashboard().spaces;
  assert.equal(h.total, 2, "two spaces created in this test");
  assert.equal(h.withOffer, 1);
  assert.equal(h.activationRate, 1 / 2, "one of two active spaces has an offer");
});

test("an archived offer does not count as activation", () => {
  const s = spaces.createSpace({ ownerId: owner.id, name: "Archived Offer" });
  const offer = spaces.createSpaceOffer(s.id, { title: "Old goods", price: 100, callerId: owner.id });
  // Archive the listing directly (terminal), so it must stop counting.
  store.update("listings", offer.id, { status: "archived" });

  const h = analytics.dashboard().spaces;
  const withOffer = h.withOffer;
  assert.equal(
    store.filter("spaces", (x) => x.name === "Archived Offer").length === 1 && withOffer === 1,
    true,
    "archived offer does not add to withOffer"
  );
});

test("activation within 7 days is the earliest offer inside the first week", () => {
  const fast = spaces.createSpace({ ownerId: owner.id, name: "Fast" });
  spaces.createSpaceOffer(fast.id, { title: "Quick", price: 200, callerId: owner.id });

  const slow = spaces.createSpace({ ownerId: owner.id, name: "Slow" });
  // Backdate the space so an offer added NOW lands outside its first week.
  store.update("spaces", slow.id, { createdAt: daysAgo(30) });
  spaces.createSpaceOffer(slow.id, { title: "Late", price: 200, callerId: owner.id });

  const h = analytics.dashboard().spaces;
  assert.ok(h.activatedWithin7d >= 1, "the fast space is within-7d activated");
  // The slow space (offer 30 days after creation) must NOT be in the 7d count.
  const slowSpace = store.find("spaces", (x) => x.id === slow.id);
  assert.equal(
    Date.parse(store.filter("listings", (l) => l.spaceId === slow.id)[0].createdAt) - Date.parse(slowSpace.createdAt) <= 7 * 86400000,
    false,
    "the slow space's offer is outside its first week"
  );
});

test("economic activity counts spaces with at least one order", () => {
  const buyer = user("sh_buyer");
  const s = spaces.createSpace({ ownerId: owner.id, name: "Selling" });
  const offer = spaces.createSpaceOffer(s.id, { title: "Widget", price: 300, callerId: owner.id });
  const listing = store.find("listings", (l) => l.id === offer.id);
  listings.transitionListing(listing.id, "active");
  // The space's OWN order flow (the "Create Order" button) stamps spaceId.
  spaces.createSpaceOrder({
    spaceId: s.id, offerId: listing.id, customerId: buyer.id, customerName: "Buyer", quantity: 1, callerId: owner.id
  });

  const h = analytics.dashboard().spaces;
  assert.ok(h.withOrder >= 1, "a space with an order is economically active");
  assert.equal(typeof h.economicRate, "number");
});

console.log(`\nPASS ${count}`);
process.exit(0);
