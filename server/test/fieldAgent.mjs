import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-fa-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  fa = await import("../src/domain/fieldAgent.js"),
  vendors = await import("../src/domain/vendor.js"),
  listings = await import("../src/domain/listing.js"),
  orders = await import("../src/domain/order.js"),
  ledger = await import("../src/domain/ledger.js");
let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "field-agent-password" });

// ---------------------------------------------------------------------------
// Fixtures: a vendor (shop owner), two rival agents, and a buyer.
// ---------------------------------------------------------------------------
const owner = user("fa_owner");
const agent = user("fa_agent");
const rival = user("fa_rival");
const buyer = user("fa_buyer");

const vendor = vendors.createVendor({ ownerId: owner.id, displayName: "Kiko Bakery" });
const listing = listings.createListing({ vendorId: vendor.id, title: "Cake", price: 10000, currency: "KES" });
listings.transitionListing(listing.id, "active");

// Settle an order the honest way: attach a settled ledger transaction. Under
// Decision 5 this is how a shop proves it trades — and it must NOT change what
// the visiting agent is paid.
function settledOrder(buyerId, total) {
  const order = orders.createOrder({ listingId: listing.id, buyerId, quantity: 1 });
  const tx = ledger.createTransaction({ amount: total, type: 'order_payment', description: 'test', counterparty: buyerId });
  // created -> pending -> confirmed -> settled (the only legal path).
  ledger.transitionTransaction(tx.id, 'pending');
  ledger.transitionTransaction(tx.id, 'confirmed');
  ledger.transitionTransaction(tx.id, 'settled');
  orders.attachTransaction(order.id, tx.id);
  orders.transitionOrder(order.id, 'fulfilled');
  return orders.transitionOrder(order.id, 'settled');
}

// ---------------------------------------------------------------------------
// THE ONE NUMBER — Decision 5 (docs/DECISIONS.md). KES 150 flat per approved
// visit, weekly. No rate, no window, no bonus, no multiplier.
// ---------------------------------------------------------------------------
test("the fee is KES 150 flat, and the four old numbers are gone", () => {
  assert.equal(fa.VISIT_FEE_KES, 150, "one number, decided");
  assert.equal(fa.OVERRIDE_RATE, undefined, "the 0.75% rate no longer exists");
  assert.equal(fa.OVERRIDE_MONTHS, undefined, "the 24-month window no longer exists");
  assert.equal(fa.MENU_UPLOAD_BOUNTY, undefined, "the menu-upload bonus no longer exists");
  assert.equal(fa.overrideObligation, undefined, "no derived percentage obligation");
});

// ---------------------------------------------------------------------------
// CLAIMS — attribution, unchanged laws, and no longer payable by themselves.
// ---------------------------------------------------------------------------
test("claimVendor requires a known claim type and a real vendor", () => {
  rejects(() => fa.claimVendor({ agentId: agent.id, vendorId: vendor.id, claimType: "nonsense" }));
  rejects(() => fa.claimVendor({ agentId: agent.id, vendorId: "nope", claimType: "menu_upload" }), "not_found");
});

test("a vendor owner cannot claim their own shop", () => {
  rejects(() => fa.claimVendor({ agentId: owner.id, vendorId: vendor.id, claimType: "full_registration" }), "self_claim");
});

test("a menu_upload claim mints NO bonus — the bounty was a bonus, and bonuses are refused", () => {
  const claim = fa.claimVendor({ agentId: agent.id, vendorId: vendor.id, claimType: "menu_upload" });
  assert.equal(claim.claimType, "menu_upload");
  assert.equal(claim.expiresAt, null, "no window is minted any more");
  // The old path wrote a 100-point referral event here. It must not: pay is
  // the flat visit fee and nothing else.
  const events = store.filter("referralEvents", (e) => e.kind === "menu_upload_bounty" && e.referrerId === agent.id);
  assert.equal(events.length, 0, "no bonus points for a claim");
  assert.equal(fa.visitEarnings(agent.id).approvedKes, 0, "a claim on its own pays nothing");
  // A second menu_upload claim for the same vendor is refused (first-touch).
  rejects(() => fa.claimVendor({ agentId: rival.id, vendorId: vendor.id, claimType: "menu_upload" }), "already_claimed");
});

test("full_registration is first-touch-wins per vendor", () => {
  const claim = fa.claimVendor({ agentId: agent.id, vendorId: vendor.id, claimType: "full_registration" });
  assert.equal(claim.status, "active");
  assert.equal(claim.expiresAt, null, "no 24-month expiry — there is no window to expire");
  assert.equal(fa.vendorClaim(vendor.id).agentId, agent.id);
  // The rival cannot overwrite the active territory.
  rejects(() => fa.claimVendor({ agentId: rival.id, vendorId: vendor.id, claimType: "full_registration" }), "already_claimed");
});

// ---------------------------------------------------------------------------
// VISITS — the payable act.
// ---------------------------------------------------------------------------
test("recordVisit requires a real vendor, a known purpose and the agent's own words", () => {
  rejects(() => fa.recordVisit({ agentId: agent.id, vendorId: "nope", notes: "Walked in, spoke to the owner" }), "not_found");
  rejects(() => fa.recordVisit({ agentId: agent.id, vendorId: vendor.id, purpose: "nonsense", notes: "Walked in, spoke to the owner" }));
  rejects(() => fa.recordVisit({ agentId: agent.id, vendorId: vendor.id, purpose: "menu_upload", notes: "short" }), "validation_error");
  const v = fa.recordVisit({ agentId: agent.id, vendorId: vendor.id, purpose: "menu_upload", notes: "Photographed the menu board and confirmed the stall number with the owner." });
  assert.equal(v.status, "pending", "a visit arrives pending — it is not payable yet");
  assert.equal(v.decidedAt, null);
  assert.ok(!("feeKes" in v) && !("week" in v), "the row stores no fee and no week: both are derived");
});

test("a vendor owner is not paid to visit their own shop", () => {
  rejects(() => fa.recordVisit({ agentId: owner.id, vendorId: vendor.id, purpose: "full_registration", notes: "I own this shop and visited it today." }), "self_visit");
});

test("one paid visit per shop per purpose — the fee is not a meter", () => {
  rejects(() => fa.recordVisit({ agentId: agent.id, vendorId: vendor.id, purpose: "menu_upload", notes: "Second attempt at the same door for the same purpose." }), "already_visited");
  // A different purpose at the same shop is a different act.
  const full = fa.recordVisit({ agentId: agent.id, vendorId: vendor.id, purpose: "full_registration", notes: "Completed the full registration with the owner present." });
  assert.equal(full.status, "pending");
});

test("a pending visit earns nothing; an approved visit earns exactly KES 150", () => {
  const before = fa.visitEarnings(agent.id);
  assert.equal(before.pending, 2, "two visits waiting");
  assert.equal(before.approved, 0);
  assert.equal(before.approvedKes, 0, "waiting visits pay nothing");

  const pending = before.visits.find((v) => v.purpose === "menu_upload");
  const approved = fa.decideVisit(pending.visitId, { accept: true, decidedBy: owner.id });
  assert.equal(approved.status, "approved");
  assert.ok(approved.decidedAt, "the approval is timestamped");

  const after = fa.visitEarnings(agent.id);
  assert.equal(after.approved, 1);
  assert.equal(after.approvedKes, 150, "KES 150, exactly");
  assert.equal(after.feeKes, 150);
  assert.equal(after.currency, "KES");
  const row = after.visits.find((v) => v.visitId === pending.visitId);
  assert.equal(row.feeKes, 150, "the row prints its own fee");
  assert.equal(row.week, fa.isoWeekOf(approved.decidedAt), "the visit belongs to the week it was APPROVED in");
  assert.match(after.note, /KES 150 per approved visit/i, "the terms are printed beside the money");
});

test("THE ANTI-THROUGHPUT LAW: a shop that trades KES 10,000 pays the same 150 as a shop that trades nothing", () => {
  settledOrder(buyer.id, 10000); // Kiko Bakery now has real settled trade
  const trading = fa.visitEarnings(agent.id);
  assert.equal(trading.approvedKes, 150, "one approved visit at a trading shop = 150");

  // A quiet shop, no orders at all, same fee for the same act.
  const quietOwner = user("fa_quiet_owner");
  const quiet = vendors.createVendor({ ownerId: quietOwner.id, displayName: "Quiet Stall" });
  const v = fa.recordVisit({ agentId: rival.id, vendorId: quiet.id, purpose: "full_registration", notes: "Walked the stall, took the owner's details and the location." });
  fa.decideVisit(v.id, { accept: true, decidedBy: owner.id });
  assert.equal(fa.visitEarnings(rival.id).approvedKes, 150, "one approved visit at a quiet shop = 150");
  assert.equal(fa.visitEarnings(rival.id).visits[0].feeKes, 150);
});

test("a rejected visit pays nothing, carries its reason, and may be tried again", () => {
  const v = fa.recordVisit({ agentId: rival.id, vendorId: vendor.id, purpose: "menu_upload", notes: "Visited Kiko Bakery and photographed the menu board." });
  rejects(() => fa.decideVisit(v.id, { accept: false, note: "no" }), "validation_error"); // a reason is required
  const rejected = fa.decideVisit(v.id, { accept: false, note: "The shop was closed; nobody was seen.", decidedBy: owner.id });
  assert.equal(rejected.status, "rejected");
  assert.match(rejected.rejectReason, /closed/);
  assert.equal(fa.visitEarnings(rival.id).rejected, 1);
  assert.equal(fa.visitEarnings(rival.id).approvedKes, 150, "a rejection adds nothing to the money");
  // Terminal states are final, so a week's count cannot move after settlement.
  rejects(() => fa.decideVisit(v.id, { accept: true }), "invalid_state");
  rejects(() => fa.decideVisit(v.id, { accept: false, note: "changed my mind about it" }), "invalid_state");
  // The door is not banned: the agent may submit that visit again.
  const again = fa.recordVisit({ agentId: rival.id, vendorId: vendor.id, purpose: "menu_upload", notes: "Returned on market day; owner present, menu board photographed." });
  assert.equal(again.status, "pending");
});

// ---------------------------------------------------------------------------
// ONBOARD VENDOR — the agent brings a shop into Brief + claims it + records the
// visit the act is, atomically.
// ---------------------------------------------------------------------------
test("onboardVendor creates the vendor, the territory claim AND a pending visit", () => {
  const rider = user("fa_rider2");
  const result = fa.onboardVendor({
    agentId: rider.id, displayName: "Mama Njeri Grocers",
    businessType: "retailer", location: "Gikomba Market, Stall 12",
    contactMethod: "0712 345678", contactName: "Mama Njeri", claimType: "full_registration"
  });
  assert.ok(result.vendor.id, "a vendor was created");
  assert.equal(result.vendor.ownerId, rider.id, "the onboarded shop is held by the agent");
  assert.equal(result.vendor.businessType, "retailer", "business type is stored");
  assert.equal(result.vendor.location, "Gikomba Market, Stall 12", "physical location is stored");
  assert.equal(result.vendor.contactName, "Mama Njeri", "the direct contact name is stored");
  assert.equal(result.vendor.contactMethod, "0712 345678", "the direct contact phone is stored");
  assert.equal(result.claim.claimType, "full_registration");
  assert.equal(result.claim.agentId, rider.id);
  assert.equal(result.claim.status, "active");
  assert.equal(result.claim.expiresAt, null, "no window is minted");
  assert.equal(fa.vendorClaim(result.vendor.id)?.agentId, rider.id);
  // The onboarding IS a visit: pending, and payable only if approved.
  assert.equal(result.visit.status, "pending");
  assert.equal(result.visit.purpose, "full_registration");
  assert.equal(fa.visitEarnings(rider.id).approvedKes, 0, "onboarding alone pays nothing");
  // The direct contact the agent captured rides along on the earnings rows.
  const row = fa.visitEarnings(rider.id).visits.find((v) => v.vendorId === result.vendor.id);
  assert.equal(row.contactName, "Mama Njeri", "earnings rows carry the direct contact name");
  assert.equal(row.contactMethod, "0712 345678", "earnings rows carry the direct contact phone");
  assert.equal(row.vendorName, "Mama Njeri Grocers");
});

test("onboardVendor refuses a shell shop (no type / no location) and a duplicate claim", () => {
  const rider = user("fa_rider3");
  rejects(() => fa.onboardVendor({ agentId: rider.id, displayName: "", claimType: "menu_upload" }), "validation_error");
  // Anti-fraud: a shop needs a business type and a physical location. Under
  // Decision 5 a shell shop is also a KES 150 claim, so this gate carries the
  // whole honesty of the fee.
  rejects(() => fa.onboardVendor({ agentId: rider.id, displayName: "Shell", location: "Market" }), "validation_error");
  rejects(() => fa.onboardVendor({ agentId: rider.id, displayName: "Shell", businessType: "retailer" }), "validation_error");
  const first = fa.onboardVendor({ agentId: rider.id, displayName: "Stall A", businessType: "retailer", location: "Wakulima Market", claimType: "full_registration" });
  assert.equal(first.visit.status, "pending");
  // full_registration is first-touch-wins per vendor.
  rejects(() => fa.onboardVendor({ agentId: rider.id, displayName: "Stall A", businessType: "retailer", location: "Wakulima Market", claimType: "full_registration" }), "already_claimed");
});

// ---------------------------------------------------------------------------
// WEEKLY SETTLEMENT — the only place a visit fee becomes money.
// ---------------------------------------------------------------------------
test("earnings group approved visits into the weeks they were approved in", () => {
  const earn = fa.visitEarnings(agent.id);
  assert.equal(earn.weeks.length, 1, "one week of approved work");
  assert.match(earn.weeks[0].week, /^\d{4}-W\d{2}$/, "the week is a real ISO week key");
  assert.equal(earn.weeks[0].visits, 1);
  assert.equal(earn.weeks[0].kes, 150, "the week's money is 150 x the approved count");
  assert.equal(earn.weeks[0].settlementId, null, "not settled yet");
  assert.equal(earn.unsettledKes, 150);
});

test("requestWeeklySettlement refuses a malformed week and a week with no approved visits", () => {
  rejects(() => fa.requestWeeklySettlement(agent.id, "last week"), "validation_error");
  rejects(() => fa.requestWeeklySettlement(agent.id, null), "validation_error");
  const agent2 = user("fa_agent2");
  rejects(() => fa.requestWeeklySettlement(agent2.id, fa.isoWeekOf(new Date().toISOString())), "no_activity");
  const earn = fa.visitEarnings(agent.id);
  rejects(() => fa.requestWeeklySettlement(agent.id, "2001-W02"), "no_activity");
  assert.equal(earn.weeks.length, 1);
});

test("requestWeeklySettlement writes ONE pending tx of 150 x approved visits", () => {
  const week = fa.visitEarnings(agent.id).weeks[0].week;
  const s = fa.requestWeeklySettlement(agent.id, week);
  assert.equal(s.status, "pending");
  assert.equal(s.week, week);
  assert.equal(s.periodKey, `${agent.id}:${week}`);
  assert.equal(s.visits, 1);
  assert.equal(s.feeKes, 150);
  assert.equal(s.amountKes, 150);
  const tx = store.find("ledgerTransactions", (t) => t.id === s.ledgerId);
  assert.equal(tx.type, "field_agent_visit_fee");
  assert.equal(tx.amount, 150);
  assert.equal(tx.status, "pending");
  assert.equal(tx.counterparty, agent.id);
  assert.equal(tx.metadata.visits, 1, "the ledger row carries the count it was derived from");
  assert.equal(tx.metadata.feeKes, 150);
  // One settlement per agent per week.
  rejects(() => fa.requestWeeklySettlement(agent.id, week), "duplicate_settlement");
  // The week is now marked as having a settlement, derived from the row.
  assert.equal(fa.visitEarnings(agent.id).weeks[0].settlementStatus, "pending");
});

test("confirmVisitSettlement settles the ledger; a second confirmation is refused", () => {
  const pending = store.find("fieldAgentSettlements", (s) => s.agentId === agent.id && s.status === "pending");
  const confirmed = fa.confirmVisitSettlement(pending.id, { accept: true, confirmedBy: owner.id });
  assert.equal(confirmed.status, "confirmed");
  assert.ok(confirmed.confirmedAt);
  assert.equal(confirmed.confirmedBy, owner.id, "who confirmed it is recorded");
  assert.equal(store.find("ledgerTransactions", (t) => t.id === pending.ledgerId).status, "confirmed");
  rejects(() => fa.confirmVisitSettlement(pending.id, { accept: true }), "invalid_state");
  assert.equal(fa.visitEarnings(agent.id).unsettledKes, 0, "a settled week is no longer unsettled");
});

test("a refused settlement writes no money, marks the ledger failed, and frees the week", () => {
  const week = fa.visitEarnings(rival.id).weeks[0].week;
  const s = fa.requestWeeklySettlement(rival.id, week);
  assert.equal(s.amountKes, 150);
  rejects(() => fa.confirmVisitSettlement(s.id, { accept: false, note: "no" }), "validation_error"); // say why
  const refused = fa.confirmVisitSettlement(s.id, { accept: false, note: "the visit could not be verified" });
  assert.equal(refused.status, "refused");
  assert.equal(store.find("ledgerTransactions", (t) => t.id === s.ledgerId).status, "failed");
  // A refused settlement is not a claim on the week: it can be requested again.
  const again = fa.requestWeeklySettlement(rival.id, week);
  assert.equal(again.status, "pending");
  assert.notEqual(again.id, s.id);
});

test("nothing is stored as a balance — earnings are recomputed from the rows", () => {
  const rider = user("fa_rider4");
  const shopOwner = user("fa_shop_owner4");
  const shop = vendors.createVendor({ ownerId: shopOwner.id, displayName: "Fourth Stall" });
  const before = fa.visitEarnings(rider.id);
  assert.equal(before.approvedKes, 0);
  assert.equal(store.filter("fieldVisits", (v) => v.agentId === rider.id).length, 0);
  const v = fa.recordVisit({ agentId: rider.id, vendorId: shop.id, purpose: "menu_upload", notes: "Met the owner, checked the stall exists, took the menu." });
  fa.decideVisit(v.id, { accept: true });
  const after = fa.visitEarnings(rider.id);
  assert.equal(after.approvedKes, 150, "one approved row = 150, recomputed on read");
  const row = store.find("fieldVisits", (x) => x.id === v.id);
  assert.equal(row.feeKes, undefined, "the stored row carries no fee");
  assert.equal(row.week, undefined, "the stored row carries no week");
});

// ---------------------------------------------------------------------------
// HTTP — capability gating.
// ---------------------------------------------------------------------------
{
  const appMod = await import("../src/index.js");
  const app = appMod.default;
  const srv = app.listen(0);
  const port = srv.address().port;
  const tokenOf = (u) => auth.login({ handle: u.handle, password: "field-agent-password" }).token;
  const agentToken = tokenOf(agent),
    rivalToken = tokenOf(rival),
    ownerToken = tokenOf(owner),
    buyerToken = tokenOf(buyer);
  const call = async (pathName, method = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  }
  try {
    const anon = await call(`/api/vendors/${vendor.id}/claim`);
    assert.equal(anon.status, 401);
    count++; console.log("PASS API: claim read requires authentication");

    const selfClaim = await call(`/api/vendors/${vendor.id}/claims`, "POST", { claimType: "full_registration" }, ownerToken);
    assert.equal(selfClaim.status, 409);
    count++; console.log("PASS API: a vendor owner is refused the self-claim");

    const mine = await call("/api/me/field-agent", "GET", undefined, agentToken);
    assert.equal(mine.status, 200);
    assert.ok(Array.isArray(mine.body.claims));
    assert.ok(Array.isArray(mine.body.visits), "the agent reads their own visits");
    assert.equal(mine.body.earnings.feeKes, 150, "the one number is published");
    assert.equal(typeof mine.body.earnings.approvedKes, "number");
    assert.equal(mine.body.override, undefined, "the override economy is not served any more");
    count++; console.log("PASS API: a member reads their own claims, visits and derived earnings");

    // A visit is recorded over HTTP and arrives pending.
    const recorded = await call("/api/me/field-agent/visits", "POST", {
      vendorId: vendor.id, purpose: "menu_upload", notes: "nope"
    }, rivalToken);
    assert.equal(recorded.status, 400, "a visit with no real evidence is refused");
    assert.match(recorded.body.error, /say what you saw/i, "and the refusal says what is missing");
    const quietOwner = user("fa_http_quiet");
    const quietVendor = vendors.createVendor({ ownerId: quietOwner.id, displayName: "HTTP Stall" });
    const ok = await call("/api/me/field-agent/visits", "POST", {
      vendorId: quietVendor.id, purpose: "menu_upload", notes: "Met the owner at the stall and photographed the price list."
    }, rivalToken);
    assert.equal(ok.status, 201);
    assert.equal(ok.body.visit.status, "pending");
    count++; console.log("PASS API: a visit is recorded over HTTP and arrives pending");

    // Approving a visit is an operator act, not a member act.
    const approveDenied = await call(`/api/ops/field-agent-visits/${ok.body.visit.id}/approve`, "POST", {}, agentToken);
    assert.equal(approveDenied.status, 403);
    const visitsDenied = await call("/api/ops/field-agent-visits", "GET", undefined, agentToken);
    assert.equal(visitsDenied.status, 403);
    count++; console.log("PASS API: the visit queue and its decisions are moderate-gated");

    // A plain member cannot read the ops list.
    const opsDenied = await call("/api/ops/field-agents", "GET", undefined, agentToken);
    assert.equal(opsDenied.status, 403);
    count++; console.log("PASS API: the ops claim list is moderate-gated");
  } finally {
    srv.closeAllConnections();
    await new Promise((r) => srv.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\nPASS ${count}`);
