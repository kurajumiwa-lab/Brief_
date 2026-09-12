// ---------------------------------------------------------------------------
// WHATSAPP META (CLOUD API) — the DIRECT outbound provider.
//
// The outbound-seam adapter for sending WhatsApp messages straight through
// Meta's Cloud API (graph.facebook.com), with NO BSP/SaaS middleman. It wraps
// the SAME send logic as domain/huduma/whatsapp.js (single source of truth —
// one Graph API implementation, not two), and exposes the standard provider
// interface outbound.js expects:
//
//   channels[], isConfigured(channel), missingCredentials(channel),
//   status(), send({ channel, to, text })
//
// Honesty, unchanged: `send` fails closed with the missing credentials named;
// a failed dispatch returns a structured { ok:false, reason } — nothing here
// ever fabricates a delivery. Outbound mass messaging outside the 24h window
// requires Meta-approved templates, which is the operator's obligation, not
// something this connector papers over.
// ---------------------------------------------------------------------------

import * as meta from '../domain/huduma/whatsapp.js';

export const channels = ['whatsapp'];

/** The credentials Meta Cloud API needs to send. */
export function missingCredentials() {
  const missing = [];
  if (!process.env.WHATSAPP_TOKEN) missing.push('WHATSAPP_TOKEN');
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  return missing;
}

/** Can we send WhatsApp via Meta directly right now? */
export function isConfigured(channel = 'whatsapp') {
  if (channel !== 'whatsapp') return false;
  return meta.isConfigured();
}

export function status() {
  return {
    provider: 'whatsapp_meta',
    direct: true, // no BSP/SaaS middleman — graph.facebook.com, straight through
    whatsapp: { configured: meta.isConfigured(), missing: missingCredentials() },
    reason: meta.isConfigured()
      ? null
      : 'Meta Cloud API is not configured. Set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID.'
  };
}

/**
 * Send a WhatsApp text message through Meta Cloud API. `to` is an E.164
 * number (e.g. 2547XXXXXXXX); `text` is the plain message body. Returns
 * { ok:true, messageId } or { ok:false, reason } — never throws.
 */
export async function send({ channel = 'whatsapp', to, text, fetchImpl = fetch }) {
  if (channel !== 'whatsapp') return { ok: false, reason: 'unsupported_channel', channel };
  if (!meta.isConfigured()) return { ok: false, reason: 'not_configured', channel, missing: missingCredentials() };

  const msisdn = String(to ?? '').replace(/\D/g, '');
  if (!msisdn) return { ok: false, reason: 'invalid_phone', channel };
  const body = String(text ?? '').trim();
  if (!body) return { ok: false, reason: 'empty_text', channel };
  if (body.length > 4096) return { ok: false, reason: 'text_too_long', channel }; // Cloud API text cap

  const payload = meta.text(msisdn, body);
  return meta.send(payload, { fetchImpl });
}
