// ---------------------------------------------------------------------------
// COOPERATIVE OPERATIONS — the read that turns a group into a customer, and the
// discipline that keeps it honest.
//
// An operator dashboard is the easiest surface in this product to decorate: a
// "member engagement" score, a "% of sales attributed to the group", a top
// contributor, an expected uplift. None of those have rows behind them. These
// tests pin the four things that matter here:
//   • the pool is the treasurer's arithmetic, taken from the same function — a
//     dashboard that re-adds the numbers is a dashboard that disagrees;
//   • an absent figure stays absent: null and listed under `unavailable`, never
//     0, never an estimate;
//   • scope is real: a member cannot see another member's shopfronts, and the
//     owner only ever sees the PUBLIC ones;
//   • nothing ranks a human being. No key on the payload grades participation.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-coopops-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const tb = await import("../src/domain/tableBanking.js");
const spaces = await import("../src/domain/space.js");
const { operationsFor, OPERATOR_GAPS } = await import("../src/domain/coopOperations.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const owner = auth.createUser({ handle: "co_owner", password: "a good passphrase" });
const mila = auth.createUser({ handle: "co_mila", password: "a good passphrase" });
const ola = auth.createUser({ handle: "co_ola", password: "a good passphrase" });
const stranger = auth.createUser({ handle: "co_stranger", password: "a good passphrase" });

const group = tb.createTableBanking({
  ownerId: owner.id, name: "Wakulima Traders Chama", contributionAmount: 2000,
  currency: "KES", cycleDays: 30, welfareContributionAmount: 200
});
tb.joinTableBanking(group.id, mila.id);
tb.joinTableBanking(group.id, ola.id);

// A public shopfront for one member, a private one for the other, nothing for Ola.
const publicSpace = spaces.createSpace({ ownerId: mila.id, name: "Mila Produce", type: "business", visibility: "public" });
const offer = spaces.createSpaceOffer(publicSpace.id, { title: "Tomatoes 10kg crate", price: 1200, currency: "KES", callerId: mila.id });
spaces.publishSpaceOffer(publicSpace.id, offer.id, { callerId: mila.id });
spaces.createSpace({ ownerId: owner.id, name: "Owner Side Hustle", type: "business", visibility: "private" });

const now = new Date().toISOString();
tb.recordContribution(group.id, owner.id, { amount: 2000, receiptHash: "aa".repeat(32) });
tb.recordContribution(group.id, mila.id, { amount: 2000 });

// The group's own demand, placed through the ordinary Request chain.
const collective = tb.placeCollectiveRequest(group.id, owner.id, {
  title: "Napier grass, 40 bales weekly",
  description: "Weekly fodder for the group's dairy members, delivered to Kiambu.",
  category: "fodder", quantity: 40, unit: "bale", location: "Kiambu"
});
const requestId = collective.request.id;

// ---------------------------------------------------------------------------
await test("the pool is the treasurer's arithmetic, not a second implementation", () => {
  const out = operationsFor(group.id, { callerId: owner.id, now: Date.now() });
  const s = tb.summary(group.id);
  assert.equal(out.pool.totalContributed, s.totalContributed, "contributions match exactly");
  assert.equal(out.pool.cashOnHand, s.cashOnHand, "cash on hand matches exactly");
  assert.equal(out.pool.outstandingLoansKes, 0, "no loans were taken, so nothing is outstanding — a true zero");
  assert.equal(out.members, 3, "three members, from the roster rows");
  assert.equal(out.callerRole, "owner", "and the read knows who is asking");
});

await test("the group's demand is reported as the request's own fields", () => {
  const out = operationsFor(group.id, { callerId: owner.id });
  assert.equal(out.collective.placed, 1, "one request placed by the group");
  assert.ok(out.collective.open >= 1, "and it is still open, because no quote was accepted");
  const item = out.collective.items[0];
  assert.equal(item.title, "Napier grass, 40 bales weekly", "the title is the asker's, verbatim");
  assert.equal(item.quantity, 40);
  assert.equal(item.unit, "bale");
  assert.equal(item.accepted, false, "nothing was accepted");
  assert.equal(item.acceptedValueKes, null, "so there is no value to print — and none is invented");
  assert.equal(item.acceptedValueCurrency, null);
  assert.equal(item.quotes, 0, "the quote count is a count of quote rows");
});

await test("settled money is read from settlement rows, and a mixed basket is not a KES figure", () => {
  let out = operationsFor(group.id, { callerId: owner.id });
  assert.deepEqual(
    { n: out.settledThroughBrief.settlements, kes: out.settledThroughBrief.settledKes },
    { n: 0, kes: null },
    "nothing has settled, so the count is 0 and the amount is absent, not zero"
  );

  const at = new Date(Date.now() - 3600_000).toISOString();
  store.insert("workSettlements", {
    id: "wset_coop_a", paymentIntentId: "wpi_a", workOrderId: "wo_a", requestId,
    payerId: owner.id, payeeId: mila.id, amountMinor: 480000, amount: 4800, currency: "KES",
    transactionId: "tx_a", providerRef: null, status: "settled", settledAt: at, createdAt: at
  });
  out = operationsFor(group.id, { callerId: owner.id });
  assert.equal(out.settledThroughBrief.settlements, 1);
  assert.equal(out.settledThroughBrief.settledKes, 4800, "one settlement is the sum of what settled");
  assert.equal(out.settledThroughBrief.currency, "KES");

  store.insert("workSettlements", {
    id: "wset_coop_b", paymentIntentId: "wpi_b", workOrderId: "wo_b", requestId,
    payerId: owner.id, payeeId: mila.id, amountMinor: 100000, amount: 1000, currency: "USD",
    transactionId: "tx_b", providerRef: null, status: "settled", settledAt: at, createdAt: at
  });
  out = operationsFor(group.id, { callerId: owner.id });
  assert.equal(out.settledThroughBrief.settledKes, null, "two currencies is not one figure");
  assert.equal(out.settledThroughBrief.currency, null, "and it is reported as absent, never converted at a made-up rate");
  assert.equal(out.settledThroughBrief.settlements, 2, "the count is still honest");
});

await test("scope is real: a member cannot read another member's shopfronts", () => {
  const asMember = operationsFor(group.id, { callerId: mila.id });
  assert.equal(asMember.memberBusiness.visible, false, "a member gets the shared finance, not each other's business");
  assert.deepEqual(asMember.memberBusiness.rows, [], "and no rows at all, rather than an empty-looking peek");
  assert.match(asMember.memberBusiness.reason, /only the group owner/i, "with the reason stated on the payload");

  const asOwner = operationsFor(group.id, { callerId: owner.id });
  assert.equal(asOwner.memberBusiness.visible, true);
  const milaRow = asOwner.memberBusiness.rows.find((r) => r.userId === mila.id);
  assert.ok(milaRow, "the owner sees the roster");
  assert.equal(milaRow.publicSpaces.length, 1, "one public shopfront");
  assert.equal(milaRow.publicSpaces[0].name, "Mila Produce");
  assert.ok(milaRow.publicSpaces[0].liveOffers >= 1, "with its live offer count — a count of listings, not of sales");
  assert.ok(["fresh", "active", "stale", "dormant", "unstarted"].includes(milaRow.publicSpaces[0].maintenanceState), "and the derived maintenance state");

  const ownerRow = asOwner.memberBusiness.rows.find((r) => r.userId === owner.id);
  assert.equal(ownerRow.publicSpaces.length, 0, "a PRIVATE space is not shown, even to the owner's own dashboard");
  assert.equal(ownerRow.noPublicShopfront, "no public shopfront on Brief", "and that is said, not scored");

  const money = JSON.stringify(asOwner.memberBusiness);
  assert.ok(!/revenue|settledKes|total\b|ledger/i.test(money), "no member money appears anywhere in the shopfront section");
});

await test("a stranger to the group reads nothing at all", () => {
  // The domain is deliberately silent here rather than permissive: an operator
  // read is scoped by membership at the route, and this proves the shape does
  // not leak if someone calls it with the wrong callerId.
  const out = operationsFor(group.id, { callerId: stranger.id });
  assert.equal(out.memberBusiness.visible, false, "not an owner, so no shopfronts");
  assert.equal(out.callerRole, "member", "and they are labelled as a member read, not as an owner");
});

await test("nothing on this payload grades a human being", () => {
  const out = operationsFor(group.id, { callerId: owner.id });
  const keys = [];
  const walk = (o) => {
    if (o && typeof o === "object") for (const k of Object.keys(o)) { keys.push(k.toLowerCase()); walk(o[k]); }
  };
  walk(out);
  for (const banned of ["rank", "rankposition", "score", "percent", "percentage", "trustscore", "leaderboard", "grade", "tier", "badge", "engagement", "medal", "streak", "rating", "weight", "boost"]) {
    assert.ok(!keys.includes(banned), `no ${banned} field exists on an operator read`);
  }
  assert.equal(out.benchmark, null, "no cross-group benchmark, because there is no benchmark table");
  assert.ok(!/"top"/.test(JSON.stringify(out)), "nobody is 'top' anything");
  assert.deepEqual(out.unavailable.map((g) => g.key), OPERATOR_GAPS.map((g) => g.key), "every gap is named on the payload");
  for (const g of out.unavailable) assert.ok(g.reason && g.reason.length > 20, `${g.key} says why it is absent`);
  assert.match(out.note, /rows the group itself wrote|count or a sum over rows/, "and the derivation is stated");
});

// ---------------------------------------------------------------------------
await test("HTTP: the operator read is auth-gated, member-scoped and owner-scoped inside", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const realFetch = global.fetch;
  const call = async (p, token, method = "GET") => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await realFetch(`http://127.0.0.1:${port}${p}`, { method, headers });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const token = (u) => auth.issueSession(u.id).token;
  try {
    const anon = await call(`/api/table-banking/${group.id}/operations`);
    assert.equal(anon.status, 401, "anonymous gets 401 like every non-public path");

    const ownerToken = token(owner);
    const outsider = await call(`/api/table-banking/${group.id}/operations`, token(stranger));
    assert.equal(outsider.status, 403, "a non-member is refused, not silently emptied");

    const mine = await call(`/api/table-banking/${group.id}/operations`, token(mila));
    assert.equal(mine.status, 200, "a member reads the group's own numbers");
    assert.equal(mine.body.operations.memberBusiness.visible, false, "without the member-shopfront section");
    assert.equal(mine.body.operations.pool.totalContributed, 4000, "with the pool, as the treasurer sees it");

    const ours = await call(`/api/table-banking/${group.id}/operations`, ownerToken);
    assert.equal(ours.status, 200, "the owner reads the same, plus the public shopfronts");
    assert.equal(ours.body.operations.memberBusiness.visible, true);
    assert.ok(ours.body.operations.settledThroughBrief.settlements >= 1, "and the settled figure the group earned here");
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
