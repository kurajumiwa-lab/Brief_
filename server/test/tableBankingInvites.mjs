// ---------------------------------------------------------------------------
// JOIN INVITES — the treasurer adds a member by phone; the member confirms by
// replying YES <code>. An invite is a real row; accepting records a phone as a
// confirmed invitee (never a fabricated user). The outbound message is
// fail-closed (no provider -> a named refusal, never "sent").
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-invites-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const tableBanking = await import("../src/domain/tableBanking.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "invites-pw" });

const owner = user("inv_owner");
const g = tableBanking.createTableBanking({ ownerId: owner.id, name: "Invite Circle", contributionAmount: 5000 });

test("issuing an invite needs a phone and a member", () => {
  rejects(() => tableBanking.issueJoinInvite(g.id, owner.id, {}), null); // no phone
  rejects(() => tableBanking.issueJoinInvite(g.id, "not-a-member", { phone: "0712..." }), "not_member");
  const inv = tableBanking.issueJoinInvite(g.id, owner.id, { phone: "0712345678", name: "Mary" });
  assert.equal(inv.status, "pending");
  assert.match(inv.code, /^[A-Z2-9]{6}$/, "a short unambiguous code");
  assert.ok(inv.message.includes("Reply YES"), "the message carries the reply instruction");
  assert.ok(inv.message.includes(inv.code), "the message carries the code");
});

test("accepting by code marks the invite accepted", () => {
  const inv = tableBanking.issueJoinInvite(g.id, owner.id, { phone: "0799999999", name: "Faith" });
  const accepted = tableBanking.acceptJoinInvite(inv.code, "0799999999");
  assert.equal(accepted.status, "accepted");
  // A used code cannot be reused.
  rejects(() => tableBanking.acceptJoinInvite(inv.code, "0799999999"), "not_found");
});

test("a code does not accept for a different phone", () => {
  const inv = tableBanking.issueJoinInvite(g.id, owner.id, { phone: "0700000000" });
  rejects(() => tableBanking.acceptJoinInvite(inv.code, "0711111111"), "phone_mismatch");
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
test("API: issue an invite (with a fail-closed delivery) and accept via the webhook", async () => {
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
    const A = (await call("/api/auth/register", "POST", { handle: "inv_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const grp = (await call("/api/table-banking", "POST", { name: "HTTP Invites", contributionAmount: 5000 }, A.token)).body.group;

    // Issue an invite with an outbound channel (no provider configured -> honest refusal).
    const issued = await call(`/api/table-banking/${grp.id}/invites`, "POST", { phone: "0722000000", name: "Jane", channel: "whatsapp" }, A.token);
    assert.equal(issued.status, 201);
    assert.ok(issued.body.invite.code, "an invite with a code");
    assert.equal(issued.body.delivery.ok, false, "delivery is fail-closed (no provider)");
    assert.equal(issued.body.delivery.reason, "no_provider");

    // The webhook (public, no session) accepts it.
    const accepted = await call("/api/webhooks/table-banking-invites", "POST", { code: issued.body.invite.code, phone: "0722000000" });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.invite.status, "accepted");

    // A bad code is refused, not fabricated.
    const bad = await call("/api/webhooks/table-banking-invites", "POST", { code: "ZZZZZZ" });
    assert.equal(bad.status, 404);
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
