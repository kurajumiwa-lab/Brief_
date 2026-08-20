// ---------------------------------------------------------------------------
// TWILIO OUTBOUND CONNECTOR (SMS + WhatsApp-send)
//
// The first outbound provider behind the channel seam (see outbound.js). It
// mirrors the Tuma connector's discipline exactly: capabilities + credential
// state + fail-closed send + a test seam, and it NEVER claims a message was
// sent unless Twilio accepted it.
//
// THE ACTUAL TWILIO CONTRACT (REST API v2010-04-01):
//   Base   https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
//   Auth   HTTP Basic (AccountSid : AuthToken)
//   Body   application/x-www-form-urlencoded
//            SMS:       To, From (E.164)   | or MessagingServiceSid
//            WhatsApp:  To=whatsapp:+..., From=whatsapp:+..., Body
//   Success 201 -> { sid, status: "queued"|"sent", ... }
//   Error   4xx/5xx -> { code, message, more_info }
//
// CREDENTIALS (server-side only; never in the client bundle):
//   TWILIO_ACCOUNT_SID          -- the account SID from the Twilio console
//   TWILIO_AUTH_TOKEN           -- the auth token (do NOT use the API key here)
//   TWILIO_SMS_FROM             -- E.164 sender, e.g. +2547XXXXXXXX  (SMS)
//   TWILIO_MESSAGING_SERVICE_SID -- optional: replaces From for SMS
//   TWILIO_WHATSAPP_FROM        -- whatsapp:+XXXXXXXXXXXX  (WhatsApp sender)
// ---------------------------------------------------------------------------

export const capabilities = {
  connector: 'twilio',
  channels: ['sms', 'whatsapp'],
  authenticate: 'HTTP Basic (Account SID + Auth Token)',
  sms: 'yes - Messages.json with an E.164 From or a Messaging Service SID',
  whatsapp: 'yes - Messages.json with a whatsapp:+ sender (WhatsApp Business API)',
  callbacks: 'Twilio status callbacks are not wired yet; a send returns the message SID and initial status only',
  notes: 'Outbound only. Inbound SMS/WhatsApp receive is a separate, unbuilt rail.'
};

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

/** The channels this connector can send on. */
export const channels = ['sms', 'whatsapp'];

/** Which credentials are present, reported per channel. */
export function credentialState() {
  const sid = Boolean(env('TWILIO_ACCOUNT_SID'));
  const token = Boolean(env('TWILIO_AUTH_TOKEN'));
  const smsFrom = Boolean(env('TWILIO_SMS_FROM') || env('TWILIO_MESSAGING_SERVICE_SID'));
  const waFrom = Boolean(env('TWILIO_WHATSAPP_FROM'));
  return {
    accountSid: sid,
    authToken: token,
    smsFrom,
    whatsappFrom: waFrom
  };
}

/** Is a given channel sendable right now? Fail-closed, like Tuma. */
export function isConfigured(channel = 'sms') {
  const c = credentialState();
  if (!c.accountSid || !c.authToken) return false;
  if (channel === 'sms') return c.smsFrom;
  if (channel === 'whatsapp') return c.whatsappFrom;
  return false;
}

/** Missing credentials for a channel, so an operator sees exactly what to add. */
export function missingCredentials(channel = 'sms') {
  const c = credentialState();
  const missing = [];
  if (!c.accountSid) missing.push('accountSid');
  if (!c.authToken) missing.push('authToken');
  if (channel === 'sms' && !c.smsFrom) missing.push('smsFrom');
  if (channel === 'whatsapp' && !c.whatsappFrom) missing.push('whatsappFrom');
  return missing;
}

export function status() {
  return {
    provider: 'twilio',
    sms: { configured: isConfigured('sms'), missing: missingCredentials('sms') },
    whatsapp: { configured: isConfigured('whatsapp'), missing: missingCredentials('whatsapp') },
    reason: (isConfigured('sms') || isConfigured('whatsapp'))
      ? null
      : 'Twilio is not configured for any channel. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN and a sender (TWILIO_SMS_FROM / TWILIO_MESSAGING_SERVICE_SID / TWILIO_WHATSAPP_FROM).'
  };
}

// ---------------------------------------------------------------------------
// PHONE NORMALISATION
// ---------------------------------------------------------------------------

/**
 * Twilio wants E.164 with a leading '+'. Kenyan users type 0722..., +254722...,
 * or 722.... Normalised here so a bad number is refused before it becomes a
 * failed send. Returns null for anything that is not a Kenyan mobile number.
 */
export function normalisePhone(input) {
  const digits = String(input ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('254')) { /* already correct */ }
  else if (n.startsWith('0')) n = `254${n.slice(1)}`;
  else if (n.length === 9 && (n.startsWith('7') || n.startsWith('1'))) n = `254${n}`;
  else return null;
  if (!/^254[71][0-9]{8}$/.test(n)) return null;
  return `+${n}`;
}

// ---------------------------------------------------------------------------
// SEND
// ---------------------------------------------------------------------------

/**
 * Send an outbound message on one channel.
 *
 * Fail-closed: unconfigured -> honest refusal. A refused number, an invalid
 * sender, or a Twilio-side error is returned as a failure with the provider's
 * own message -- never swallowed, never faked as success.
 */
export async function send({ channel = 'sms', to, text, fetchImpl = fetch }) {
  if (!isConfigured(channel)) {
    return { ok: false, reason: 'not_configured', channel, missing: missingCredentials(channel) };
  }
  const msisdn = normalisePhone(to);
  if (!msisdn) return { ok: false, reason: 'invalid_phone', channel };
  const body = String(text ?? '').trim();
  if (!body) return { ok: false, reason: 'empty_text', channel };
  if (body.length > 1600) return { ok: false, reason: 'text_too_long', channel }; // Twilio's practical cap

  const sid = env('TWILIO_ACCOUNT_SID');
  const auth = env('TWILIO_AUTH_TOKEN');
  const basic = Buffer.from(`${sid}:${auth}`).toString('base64');

  const params = new URLSearchParams();
  params.set('Body', body);
  if (channel === 'whatsapp') {
    params.set('From', env('TWILIO_WHATSAPP_FROM'));
    params.set('To', `whatsapp:${msisdn}`);
  } else {
    const serviceSid = env('TWILIO_MESSAGING_SERVICE_SID');
    if (serviceSid) params.set('MessagingServiceSid', serviceSid);
    else params.set('From', env('TWILIO_SMS_FROM'));
    params.set('To', msisdn);
  }

  try {
    const res = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      }
    );
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        reason: 'send_rejected',
        channel,
        status: res.status,
        code: json?.code ?? null,
        message: json?.message ?? `HTTP ${res.status}`
      };
    }
    return {
      ok: true,
      channel,
      // The provider reference Brief can reconcile against later.
      sid: json?.sid ?? null,
      status: json?.status ?? null,
      to: msisdn
    };
  } catch (e) {
    return { ok: false, reason: 'network_error', channel, message: String(e.message ?? e) };
  }
}
