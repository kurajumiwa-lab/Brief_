// ---------------------------------------------------------------------------
// CIRCLE TEMPLATES — assisted replication. A template is a DEFAULT PRESET; it
// pre-fills the create form, never fabricates data, and never gates
// capabilities. Explicit create fields always win over a template's defaults.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-templates-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const tableBanking = await import("../src/domain/tableBanking.js");

// Shared harness: `test` registers, `run()` executes in order and awaits each.
const { test, step, run } = await import("./harness.mjs");
const rejects = (fn, code) => assert.throws(fn, (e) => !code || e.code === code);
const user = (handle) => auth.createUser({ handle, password: "templates-pw" });

test("templates are a pure preset list", () => {
  const t = tableBanking.listTemplates();
  assert.ok(Array.isArray(t) && t.length >= 5, "at least the five named templates");
  assert.ok(t.every((x) => x.id && x.label && x.defaults && x.defaults.contributionAmount > 0), "every template has a label and a positive default contribution");
});

test("a template pre-fills defaults; an explicit field wins", () => {
  const owner = user("tp_owner");
  const viaTemplate = tableBanking.createTableBanking({ ownerId: owner.id, name: "Welfare Group", template: "welfare_first" });
  assert.equal(viaTemplate.welfareContributionAmount, 500, "template supplies the welfare amount");
  assert.equal(viaTemplate.contributionAmount, 1000, "template supplies the contribution amount");

  const explicit = tableBanking.createTableBanking({ ownerId: owner.id, name: "Custom", template: "welfare_first", contributionAmount: 7777, welfareContributionAmount: 250 });
  assert.equal(explicit.contributionAmount, 7777, "an explicit contribution beats the template");
  assert.equal(explicit.welfareContributionAmount, 250, "an explicit welfare amount beats the template");
});

test("an unknown template is refused, not silently ignored", () => {
  const owner = user("tp_owner2");
  rejects(() => tableBanking.createTableBanking({ ownerId: owner.id, name: "X", template: "nonsense" }), null);
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
test("API: templates are served, and a group can be created from one", async () => {
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
    const A = (await call("/api/auth/register", "POST", { handle: "tp_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    // Everything under /api needs a session unless index.js PUBLIC_WITHOUT_SESSION
    // names it, and it does not name table-banking/templates. The route handler is
    // written as though it were public — (_req, res), no requireAuth — but the
    // global gate answers first, so in practice this is a signed-in read. Pinning
    // both halves: the gate really does refuse an anonymous caller, and a member
    // really does get the catalogue.
    const anon = await call("/api/table-banking/templates", "GET");
    assert.equal(anon.status, 401, "templates sit behind the session gate like the rest of /api");

    const t = await call("/api/table-banking/templates", "GET", undefined, A.token);
    assert.equal(t.status, 200);
    assert.ok(Array.isArray(t.body.templates) && t.body.templates.length >= 5);

    const grp = await call("/api/table-banking", "POST", { name: "From Template", template: "table_banking" }, A.token);
    assert.equal(grp.status, 201);
    assert.equal(grp.body.group.contributionAmount, 5000, "template default applied over the wire");
    assert.equal(grp.body.group.latePenaltyKes, 100, "the template's late penalty survives the wire");

    // The other half of the same bug, and the more damaging one: `welfare_first`
    // exists to earmark an emergency pot, so if the route defaults an omitted
    // field to 0 the pot vanishes and the group looks created but is not the
    // group the member picked.
    const wf = await call("/api/table-banking", "POST", { name: "From Welfare First", template: "welfare_first" }, A.token);
    assert.equal(wf.status, 201);
    assert.equal(wf.body.group.welfareContributionAmount, 500, "the template's welfare pot survives the wire");
    assert.equal(wf.body.group.contributionAmount, 1000, "and its rotation amount with it");

    // An explicit field still wins over the template — that is the other half of
    // the contract, and it must not be broken by the fix above.
    const over = await call("/api/table-banking", "POST", { name: "Explicit Wins", template: "table_banking", latePenaltyKes: 250 }, A.token);
    assert.equal(over.status, 201);
    assert.equal(over.body.group.latePenaltyKes, 250, "an explicit field overrides the template default");
  } finally {
    srv.close();
  }
});

await run();
