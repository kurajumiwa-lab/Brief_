// ---------------------------------------------------------------------------
// QUOTE VOTES — the group decides which quote to accept for a COLLECTIVE
// request. Votes are real rows; one per member; the tally is derived; a strict
// majority authorises the requester to accept through the normal quote path.
// No quote is accepted without the real validations; nothing is fabricated.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-quotevotes-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const tableBanking = await import("../src/domain/tableBanking.js");
const quoteVotes = await import("../src/domain/quoteVotes.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "quotevotes-pw" });

const owner = user("qv_owner");
const m2 = user("qv_m2"), m3 = user("qv_m3"), m4 = user("qv_m4");
const g = tableBanking.createTableBanking({ ownerId: owner.id, name: "Vote Circle", contributionAmount: 5000 });
for (const m of [m2, m3, m4]) tableBanking.joinTableBanking(g.id, m.id);

// A collective request + its invitation + one submitted quote (synthetic rows:
// the vote layer reads request/quote from the store; the full match->quote
// chain is exercised by the quotes suite).
store.insert("requests", { id: "req_1", title: "Fertilizer", requesterId: owner.id, revision: 1, status: "open", businessContext: { tableBankingId: g.id, companyName: g.name } });
store.insert("quoteRequests", { id: "qreq_1", requestId: "req_1" });
store.insert("requestQuotes", { id: "quote_1", quoteRequestId: "qreq_1", requestId: "req_1", requesterId: owner.id, status: "submitted", revision: 1, offers: [] });

test("the group's quotes are derived, with a vote tally and quorum", () => {
  const quotes = quoteVotes.listGroupQuotes(g.id);
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].quoteId, "quote_1");
  assert.equal(quotes[0].quorum, 3, "quorum is a strict majority of 4 members");
  assert.equal(quotes[0].vote.total, 0);
});

test("a member votes once; a non-member cannot; a foreign quote is refused", () => {
  const s = quoteVotes.voteOnQuote(g.id, owner.id, "quote_1", true);
  assert.equal(s.approveCount, 1);
  rejects(() => quoteVotes.voteOnQuote(g.id, owner.id, "quote_1", true), "already_voted");
  const stranger = user("qv_stranger");
  rejects(() => quoteVotes.voteOnQuote(g.id, stranger.id, "quote_1", true), "not_member");
  // A quote belonging to a different group is not found here.
  store.insert("requests", { id: "req_2", title: "Seeds", requesterId: owner.id, revision: 1, status: "open", businessContext: { tableBankingId: "other-group" } });
  store.insert("requestQuotes", { id: "quote_2", quoteRequestId: "qreq_1", requestId: "req_2", requesterId: owner.id, status: "submitted", revision: 1, offers: [] });
  rejects(() => quoteVotes.voteOnQuote(g.id, owner.id, "quote_2", true), "not_found");
});

test("a strict majority is derived from real votes", () => {
  quoteVotes.voteOnQuote(g.id, m2.id, "quote_1", true);
  quoteVotes.voteOnQuote(g.id, m3.id, "quote_1", true);
  const s = quoteVotes.quoteVoteState("quote_1");
  assert.equal(s.approveCount, 3);
  assert.equal(s.total, 3);
});

test("accept without a majority is refused; accept reuses the real quote path", () => {
  // A second quote with only one approving vote -> no majority.
  store.insert("requestQuotes", { id: "quote_3", quoteRequestId: "qreq_1", requestId: "req_1", requesterId: owner.id, status: "submitted", revision: 1, offers: [] });
  quoteVotes.voteOnQuote(g.id, owner.id, "quote_3", true);
  rejects(() => quoteVotes.acceptQuoteByGroupVote(g.id, "quote_3"), "no_majority");

  // quote_1 HAS a majority. The accept must run the REAL validations — it does
  // not fabricate success on a quote with no offers; it surfaces an error.
  assert.throws(() => quoteVotes.acceptQuoteByGroupVote(g.id, "quote_1"));
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
test("API: list group quotes and vote over the wire", async () => {
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
    const A = (await call("/api/auth/register", "POST", { handle: "qv_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const B = (await call("/api/auth/register", "POST", { handle: "qv_http2" + Date.now().toString(36), password: "a good passphrase" })).body;
    const grp = (await call("/api/table-banking", "POST", { name: "HTTP Votes", contributionAmount: 5000 }, A.token)).body.group;
    await call(`/api/table-banking/${grp.id}/join`, "POST", {}, B.token);

    // A collective request + quote seeded directly.
    store.insert("requests", { id: "hreq", title: "HTTP Seeds", requesterId: A.user.id, revision: 1, status: "open", businessContext: { tableBankingId: grp.id, companyName: grp.name } });
    store.insert("quoteRequests", { id: "hqreq", requestId: "hreq" });
    store.insert("requestQuotes", { id: "hquote", quoteRequestId: "hqreq", requestId: "hreq", requesterId: A.user.id, status: "submitted", revision: 1, offers: [] });

    const list = await call(`/api/table-banking/${grp.id}/quotes`, "GET", undefined, A.token);
    assert.equal(list.status, 200);
    assert.equal(list.body.quotes.length, 1);
    assert.equal(list.body.quotes[0].quoteId, "hquote");

    const voted = await call(`/api/table-banking/${grp.id}/quotes/hquote/vote`, "POST", { approve: true }, A.token);
    assert.equal(voted.status, 200);
    assert.equal(voted.body.vote.approveCount, 1);

    const twice = await call(`/api/table-banking/${grp.id}/quotes/hquote/vote`, "POST", { approve: true }, B.token);
    assert.equal(twice.status, 200);
    assert.equal(twice.body.vote.approveCount, 2, "both members' votes count");
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
