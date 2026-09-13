// ---------------------------------------------------------------------------
// PRICE SIGNALS — average listed prices, derived from real ACTIVE listing
// rows. A snapshot, not a market index or a trend. Types with no active
// listings are omitted (never shown as zero). Public read.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-pricesig-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const priceSignals = await import("../src/domain/priceSignals.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const user = (handle) => auth.createUser({ handle, password: "pricesig-pw" });

const owner = user("ps_owner");
const now = () => new Date().toISOString();

function listing(over = {}) {
  store.insert("listings", {
    id: over.id ?? new Date().getTime().toString(36) + Math.random().toString(36).slice(2, 6),
    vendorId: "v1",
    title: "x",
    description: "",
    type: "product",
    price: 100,
    currency: "KES",
    quantityAvailable: null,
    locationName: null,
    objectId: null,
    media: [],
    status: "active",
    createdAt: now(),
    updatedAt: now(),
    ...over
  });
}

test("only ACTIVE listings are averaged; drafts/archived are excluded", () => {
  listing({ type: "product", price: 100 });
  listing({ type: "product", price: 300 });
  listing({ type: "product", price: 200, status: "draft" });   // excluded
  listing({ type: "product", price: 9999, status: "archived" }); // excluded

  const s = priceSignals.priceSignals().signals.find((x) => x.type === "product");
  assert.equal(s.count, 2, "two active products");
  assert.equal(s.minPrice, 100);
  assert.equal(s.maxPrice, 300);
  assert.equal(s.avgPrice, 200);
});

test("types with no active listings are omitted, not zeroed", () => {
  // Only a product was listed above; service/experience/event have nothing.
  const signals = priceSignals.priceSignals().signals;
  assert.equal(signals.length, 1, "only the product type appears");
  assert.equal(signals[0].type, "product");
});

test("min, max and average are recomputed from real rows", () => {
  listing({ type: "service", price: 500 });
  listing({ type: "service", price: 1500 });
  listing({ type: "service", price: 1000 });
  const s = priceSignals.priceSignals().signals.find((x) => x.type === "service");
  assert.equal(s.count, 3);
  assert.equal(s.minPrice, 500);
  assert.equal(s.maxPrice, 1500);
  assert.equal(s.avgPrice, 1000);
});

test("the note states the honest limitation (snapshot, not a trend)", () => {
  const out = priceSignals.priceSignals();
  assert.match(out.note, /not a market index or a trend/i);
  assert.match(out.note, /snapshot/i);
});

// ---------------------------------------------------------------------------
// HTTP — public, like listing browse.
// ---------------------------------------------------------------------------
test("API: GET /api/price-signals is public", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const r = await fetch(`http://127.0.0.1:${port}/api/price-signals`);
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(body.signals));
  srv.close();
});

console.log(`\nPASS ${count}`);
process.exit(0);
