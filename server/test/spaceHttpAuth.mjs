// ---------------------------------------------------------------------------
// REGRESSION — Space routes were using requireAuth (a GUARD that returns a
// value and never calls next()) as Express MIDDLEWARE. The result: every
// authenticated POST/PATCH to a Space route hung forever (handler never ran,
// no response). This test pins the fix (requireAuthMw calls next()) by
// exercising the real HTTP routes with a valid session and asserting they
// complete with a response, not a hang.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-spaceauth-"));
process.env.BRIEF_DATA_DIR = dir;

const { default: app } = await import("../src/index.js");
const auth = await import("../src/domain/auth.js");
let count = 0;
const pass = (name) => { count++; console.log("PASS " + name); };

const owner = auth.createUser({ handle: "spaceauth_owner", password: "space-auth-pw" });
const token = auth.issueSession(owner.id).token;
const srv = app.listen(0);
const port = srv.address().port;
const call = async (p, m = "GET", body) => {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, {
    method: m,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

async function main() {
  // The create-space POST must complete (not hang) and return 201.
  const created = await call("/api/spaces", "POST", { name: "Auth Probe", type: "business" });
  assert.equal(created.status, 201);
  assert.ok(created.body.space?.id, "a space is created");
  pass("POST /api/spaces completes (no hang) and returns 201");

  // The publish-offer POST must complete too (the route that used to hang).
  const spaceId = created.body.space.id;
  const offer = await call(`/api/spaces/${spaceId}/offers`, "POST", { title: "Cake", price: 4500, currency: "KES" });
  assert.equal(offer.status, 201);
  const publish = await call(`/api/spaces/${spaceId}/offers/${offer.body.offer.id}/publish`, "POST", {});
  assert.equal(publish.status, 200);
  assert.equal(publish.body.offer.status, "active");
  pass("POST offer + publish complete (no hang) and the offer becomes active");

  // Unauthenticated requests still get a 401 (the middleware still guards).
  const anon = await fetch(`http://127.0.0.1:${port}/api/spaces`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "X" })
  });
  assert.equal(anon.status, 401);
  pass("unauthenticated space create still returns 401");

  srv.close();
  console.log(`\nPASS ${count}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
