import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-partner-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  att = await import("../src/domain/attribution.js"),
  partner = await import("../src/domain/partner.js"),
  s = await import("../src/domain/supply.js"),
  r = await import("../src/domain/requests.js"),
  m = await import("../src/domain/matching.js"),
  q = await import("../src/domain/quotes.js"),
  w = await import("../src/domain/workOrders.js"),
  ledger = await import("../src/domain/ledger.js");
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log("PASS " + name);
};
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "partner-password" });

// ---------------------------------------------------------------------------
// Real commercial activity, attributed to a partner, so the derived economics
// have something honest to stand on.
// ---------------------------------------------------------------------------
const member = user("pt_member");
const supplier = user("pt_supplier");
const supplierEnt = s.createEnterprise(supplier.id, {
  displayName: "Partner Supplies",
  businessType: "manufacturer",
  supplyRole: "direct_supplier",
  location: "Nairobi",
  serviceAreas: ["Nairobi"],
  publication: "public",
  firstCapability: {
    name: "Partner boxes",
    category: "Packaging",
    supplyMode: "direct",
    capacityKind: "production",
    unit: "pieces",
    leadTime: { minDays: 2, maxDays: 4 },
    serviceAreas: ["Nairobi"]
  }
});
let seq = 0;
function completeWork(requester, quantity) {
  const capId = supplierEnt.capabilities[0].id;
  let req = r.createRequest(requester.id, {
    title: "500 partner boxes", description: "partner economics", quantity, unit: "pieces",
    category: "Packaging", location: "Nairobi", deliveryLocation: "Warehouse",
    requiredBy: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    specifications: { material: "Corrugated" }, visibility: "private", intent: "submit"
  });
  req = r.changeRequestStatus(requester.id, req.id, { status: "matching", revision: req.revision });
  const match = m.list(requester.id, req.id).matches.find((x) => x.participantId === supplierEnt.id);
  const inv = q.requestQuote(requester.id, match.id, { requestRevision: req.revision, matchRevision: match.revision, shareRequirements: true });
  m.expressInterest(supplier.id, match.id, { requestRevision: req.revision, revision: match.revision });
  let quote = q.start(supplier.id, inv.id, { revision: inv.revision });
  quote = q.mutate(supplier.id, quote.id, {
    action: "submit", revision: quote.revision, requestRevision: req.revision,
    idempotencyKey: `pt-quote-key-${++seq}-abcdefghijklmnopqrstuvwxyz`,
    terms: {
      quotedQuantity: quantity, unit: "pieces", unitPriceMinor: 1500, currency: "KES",
      deliveryCostMinor: 100000, sourcingFeeMinor: 0, otherCosts: [],
      productionLeadDays: 3, deliveryLeadDays: 1, sourceType: "direct", specifications: "Partner boxes"
    }
  });
  const currentReq = r.getRequest(requester.id, req.id);
  const accepted = q.mutate(requester.id, quote.id, {
    action: "accept", revision: quote.revision, requestRevision: currentReq.revision,
    idempotencyKey: `pt-accept-key-${++seq}-abcdefghijklmnopqrstuvwxyz`
  });
  let work = w.get(requester.id, accepted.workOrderId);
  const act = (who, row, action) =>
    w.mutate(who.id, row.id, {
      action, revision: row.revision, agreementRevision: row.agreements.at(-1).revision,
      idempotencyKey: `pt-act-key-${++seq}-abcdefghijklmnopqrstuvwxyz`
    });
  work = act(requester, work, "confirm_specifications");
  work = act(supplier, work, "confirm_specifications");
  work = act(supplier, work, "start");
  work = act(supplier, work, "ready");
  work = act(supplier, work, "dispatch");
  work = act(supplier, work, "deliver");
  return act(requester, work, "complete");
}

att.capture(member.id, { partnerKey: "WEF", programKey: "women-enterprise-2026", cohortKey: "nairobi-west", inviteCode: "ABC123" });
completeWork(member, 500); // 500 * KES 15 + KES 1000 delivery = KES 8500 verified commercial activity

// ---------------------------------------------------------------------------
// PARTNER RECORDS
// ---------------------------------------------------------------------------
test("createPartner requires a name and a known partnerType", () => {
  rejects(() => partner.createPartner({ name: "", partnerType: "women_org" }));
  rejects(() => partner.createPartner({ name: "Bank X", partnerType: "lender" }));
});

test("createPartner normalises the key and rejects duplicates", () => {
  const p = partner.createPartner({ name: "Women Enterprise Fund", partnerType: "women_org", key: "WEF" });
  assert.equal(p.key, "wef");
  assert.equal(p.partnerType, "women_org");
  assert.equal(p.status, "active");
  rejects(() => partner.createPartner({ name: "Other WEF", partnerType: "ngo", key: "WEF" }), "duplicate_key");
});

test("a partner with no key derives one from its name", () => {
  const p = partner.createPartner({ name: "Nairobi SACCO", partnerType: "sacco" });
  assert.equal(p.key, "nairobi-sacco");
});

test("programs and cohorts are keyed under their parent", () => {
  const wef = partner.getPartnerByKey("wef");
  const program = partner.createProgram(wef.id, { key: "women-enterprise-2026", name: "Women Enterprise 2026" });
  assert.equal(program.partnerId, wef.id);
  const cohort = partner.createCohort(program.id, { key: "nairobi-west", name: "Nairobi West" });
  assert.equal(cohort.partnerId, wef.id);
  assert.equal(cohort.programId, program.id);
  // Duplicate keys within the same parent are refused.
  rejects(() => partner.createProgram(wef.id, { key: "women-enterprise-2026", name: "Dup" }), "duplicate_key");
  rejects(() => partner.createCohort(program.id, { key: "nairobi-west", name: "Dup" }), "duplicate_key");
});

test("agreement is append-only; only one active agreement per partner", () => {
  const wef = partner.getPartnerByKey("wef");
  const a1 = partner.setAgreement(wef.id, { shareRate: 0.1 });
  const a2 = partner.setAgreement(wef.id, { shareRate: 0.2 });
  assert.equal(a1.shareRate, 0.1);
  assert.equal(a2.shareRate, 0.2);
  const active = partner.activeAgreement(wef.id);
  assert.equal(active.id, a2.id);
  assert.equal(active.shareRate, 0.2);
  // History preserved: two agreement rows, one superseded, one active.
  const all = store.filter("commercialAgreements", (a) => a.partnerId === wef.id);
  assert.equal(all.length, 2);
  assert.equal(all.filter((a) => a.status === "superseded").length, 1);
  // Invalid rate refused.
  rejects(() => partner.setAgreement(wef.id, { shareRate: 1.5 }));
  rejects(() => partner.setAgreement(wef.id, { shareRate: -0.1 }));
});

// ---------------------------------------------------------------------------
// DERIVED ECONOMICS
// ---------------------------------------------------------------------------
test("partnerEconomics derives gross + share from real activity only", () => {
  const wef = partner.getPartnerByKey("wef");
  const eco = partner.partnerEconomics(wef.id);
  assert.equal(eco.members, 1);
  assert.equal(eco.grossKes, 8500);
  assert.equal(eco.shareRate, 0.2); // active agreement is the 0.2 one
  assert.equal(eco.partnerShareKes, 1700); // floor(0.2 * 8500)
  assert.equal(eco.activity.workRequested, 1);
  assert.equal(eco.activity.workFulfilled, 0);
  assert.equal(eco.settlements.confirmedKes, 0);
  assert.match(eco.note, /not money until/i);
});

test("a partner with no agreement reports a null share, not a fabricated one", () => {
  const sacco = partner.getPartnerByKey("nairobi-sacco");
  const eco = partner.partnerEconomics(sacco.id);
  assert.equal(eco.members, 0); // no member arrived through it
  assert.equal(eco.grossKes, 0);
  assert.equal(eco.shareRate, null);
  assert.equal(eco.partnerShareKes, null);
});

test("a partner with no attributed members shows zero, plainly", () => {
  const nobody = partner.createPartner({ name: "Empty Network", partnerType: "network" });
  const eco = partner.partnerEconomics(nobody.id);
  assert.equal(eco.members, 0);
  assert.equal(eco.grossKes, 0);
});

// ---------------------------------------------------------------------------
// SETTLEMENT — the only place partner money becomes real.
// ---------------------------------------------------------------------------
test("requestSettlement snapshots the obligation and writes ONE pending ledger tx", () => {
  const wef = partner.getPartnerByKey("wef");
  const s = partner.requestSettlement(wef.id, { from: "2026-01-01", to: "2026-03-31" });
  assert.equal(s.status, "pending");
  assert.equal(s.grossKes, 8500);
  assert.equal(s.shareRate, 0.2);
  assert.equal(s.shareKes, 1700);
  const tx = store.find("ledgerTransactions", (t) => t.id === s.ledgerId);
  assert.equal(tx.type, "partner_revenue_share");
  assert.equal(tx.amount, 1700);
  assert.equal(tx.status, "pending");
  assert.equal(tx.counterparty, wef.id);
  // Idempotent per period.
  rejects(() => partner.requestSettlement(wef.id, { from: "2026-01-01", to: "2026-03-31" }), "duplicate_settlement");
});

test("confirmSettlement settles the ledger; refusal reverses it honestly", () => {
  const wef = partner.getPartnerByKey("wef");
  const pending = store.find("partnerSettlements", (s) => s.partnerId === wef.id && s.status === "pending");
  const confirmed = partner.confirmSettlement(pending.id, { accept: true });
  assert.equal(confirmed.status, "confirmed");
  assert.ok(confirmed.confirmedAt);
  const tx = store.find("ledgerTransactions", (t) => t.id === pending.ledgerId);
  assert.equal(tx.status, "confirmed");
  // Confirming again is refused (already confirmed).
  rejects(() => partner.confirmSettlement(pending.id, { accept: true }), "invalid_state");
});

test("a refused settlement writes no money and marks the ledger failed", () => {
  // A second partner with real activity, settled then refused.
  const member2 = user("pt_member2");
  att.capture(member2.id, { partnerKey: "NGO-X" });
  completeWork(member2, 100); // 100 * 15 + 1000 = 2500
  const ngo = partner.createPartner({ name: "NGO X", partnerType: "ngo", key: "NGO-X" });
  partner.setAgreement(ngo.id, { shareRate: 0.1 });
  const s = partner.requestSettlement(ngo.id, {});
  assert.equal(s.shareKes, 250); // floor(0.1 * 2500)
  const refused = partner.confirmSettlement(s.id, { accept: false, note: "not this quarter" });
  assert.equal(refused.status, "refused");
  const tx = store.find("ledgerTransactions", (t) => t.id === s.ledgerId);
  assert.equal(tx.status, "failed");
  // A refused settlement does not count toward confirmed economics.
  const eco = partner.partnerEconomics(ngo.id);
  assert.equal(eco.settlements.confirmedKes, 0);
});

test("requestSettlement refuses when there is no agreement or no activity", () => {
  const empty = partner.getPartnerByKey("empty-network");
  rejects(() => partner.requestSettlement(empty.id, {}), "no_agreement");
  // A partner with an agreement but zero activity also refuses.
  const sacco = partner.getPartnerByKey("nairobi-sacco");
  partner.setAgreement(sacco.id, { shareRate: 0.1 });
  rejects(() => partner.requestSettlement(sacco.id, {}), "no_activity");
});

// ---------------------------------------------------------------------------
// INVITE LINK — the distribution primitive.
// ---------------------------------------------------------------------------
test("joinLink builds the deep link from stored keys and carries UTM", () => {
  const wef = partner.getPartnerByKey("wef");
  const link = partner.joinLink(wef.id, { programKey: "women-enterprise-2026", cohortKey: "nairobi-west", origin: "https://brief.example.com" });
  assert.equal(link.available, true);
  assert.ok(link.url.startsWith("https://brief.example.com/join?"));
  assert.match(link.url, /partner=wef/);
  assert.match(link.url, /program=women-enterprise-2026/);
  assert.match(link.url, /cohort=nairobi-west/);
  assert.match(link.url, /utm_source=partner/);
  assert.match(link.url, /utm_campaign=wef/);
});

test("joinLink refuses a program or cohort that does not belong to the partner", () => {
  const wef = partner.getPartnerByKey("wef");
  rejects(() => partner.joinLink(wef.id, { programKey: "does-not-exist", origin: "https://x.example.com" }), "not_found");
  rejects(() => partner.joinLink(wef.id, { cohortKey: "foreign-cohort", origin: "https://x.example.com" }), "not_found");
  // Unknown partner is a 404 too.
  rejects(() => partner.joinLink("nonexistent", {}), "not_found");
});

test("joinLink without a public origin is honest null, never a fabricated URL", () => {
  const wef = partner.getPartnerByKey("wef");
  const link = partner.joinLink(wef.id, { origin: null });
  assert.equal(link.available, false);
  assert.equal(link.reason, "public_origin_not_configured");
  assert.equal(link.url, undefined);
});

// ---------------------------------------------------------------------------
// HTTP — capability gating.
// ---------------------------------------------------------------------------
{
  // Operator handles from the deployment bootstrap lists.
  const adminUser = user("pt_admin");
  const financeUser = user("pt_finance");
  const reviewerUser = user("pt_reviewer");
  process.env.BRIEF_ADMINS = adminUser.handle;
  process.env.BRIEF_FINANCE = financeUser.handle;
  process.env.BRIEF_REVIEWERS = reviewerUser.handle;

  const appMod = await import("../src/index.js");
  const app = appMod.default;
  const srv = app.listen(0);
  const port = srv.address().port;
  const tokenOf = (u) => auth.login({ handle: u.handle, password: "partner-password" }).token;
  const adminToken = tokenOf(adminUser),
    financeToken = tokenOf(financeUser),
    reviewerToken = tokenOf(reviewerUser),
    memberToken = tokenOf(member);
  const call = async (pathName, method = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    const wef = partner.getPartnerByKey("wef");

    const denied = await call("/api/ops/partners", "GET", undefined, memberToken);
    assert.equal(denied.status, 403);
    count++;
    console.log("PASS API: a member cannot read the partner report (403)");

    const anon = await call("/api/ops/partners");
    assert.equal(anon.status, 401);
    count++;
    console.log("PASS API: anonymous access is refused (401)");

    const listed = await call("/api/ops/partners", "GET", undefined, reviewerToken);
    assert.equal(listed.status, 200);
    assert.ok(Array.isArray(listed.body.partners));
    const wefView = listed.body.partners.find((p) => p.key === "wef");
    assert.ok(wefView);
    assert.equal(wefView.economics.grossKes, 8500);
    assert.equal(wefView.economics.partnerShareKes, 1700);
    count++;
    console.log("PASS API: a reviewer reads partners with derived economics");

    const deniedCreate = await call("/api/ops/partners", "POST", { name: "Another", partnerType: "bank" }, financeToken);
    assert.equal(deniedCreate.status, 403);
    const created = await call("/api/ops/partners", "POST", { name: "KCB Partner", partnerType: "bank", key: "kcb" }, adminToken);
    assert.equal(created.status, 201);
    assert.equal(created.body.partner.key, "kcb");
    count++;
    console.log("PASS API: creating a partner requires admin, not finance");

    // Invite link: moderate-gated, and honest (no public origin -> unavailable).
    const deniedInvite = await call(`/api/ops/partners/${wef.id}/invite`, "GET", undefined, memberToken);
    assert.equal(deniedInvite.status, 403);
    const noOrigin = await call(`/api/ops/partners/${wef.id}/invite`, "GET", undefined, reviewerToken);
    assert.equal(noOrigin.status, 200);
    assert.equal(noOrigin.body.link.available, false);
    assert.equal(noOrigin.body.link.reason, "public_origin_not_configured");
    // With a public origin configured, the same call yields a real URL.
    process.env.BRIEF_PUBLIC_ORIGIN = "https://brief.example.com";
    const invite = await call(`/api/ops/partners/${wef.id}/invite?program=women-enterprise-2026&cohort=nairobi-west`, "GET", undefined, reviewerToken);
    assert.equal(invite.status, 200);
    assert.equal(invite.body.link.available, true);
    assert.ok(invite.body.link.url.includes("/join?partner=wef"));
    delete process.env.BRIEF_PUBLIC_ORIGIN;
    count++;
    console.log("PASS API: the invite link is moderate-gated and honest about its origin");

    const deniedAgreement = await call(`/api/ops/partners/${wef.id}/agreement`, "POST", { shareRate: 0.3 }, reviewerToken);
    assert.equal(deniedAgreement.status, 403);

    const agreement = await call(`/api/ops/partners/${wef.id}/agreement`, "POST", { shareRate: 0.3 }, financeToken);
    assert.equal(agreement.status, 201);
    assert.equal(agreement.body.agreement.shareRate, 0.3);

    const settlement = await call(`/api/ops/partners/${wef.id}/settlements`, "POST", { from: "2026-04-01", to: "2026-06-30" }, financeToken);
    assert.equal(settlement.status, 201);
    assert.equal(settlement.body.settlement.shareKes, 2550); // floor(0.3 * 8500)
    assert.equal(settlement.body.settlement.status, "pending");

    const confirmed = await call(`/api/ops/settlements/${settlement.body.settlement.id}/confirm`, "POST", {}, financeToken);
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.settlement.status, "confirmed");
    count++;
    console.log("PASS API: the agreement and settlement flow is finance-gated end to end");
  } finally {
    srv.close();
  }
}

console.log(`\nPASS ${count}`);
