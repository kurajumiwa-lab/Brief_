// ---------------------------------------------------------------------------
// FLOWS — the supply board's two axes, the one rule that keeps them honest, and
// the gap read that must never become a scoreboard.
//
// The rule under test: a listing may not call itself bulk (or direct, or group)
// without declaring the endpoints that make it a flow. Everything else about a
// listing is optional, including the flow itself — an untagged listing is
// counted as untagged, and no code path here infers a warehouse, a destination
// or a commodity out of a title.
//
// Also pinned: demand is matched on DECLARED fields only; a private Request can
// never surface on a public board; and no route or gap carries a buyer count, a
// trust score, a rating average or an ETA, because Brief holds nothing that
// could back one.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-flows-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const listings = await import("../src/domain/listing.js");
const flows = await import("../src/domain/flows.js");
const { discoverSummary } = await import("../src/domain/discoverSummary.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const seller = auth.createUser({ handle: "fl_seller", password: "a good passphrase" });
const vendor = store.insert("vendors", {
  id: "vnd_fl", ownerId: seller.id, displayName: "Mwangi Wholesale", status: "active",
  contactMethod: "+254712000111", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
});

const make = (over = {}) => listings.createListing({
  vendorId: vendor.id, title: "Untitled goods", price: 2400, currency: "KES", type: "product", ...over
});

// ---------------------------------------------------------------------------
await test("a flow cannot be claimed without the endpoints that make it a flow", () => {
  assert.throws(() => make({ title: "Tomatoes", flow: "bulk" }), /bulk listing has to name where it leaves from/);
  assert.throws(() => make({ title: "Tomatoes", flow: "bulk", originName: "Wakulima" }), /where it goes/);
  assert.throws(() => make({ title: "Tomatoes", flow: "bulk", destinationName: "Kilimani" }), /leaves from/);
  assert.throws(() => make({ title: "Milk", flow: "direct" }), /name its source/);
  assert.throws(() => make({ title: "Maize", flow: "group" }), /name the pool/);

  // Niche needs no endpoints: a candle maker in Kilimani really has no route.
  const niche = make({ title: "Hand-poured candles", flow: "niche" });
  assert.equal(niche.flow, "niche");
  assert.equal(niche.originName, null, "and nothing was filled in for it");

  // Declaring nothing is a legitimate state, not an error.
  const bare = make({ title: "Second-hand fridge" });
  assert.equal(bare.flow, null);

  // A bad flow label is refused rather than stored as free text.
  assert.throws(() => make({ title: "X", flow: "wholesale" }), /flow must be one of/);
  assert.throws(() => make({ title: "X", flow: "bulk", originName: "A", destinationName: "B", minOrderQuantity: 0 }), /whole number of one or more/);
});

const tomatoes = make({
  title: "Tomatoes, 20 crates", flow: "bulk", originKind: "producer", originName: "Wakulima Market",
  destinationKind: "vendors", destinationName: "Kilimani shops", unitLabel: "crate",
  minOrderQuantity: 5, quantityAvailable: 20, commodity: "tomatoes", price: 2400
});
const rice = make({
  title: "Rice in 50kg sacks", flow: "bulk", originKind: "warehouse", originName: "Ngara",
  destinationKind: "vendors", destinationName: "Kilimani shops", unitLabel: "sack",
  minOrderQuantity: 10, quantityAvailable: 80, commodity: "rice", price: 6800
});
const candles = make({ title: "Candle set of 3", flow: "niche", price: 1800 });
const fridge = make({ title: "Second-hand fridge", price: 18000 });
for (const l of [tomatoes, rice, candles, fridge]) listings.transitionListing(l.id, "active");

await test("routes come only from declared endpoints, and a draft is not a route", () => {
  const draft = make({
    title: "Onions, by the net", flow: "bulk", originName: "Wakulima Market",
    destinationName: "Kilimani shops", commodity: "onions"
  });
  const routes = flows.routesFor("bulk");
  assert.equal(routes.length, 2, "two routes: Wakulima → shops and Ngara → shops");
  const main = routes.find((r) => r.origin === "Wakulima Market");
  assert.equal(main.listings, 1, "the tomatoes listing");
  assert.ok(draft && main.topCommodities.indexOf("onions") === -1, "the draft's commodity is not on the board yet");
  assert.equal(main.minOrderFrom, 5, "the minimum the seller stated, not an invented one");
  assert.equal(main.unit, "crate", "with the unit the seller typed");
  assert.deepEqual(main.topCommodities, ["tomatoes"], "declared commodities only");
  const riceRoute = routes.find((r) => r.origin === "Ngara");
  assert.equal(riceRoute.listings, 1);
  assert.equal(riceRoute.minOrderFrom, 10, "each route carries its own minimum");
  assert.deepEqual(riceRoute.topCommodities, ["rice"]);
});

await test("untagged listings are counted as untagged, never sorted by keyword", () => {
  const s = flows.flowSummary();
  const bulk = s.flows.find((f) => f.key === "bulk");
  const niche = s.flows.find((f) => f.key === "niche");
  assert.equal(bulk.listings, 2, "only what the sellers declared as bulk");
  assert.equal(niche.listings, 1);
  assert.equal(s.untagged, 1, "the fridge declares nothing, so it is untagged");
  assert.match(s.note, /will not infer a supply chain from a title/);
  assert.equal(s.totals.activeListings, 4);
});

await test("demand is matched on stated fields, and private asks never surface", () => {
  const ask = (over = {}) => store.insert("requests", {
    id: over.id, requesterId: "u_buyer", title: "Ask", category: "", quantity: null, unit: "",
    location: "Kilimani shops", status: "open", visibility: "public", revision: 1, history: [], attachments: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...over
  });
  ask({ id: "req_tom", title: "Tomatoes for my three shops", category: "tomatoes", quantity: 6, unit: "crate" });
  ask({ id: "req_rice", title: "Rice sacks for the hotel", category: "rice", quantity: 12, unit: "sack" });
  ask({ id: "req_hidden", title: "Tomatoes quietly", category: "tomatoes", quantity: 2, unit: "crate", visibility: "private" });
  ask({ id: "req_elsewhere", title: "Tomatoes in Nakuru", category: "tomatoes", quantity: 4, unit: "crate", location: "Nakuru" });
  ask({ id: "req_filled", title: "Tomatoes already served", category: "tomatoes", quantity: 3, unit: "crate", status: "ready_for_work", acceptedQuote: { quoteId: "q_x" } });

  const route = flows.routesFor("bulk").find((r) => r.origin === "Wakulima Market");
  assert.equal(route.openDemand, 1, "one open public ask names this commodity and this destination");
  assert.deepEqual(route.openDemandRequestIds, ["req_tom"]);
  assert.equal(route.openDemandQuantity, 6, "and the quantity is the one the buyer typed");
  const riceRoute = flows.routesFor("bulk").find((r) => r.origin === "Ngara");
  assert.equal(riceRoute.openDemand, 1, "the rice ask lands on the route that actually sells rice");
  assert.equal(riceRoute.openDemandQuantity, 12);

  const all = JSON.stringify(flows.routesFor(null, { limit: 50 })) + JSON.stringify(flows.unmappedDemand());
  assert.ok(!all.includes("req_hidden"), "a private request is not demand anyone can browse");
  assert.ok(!all.includes("req_filled"), "an already-answered ask is not an open gap");

  // The Nakuru ask has no route here: it shows up as unmapped, honestly labelled.
  const gaps = flows.unmappedDemand();
  assert.ok(gaps.some((g) => g.requestId === "req_elsewhere" && g.coverage === "no_route_declared"), "uncovered demand is listed as uncovered");
  assert.ok(!gaps.some((g) => g.requestId === "req_tom"), "covered demand is not shown as a gap");
});

await test("a listing with no declared commodity claims no demand", () => {
  const blank = make({ title: "Potatoes, sacks", flow: "bulk", originName: "Gikomba", destinationName: "Kilimani shops" });
  listings.transitionListing(blank.id, "active");
  store.insert("requests", {
    id: "req_pot", requesterId: "u_b2", title: "Potatoes please", category: "potatoes", quantity: 9, unit: "sack",
    location: "Kilimani shops", status: "open", visibility: "public", revision: 1, history: [], attachments: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  const route = flows.routesFor("bulk").find((r) => r.origin === "Gikomba");
  assert.equal(route.listings, 1, "the listing counts");
  assert.equal(route.openDemand, 0, "but no demand is claimed against a route whose seller declared no commodity");
  assert.equal(route.commodityUndeclared, 1, "and the read says which listing is missing it");
});

await test("an edit cannot keep a flow label while stripping the endpoints", () => {
  // Remove the destination from the bulk tomatoes listing: refused.
  assert.throws(() => listings.updateListing(tomatoes.id, { destinationName: "" }), /bulk listing has to name/);
  assert.throws(() => listings.updateListing(tomatoes.id, { flow: "bulk", originName: null }), /leaves from/);
  // Reclassifying to niche is allowed, and drops the endpoints' meaning.
  const moved = listings.updateListing(fridge.id, { flow: "niche" });
  assert.equal(moved.flow, "niche");
  assert.equal(moved.originName ?? null, null);
  // And a bulk listing cannot be quietly demoted to untagged while keeping a
  // destination only — the rule fires on whatever the merged row would be.
  assert.throws(() => listings.updateListing(tomatoes.id, { originName: "   " }), /leaves from/);
});

await test("no route, tile or gap carries an invented buyer, score, ETA or rating", () => {
  const payload = JSON.stringify({
    summary: flows.flowSummary(),
    routes: flows.routesFor(null, { limit: 40 }),
    gaps: flows.unmappedDemand({ limit: 20 })
  });
  const keys = [];
  const walk = (o) => { if (o && typeof o === "object") for (const k of Object.keys(o)) { keys.push(k.toLowerCase()); walk(o[k]); } };
  walk({ summary: flows.flowSummary(), routes: flows.routesFor(null, { limit: 40 }), gaps: flows.unmappedDemand({ limit: 20 }) });
  for (const banned of ["buyerswaiting", "trustscore", "rating", "avg", "score", "eta", "eta", "progresspercent", "speed", "views", "rank", "tier", "popularity", "distancekm"]) {
    assert.ok(!keys.includes(banned), `no ${banned} field exists`);
  }
  assert.ok(!/"etaMins"/.test(payload), "no ETA minutes");
  assert.ok(!payload.includes("unsplash"), "no borrowed photography in the payload");
  assert.ok(!/\+254\d{7,}/.test(JSON.stringify(flows.routesFor(null, { limit: 40 }))), "no phone number on a route");
});

await test("the discover summary carries the board, and every flow tile is labelled from the server", () => {
  const s = discoverSummary({});
  assert.equal(s.flows.length, 4, "four flows, no invented fifth");
  assert.deepEqual(s.flows.map((f) => f.key), ["bulk", "direct", "niche", "group"]);
  assert.ok(s.flows.every((f) => Array.isArray(f.subFilters) && f.subFilters.length > 0), "each flow ships its flat sub-filter strip");
  assert.ok(s.routes.length >= 2, "the declared routes travel with the tiles");
  assert.ok(s.feed.every((item) => "flow" in item && "origin" in item && "destination" in item), "feed cards carry the endpoints");
  const bulkCard = s.feed.find((i) => i.id === tomatoes.id);
  assert.equal(bulkCard.origin, "Wakulima Market");
  assert.equal(bulkCard.destination, "Kilimani shops");
  assert.equal(bulkCard.minOrder, 5);
  assert.equal(bulkCard.unit, "crate");
  assert.equal(bulkCard.commodity, "tomatoes");
  const nicheCard = s.feed.find((i) => i.id === candles.id);
  assert.equal(nicheCard.origin, null, "a niche listing states no route, and the card does not invent one");
  assert.match(s.boardNote, /will not infer a supply chain from a title/, "the board explains its own limits");
  assert.equal(typeof s.untagged, "number");
  assert.equal(s.totals.openPublicDemand >= 2, true, "the demand total is a count, and it is here");
});

await test("an empty flow says WHY it is empty, in the rule's own words", () => {
  const board = flows.flowSummary();
  const total = board.flows.reduce((n, f) => n + f.listings, 0);
  assert.equal(board.scope, "national", "the board is the country's, because there is no area filter");
  assert.equal(board.areaFiltered, false, "and it does not pretend to know where the reader is");
  for (const f of board.flows) {
    assert.ok(Array.isArray(f.requires), `${f.key} states what it demands of a listing`);
    if (f.listings > 0) {
      assert.equal(f.zeroReason, null, "a full flow gets no excuse");
      continue;
    }
    assert.ok(["untagged_only", "other_flows_only", "nothing_on_the_board"].includes(f.zeroReason),
      `an empty ${f.key} flow names its own reason`);
    if (board.untagged > 0 && f.zeroReason !== "other_flows_only") {
      assert.ok(["untagged_only", "other_flows_only"].includes(f.zeroReason),
        "with live listings sitting untagged, an empty flow points at that rather than at nobody");
    }
    if (board.untagged === 0 && total > 0) assert.equal(f.zeroReason, "other_flows_only");
    if (board.untagged === 0 && total === 0) assert.equal(f.zeroReason, "nothing_on_the_board");
  }
});

await test("FLOW_REQUIRES is the same rule listing.js enforces, not a friendlier copy", () => {
  const { FLOW_REQUIRES } = flows;
  for (const f of flows.FLOWS) {
    const need = FLOW_REQUIRES[f.key] ?? [];
    const row = { flow: f.key, title: "anything", originName: null, destinationName: null };
    for (const field of need) row[field] = field === "originName" ? "Wakulima" : "Kilimani shops";
    assert.equal(listings.flowProblem(row), null, `${f.key} is satisfiable with exactly its declared fields`);
    // dropping any one required field must be a problem again
    for (const field of need) {
      const broken = { ...row, [field]: null };
      assert.notEqual(listings.flowProblem(broken), null, `${f.key} still needs ${field}`);
    }
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
