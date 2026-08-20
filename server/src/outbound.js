// ---------------------------------------------------------------------------
// OUTBOUND CHANNEL SEAM
//
// The mirror image of providers.js, for the other direction: instead of money
// in/out, messages out. Brief ingests from every channel (Telegram, WhatsApp,
// web, RSS, manual) but — until now — could SEND on none. This file is the
// single place that decides which provider sends a message on which channel.
//
//   CHANNELS   sms, whatsapp, email, telegram
//   PROVIDERS  each exposes: channels[], isConfigured(channel),
//              missingCredentials(channel), status(), send({ channel, to, text })
//
// Adding a provider (AfricasTalking, a Telegram-send adapter, an email
// gateway, ...) is: write a connector file + add ONE line to the map below.
// Nothing else changes, because every caller reaches outbound through this
// file and never depends on a provider's endpoints or auth directly.
//
// Honesty is structural here: a channel with no configured provider is
// reported as such (status()), and send() fails closed with the missing
// credentials named. Nothing here fabricates a delivery.
// ---------------------------------------------------------------------------

import * as twilio from './connectors/twilio.js';

export const OUTBOUND_PROVIDERS = { twilio };

/** Every channel Brief might send on, so status() can report the gaps too. */
export const CHANNELS = ['sms', 'whatsapp', 'email', 'telegram'];

/** The configured provider for a channel, or null. */
export function providerForChannel(channel) {
  for (const [name, p] of Object.entries(OUTBOUND_PROVIDERS)) {
    if (Array.isArray(p.channels) && p.channels.includes(channel) && p.isConfigured?.(channel)) {
      return { name, provider: p };
    }
  }
  return null;
}

/** Can Brief send on this channel right now? */
export function canSend(channel) {
  return Boolean(providerForChannel(channel));
}

/**
 * Send an outbound message on a channel, through whatever provider is
 * configured for it. Fail-closed: no provider -> a named refusal.
 */
export async function send({ channel, to, text }) {
  const hit = providerForChannel(channel);
  if (!hit) {
    return { ok: false, reason: 'no_provider', channel };
  }
  return hit.provider.send({ channel, to, text });
}

/**
 * One answer to "can Brief send messages, and on which channels", drawn from
 * the registry. Reported on /api/capabilities so the client states the truth
 * instead of implying a reply rail that is not connected.
 */
export function status() {
  const channels = {};
  for (const ch of CHANNELS) {
    const hit = providerForChannel(ch);
    channels[ch] = hit
      ? { configured: true, provider: hit.name }
      : { configured: false, reason: 'no outbound provider is configured for this channel' };
  }
  return {
    anyConfigured: Object.values(channels).some((c) => c.configured),
    channels,
    providers: Object.fromEntries(
      Object.entries(OUTBOUND_PROVIDERS).map(([k, v]) => [k, v.status()])
    )
  };
}
