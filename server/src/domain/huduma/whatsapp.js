// ---------------------------------------------------------------------------
// HUDUMALINK — WHATSAPP BUSINESS CLOUD API (OUTBOUND / INTERACTIVE)
//
// The existing connectors/whatsapp.js handles INBOUND (verify + normalise).
// HudumaLink also needs OUTBOUND: sending the interactive messages that make a
// chat thread feel like a native app. This module builds those payloads and,
// when configured, dispatches them.
//
// WHATSAPP CLOUD API MESSAGE SHAPES (v18.0):
//
//   text        { type:'text', text:{ body } }
//   buttons     { type:'interactive', interactive:{ type:'button', body:{text},
//                action:{ buttons:[{ type:'reply', reply:{ id, title } }] } } }
//                (max 3 reply buttons)
//   list        { type:'interactive', interactive:{ type:'list', body:{text},
//                action:{ button, sections:[{ title, rows:[{ id, title, description? }] }] } } }
//   document    { type:'document', document:{ link, caption, filename } }
//
// SEND: POST {base}/{PHONE_NUMBER_ID}/messages
//   Authorization: Bearer <system user token>
//
// The router builds payloads with these helpers and passes them to dispatch().
// In tests dispatch is a capturing function; in production it is send() below.
// Either way the constructed payload is always available for assertion, so the
// conversational logic is fully testable without the network.
//
// CREDENTIALS (server-side only):
//   WHATSAPP_TOKEN           -- a permanent system-user access token
//   WHATSAPP_PHONE_NUMBER_ID -- the business number's id from the Graph API
// ---------------------------------------------------------------------------

const GRAPH_VERSION = 'v18.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

export function isConfigured() {
  return Boolean(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID'));
}

export function status() {
  return {
    configured: isConfigured(),
    phoneNumberId: Boolean(env('WHATSAPP_PHONE_NUMBER_ID')),
    token: Boolean(env('WHATSAPP_TOKEN'))
  };
}

// ---- payload builders (pure) ----------------------------------------------

export function text(to, body) {
  return { to: String(to), type: 'text', text: { body: String(body) } };
}

/**
 * Reply buttons. WhatsApp caps a button message at 3 buttons; a 4th is refused
 * here so the API never silently drops one.
 */
export function buttons(to, body, buttonList, { footer = null } = {}) {
  if (!Array.isArray(buttonList) || buttonList.length === 0) {
    throw new Error('at least one button is required');
  }
  if (buttonList.length > 3) {
    throw new Error(`WhatsApp allows at most 3 reply buttons, got ${buttonList.length}`);
  }
  const interactive = {
    type: 'button',
    body: { text: String(body) },
    action: { buttons: buttonList.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) }
  };
  if (footer) interactive.footer = { text: String(footer) };
  return { to: String(to), type: 'interactive', interactive };
}

/** A list menu. Used for a category with more than 3 services. */
export function list(to, body, button, sections, { title = null, footer = null } = {}) {
  const interactive = {
    type: 'list',
    body: { text: String(body) },
    action: { button: String(button), sections }
  };
  if (title) interactive.header = { type: 'text', text: String(title) };
  if (footer) interactive.footer = { text: String(footer) };
  return { to: String(to), type: 'interactive', interactive };
}

export function document(to, link, { caption = null, filename = null } = {}) {
  const doc = { link: String(link) };
  if (caption) doc.caption = String(caption);
  if (filename) doc.filename = String(filename);
  return { to: String(to), type: 'document', document: doc };
}

// ---- dispatch --------------------------------------------------------------

/**
 * Send a single payload to the Cloud API. Returns { ok, messageId } on
 * success, { ok:false, reason } otherwise. Never throws — a failed send
 * becomes a structured result the route can log and retry.
 */
export async function send(payload, { fetchImpl = fetch } = {}) {
  if (!isConfigured()) {
    return { ok: false, reason: 'not_configured', missing: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'] };
  }
  try {
    const res = await fetchImpl(
      `${GRAPH_BASE}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: payload.to,
          type: payload.type,
          [payload.type]: payload[payload.type]
        })
      }
    );
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.messages?.length) {
      return { ok: false, reason: 'send_failed', status: res.status, body };
    }
    return { ok: true, messageId: body.messages[0].id };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: String(e.message ?? e) };
  }
}

/**
 * Send every payload in order. Returns per-payload results plus an aggregate
 * `dispatched` count, so a multi-message turn reports honestly how much of it
 * actually reached the user.
 */
export async function sendAll(payloads, opts = {}) {
  const results = [];
  for (const p of payloads) {
    results.push({ payload: p, result: await send(p, opts) });
  }
  return { results, dispatched: results.filter((r) => r.result.ok).length };
}

/** The real dispatch used by the router in production. */
export const realDispatch = sendAll;
