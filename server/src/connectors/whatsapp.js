// ---------------------------------------------------------------------------
// WHATSAPP CONNECTOR (Cloud API)
//
// THE HONEST POSITION, stated up front because the spec demands it (13/27):
//
//   SUPPORTED   Messages sent BY a user TO your WhatsApp Business number.
//               Meta delivers these to your webhook. This genuinely works and
//               is implemented below: signature verification, verify handshake
//               and message normalization.
//
//   NOT SUPPORTED  Ingesting ordinary WhatsApp GROUP chats.
//               The Cloud API has no group-messaging capability. A business
//               number cannot join a normal group, and there is no webhook
//               event for group traffic. WhatsApp Business *Channels* are
//               likewise not exposed for third-party read access.
//
//               The only ways to read a normal group are (a) unofficial
//               reverse-engineered libraries that violate the WhatsApp ToS and
//               risk a permanent ban, or (b) a human exporting the chat and
//               pasting it in. We implement (b) via the manual connector and
//               explicitly refuse (a).
//
// So: group ingestion is marked UNSUPPORTED rather than faked.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';

export function isConfigured() {
  return Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN);
}

/**
 * Meta's webhook subscription handshake (GET). Returns the challenge only when
 * the verify token matches the one we configured.
 */
export function verifySubscription(query) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) return { ok: false, status: 503, error: 'WHATSAPP_VERIFY_TOKEN not set' };
  if (mode === 'subscribe' && token === expected) return { ok: true, challenge };
  return { ok: false, status: 403, error: 'verify token mismatch' };
}

/**
 * X-Hub-Signature-256 validation (spec 32). Timing-safe, and fails closed when
 * the app secret is absent -- an unverifiable payload is never trusted.
 */
export function verifySignature(rawBody, header) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return { ok: false, error: 'WHATSAPP_APP_SECRET not set' };
  if (!header || !header.startsWith('sha256=')) {
    return { ok: false, error: 'missing or malformed X-Hub-Signature-256' };
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'signature mismatch' };
  }
  return { ok: true };
}

/** Normalize a Cloud API webhook payload into raw-item shape. */
export function normalizeWebhook(payload) {
  const out = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const contacts = value.contacts ?? [];
      for (const msg of value.messages ?? []) {
        const text = msg.text?.body || msg.caption ||
                     msg.interactive?.list_reply?.title || '';
        if (!text.trim()) continue;
        const contact = contacts.find((c) => c.wa_id === msg.from);
        const media = [];
        if (msg.image) media.push({ kind: 'image', reference: msg.image.id, caption: msg.image.caption ?? null });
        if (msg.document) media.push({ kind: 'document', reference: msg.document.id, caption: msg.document.filename ?? null });
        out.push({
          externalId: msg.id,
          messageId: msg.id,
          author: contact?.profile?.name || msg.from || null,
          text,
          media,
          publishedAt: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : null,
          // There is no public permalink for a WhatsApp message. Fabricating
          // one would violate spec 35, so this stays null.
          rawUrl: null,
          phoneNumberId: value.metadata?.phone_number_id ?? null
        });
      }
    }
  }
  return out;
}

export const capabilities = {
  connector: 'whatsapp',
  authenticate: 'yes - Cloud API app secret + verify token',
  webhook: 'yes - signature verified with HMAC-SHA256, timing-safe',
  inboundDirectMessages: 'yes - messages sent to the business number',
  groupIngestion: 'NO - the Cloud API exposes no group messaging capability',
  channels: 'NO - WhatsApp Channels are not readable by third parties',
  permalinks: 'NO - WhatsApp messages have no public URL, so sourceUrl stays null',
  workaround: 'Exported chat text can be pasted through the manual connector, which keeps provenance honest.',
  refused: 'Unofficial web-reverse-engineering libraries are not used: they breach the WhatsApp ToS and risk a permanent ban.'
};
