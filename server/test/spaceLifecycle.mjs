// ---------------------------------------------------------------------------
// SPACE LIFECYCLE — deletion (owner-only, offers withdrawn, history kept) and
// a cover image (set at create, edited via update, cleared). Also pins the
// createSpaceOffer images->media fix: product images must actually land.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-spacelife-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const spaces = await import("../src/domain/space.js");

// Shared harness: `test` registers, `run()` executes in order and awaits each.
const { test, step, run } = await import("./harness.mjs");
const rejects = (fn, msg) => assert.throws(fn, (e) => !msg || e.message.includes(msg));
const user = (handle) => auth.createUser({ handle, password: "spacelife-pw" });

const owner = user("sl_owner");
const other = user("sl_other");

test("a space is private by default and its visibility can be changed by the owner", () => {
  const s = spaces.createSpace({ ownerId: owner.id, name: "Visibility Space" });
  assert.equal(s.visibility, "private", "default is private");

  const pub = spaces.updateSpace(s.id, { visibility: "public" }, { callerId: owner.id });
  assert.equal(pub.visibility, "public");

  const unlisted = spaces.updateSpace(s.id, { visibility: "unlisted" }, { callerId: owner.id });
  assert.equal(unlisted.visibility, "unlisted");

  rejects(() => spaces.updateSpace(s.id, { visibility: "world" }, { callerId: owner.id }), "must be one of");
});

test("a non-owner cannot change visibility", () => {
  const s = spaces.createSpace({ ownerId: owner.id, name: "Guarded" });
  rejects(() => spaces.updateSpace(s.id, { visibility: "public" }, { callerId: other.id }), "Not authorized");
});

test("the public directory lists only public, active spaces, with a safe projection", () => {
  const pub = spaces.createSpace({ ownerId: owner.id, name: "Public Kitchen", visibility: "public" });
  const priv = spaces.createSpace({ ownerId: owner.id, name: "Private Vault", visibility: "private" });
  const unlisted = spaces.createSpace({ ownerId: owner.id, name: "Unlisted", visibility: "unlisted" });
  const archived = spaces.createSpace({ ownerId: owner.id, name: "Archived Public", visibility: "public" });
  spaces.updateSpace(archived.id, { status: "archived" }, { callerId: owner.id });

  const dir = spaces.listPublicSpaces();
  const names = dir.map((s) => s.name);
  assert.ok(names.includes("Public Kitchen"), "public space is listed");
  assert.ok(!names.includes("Private Vault"), "private space is not listed");
  assert.ok(!names.includes("Unlisted"), "unlisted space is not listed");
  assert.ok(!names.includes("Archived Public"), "archived public space is not listed");

  // The projection is safe: no private economics leak.
  const row = dir.find((s) => s.name === "Public Kitchen");
  assert.ok(!("ownerId" in row) && !("vendorId" in row) && !("metrics" in row) && !("revenueKes" in row), "no private fields");
  assert.equal(row.visibility, "public");
  assert.equal(row.activeOfferCount, 0);
});

test("a space may carry a cover image, set at create and edited later", () => {
  const s = spaces.createSpace({ ownerId: owner.id, name: "Kilimani Kitchen", image: "/api/media/file/img1" });
  assert.equal(s.image, "/api/media/file/img1");

  const updated = spaces.updateSpace(s.id, { image: "/api/media/file/img2" }, { callerId: owner.id });
  assert.equal(updated.image, "/api/media/file/img2");

  const cleared = spaces.updateSpace(s.id, { image: null }, { callerId: owner.id });
  assert.equal(cleared.image, null);
});

test("a space offer's images actually land on the listing media (not dropped)", () => {
  const s = spaces.createSpace({ ownerId: owner.id, name: "Images Space" });
  const offer = spaces.createSpaceOffer(s.id, {
    title: "Samosas (dozen)",
    price: 300,
    images: ["/api/media/file/imgA", "/api/media/file/imgB"],
    callerId: owner.id
  });
  const listing = store.find("listings", (l) => l.id === offer.id);
  assert.ok(Array.isArray(listing.media) && listing.media.length === 2, "images reached the listing's media field");
  assert.deepEqual(listing.media, ["/api/media/file/imgA", "/api/media/file/imgB"]);
});

test("deleteSpace is owner-only, withdraws its offers, and keeps history", () => {
  const s = spaces.createSpace({ ownerId: owner.id, name: "To Delete" });
  const offer = spaces.createSpaceOffer(s.id, { title: "Cakes", price: 900, callerId: owner.id });

  // A stranger cannot delete it.
  rejects(() => spaces.deleteSpace(s.id, { callerId: other.id }), "Not authorized");

  const result = spaces.deleteSpace(s.id, { callerId: owner.id });
  assert.equal(result.removed, true);
  assert.equal(spaces.getSpace(s.id), null, "the space row is gone");

  // The offer is withdrawn (archived), not hard-deleted — orders may refer to it.
  const listing = store.find("listings", (l) => l.id === offer.id);
  assert.equal(listing.status, "archived");
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
test("API: PATCH image, DELETE space over the wire", async () => {
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
    const A = (await call("/api/auth/register", "POST", { handle: "sl_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const B = (await call("/api/auth/register", "POST", { handle: "sl_http2" + Date.now().toString(36), password: "a good passphrase" })).body;
    const s = (await call("/api/spaces", "POST", { name: "HTTP Space" }, A.token)).body.space;

    const patched = await call(`/api/spaces/${s.id}`, "PATCH", { image: "/api/media/file/himg" }, A.token);
    assert.equal(patched.status, 200);
    assert.equal(patched.body.space.image, "/api/media/file/himg");

    // A non-owner cannot delete.
    const denied = await call(`/api/spaces/${s.id}`, "DELETE", undefined, B.token);
    assert.equal(denied.status, 403);

    const del = await call(`/api/spaces/${s.id}`, "DELETE", undefined, A.token);
    assert.equal(del.status, 200);
    assert.equal(del.body.removed, true);
  } finally {
    srv.close();
  }
});

await run();
