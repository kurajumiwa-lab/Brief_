// ---------------------------------------------------------------------------
// PDF EXPORT — the dependency-free minutes writer emits a structurally valid
// PDF (object graph + xref + trailer) and is served as application/pdf.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-pdf-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const tableBanking = await import("../src/domain/tableBanking.js");
const pdf = await import("../src/pdf.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };

test("the writer emits a valid PDF header/trailer and xref offsets", () => {
  const buf = pdf.minutesPdf({ groupName: "Kiama Circle", minutes: [
    { title: "June 14 meeting", heldAt: "2026-06-14", body: "Agreed the rotation and reviewed the welfare pot.", decisions: ["Advance the turn"], actionItems: ["Mary to collect receipts"] }
  ] });
  const s = buf.toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4'), 'PDF header');
  assert.ok(s.trimEnd().endsWith('%%EOF'), 'PDF trailer');

  // The xref offsets must actually point at each object.
  const startxref = Number(/startxref\n(\d+)/.exec(s)[1]);
  const xrefSection = s.slice(startxref);
  const entries = [...xrefSection.matchAll(/^(\d{10}) 00000 n \s*$/gm)].map((m) => Number(m[1]));
  assert.equal(entries.length, 5, 'five objects are indexed');
  entries.forEach((off, i) => {
    assert.ok(s.slice(off, off + 12).includes(`${i + 1} 0 obj`), `object ${i + 1} at its xref offset`);
  });
});

test("the content stream carries the minutes, sanitised to ASCII", () => {
  const buf = pdf.minutesPdf({ groupName: "Welfare Circle", minutes: [
    { title: "Bereavement — June", heldAt: "2026-06-20", body: "Approved a claim for (member) M.", decisions: ["Pay 600"], actionItems: [] }
  ] });
  const s = buf.toString('latin1');
  assert.ok(s.includes('Welfare Circle'), 'group name present');
  assert.ok(s.includes('Bereavement - June'), 'em dash sanitised to ASCII');
  assert.ok(s.includes('\\(member\\)'), 'parentheses escaped in the content stream');
  assert.ok(s.includes('Pay 600'), 'decision present');
});

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
test("API: a member downloads the minutes as application/pdf", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (p, m = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: m, headers, body: body ? JSON.stringify(body) : undefined });
    const type = r.headers.get("content-type");
    const text = await r.text();
    return { status: r.status, type, text };
  };
  try {
    const A = (await call("/api/auth/register", "POST", { handle: "pdf_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const grp = (await call("/api/table-banking", "POST", { name: "PDF Circle", contributionAmount: 5000 }, A.token)).body.group;
    await call(`/api/table-banking/${grp.id}/minutes`, "POST", { title: "Kickoff", body: "Formed the group." }, A.token);

    const r = await call(`/api/table-banking/${grp.id}/minutes.pdf`, "GET", undefined, A.token);
    assert.equal(r.status, 200);
    assert.ok((r.type || '').includes('application/pdf'), 'content-type is application/pdf');
    assert.ok(r.text.startsWith('%PDF-1.4'), 'body is a PDF');
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
