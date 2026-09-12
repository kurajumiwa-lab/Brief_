import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-wa-"));
process.env.BRIEF_DATA_DIR = dir;

const outbound = await import("../src/outbound.js");
const whatsappMeta = await import("../src/connectors/whatsappMeta.js");
let count = 0;
const pass = (name) => { count++; console.log("PASS " + name); };

// ---------------------------------------------------------------------------
// #1 — the Meta-direct provider is registered in the outbound seam.
// ---------------------------------------------------------------------------
{
  assert.ok(outbound.OUTBOUND_PROVIDERS.whatsappMeta, "whatsappMeta is a registered provider");
  assert.ok(outbound.OUTBOUND_PROVIDERS.twilio, "twilio remains a provider (sms + BSP fallback)");
  assert.deepEqual(whatsappMeta.channels, ['whatsapp']);
  pass("Meta-direct WhatsApp is registered as an outbound provider alongside Twilio");

  // Preferred ordering: Meta-direct first for whatsapp.
  const order = Object.keys(outbound.OUTBOUND_PROVIDERS);
  assert.equal(order[0], 'whatsappMeta', "Meta-direct is preferred over the BSP");
  pass("Meta-direct is preferred for the whatsapp channel");

  // Fail-closed when unconfigured: the seam says "no provider" (nothing is
  // configured), and a direct connector call says "not_configured".
  const r1 = await outbound.send({ channel: 'whatsapp', to: '254712345678', text: 'hi' });
  assert.equal(r1.ok, false, "unconfigured send fails closed");
  assert.equal(r1.reason, 'no_provider', "the seam reports no configured provider");
  const r2 = await whatsappMeta.send({ to: '254712345678', text: 'hi' });
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'not_configured', "a direct connector call names the missing credentials");
  pass("an unconfigured send fails closed with a named reason");
}

// ---------------------------------------------------------------------------
// With Meta credentials mounted + a fetch mock, the send reaches graph.facebook
// ---------------------------------------------------------------------------
{
  process.env.WHATSAPP_TOKEN = 'wa-test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
  let sentUrl = null, sentBody = null, sentAuth = null;
  const fakeFetch = async (url, opts) => {
    sentUrl = url;
    sentAuth = opts.headers.authorization;
    sentBody = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.test.1' }] }) };
  };

  const res = await outbound.send({ channel: 'whatsapp', to: '254712345678', text: 'Hello from Brief', fetchImpl: fakeFetch });
  assert.equal(res.ok, true);
  assert.equal(res.messageId, 'wamid.test.1');
  assert.match(sentUrl, /graph\.facebook\.com\/v18\.0\/1234567890\/messages/);
  assert.equal(sentAuth, 'Bearer wa-test-token');
  assert.equal(sentBody.messaging_product, 'whatsapp');
  assert.equal(sentBody.to, '254712345678');
  assert.equal(sentBody.type, 'text');
  assert.equal(sentBody.text.body, 'Hello from Brief');
  pass("a configured Meta send posts straight to graph.facebook.com with the token");

  // A rejected send is honest.
  const bad = await whatsappMeta.send({ to: '254712345678', text: 'x', fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: 'nope' }) }) });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'send_failed');
  pass("a rejected Meta send returns an honest failure");
}

// ---------------------------------------------------------------------------
// #2 — an owner reply to a customer with a known number dispatches out.
// ---------------------------------------------------------------------------
{
  // Reset env for the route-level test: no provider -> honest "no_provider".
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  const { store } = await import("../src/store.js");
  const auth = await import("../src/domain/auth.js");
  const spaces = await import("../src/domain/space.js");
  const owner = auth.createUser({ handle: 'wa_owner', password: 'whatsapp-outbound-pw' });
  const space = spaces.createSpace({ ownerId: owner.id, name: 'WA Shop', type: 'business' });
  const conv = spaces.createSpaceConversation({ spaceId: space.id, customerName: 'Mary', customerContact: '254700111222', message: 'How much is the cake?' });

  // Domain: an owner reply with a stored delivery result carries it.
  const reply = spaces.postSpaceMessage({
    spaceId: space.id,
    conversationId: conv.id,
    text: 'KES 4,500',
    from: 'owner',
    sender: 'You',
    callerId: owner.id,
    whatsappDelivery: { ok: true, messageId: 'wamid.x' }
  });
  const last = reply.messages[reply.messages.length - 1];
  assert.equal(last.whatsappDelivery.ok, true);
  assert.equal(last.whatsappDelivery.messageId, 'wamid.x');
  pass("an owner reply stores its WhatsApp delivery result on the message");
}

// ---------------------------------------------------------------------------
// HTTP — the /messages route dispatches outbound and reports it honestly.
// ---------------------------------------------------------------------------
{
  const { store } = await import("../src/store.js");
  const auth = await import("../src/domain/auth.js");
  const spaces = await import("../src/domain/space.js");
  store._reset();
  const owner = auth.createUser({ handle: 'wa_owner2', password: 'whatsapp-outbound-pw' });
  const space = spaces.createSpace({ ownerId: owner.id, name: 'WA Shop 2', type: 'business' });
  const conv = spaces.createSpaceConversation({ spaceId: space.id, customerName: 'Mary', customerContact: '254700111222', message: 'hi' });

  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const token = auth.issueSession(owner.id).token;
  const call = async (p, m = 'POST', body) => {
    const r = await fetch(`http://127.0.0.1:${port}${p}`, {
      method: m,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  try {
    // No provider configured -> the reply is recorded but honestly "not sent".
    const res = await call(`/api/spaces/${space.id}/conversations/${conv.id}/messages`, 'POST', { text: 'KES 4,500', from: 'owner', sender: 'You' });
    assert.equal(res.status, 200);
    assert.ok(res.body.whatsappDelivery, "delivery result is present in the response");
    assert.equal(res.body.whatsappDelivery.ok, false, "no provider -> not sent");
    assert.match(res.body.whatsappDelivery.reason, /no_provider|not_configured/);
    count++;
    console.log("PASS API: an owner reply is recorded and its WhatsApp delivery reported honestly");
  } finally {
    srv.close();
  }
}

console.log(`\nPASS ${count}`);
process.exit(0);
