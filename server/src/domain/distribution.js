// ---------------------------------------------------------------------------
// DISTRIBUTION — cross-platform campaign blast + UTM click attribution
// (four-screen build B)
//
// Screen 4 closes the loop the blueprint wants: a host configures a campaign,
// the workflow engine wraps the payload in unique tracking identifiers (UTM),
// sends it to external channels, and captures the clicks that come back so the
// host sees which channel actually produced interest.
//
// HONESTY:
//   * a blast SENDs through the outbound seam (Twilio SMS/WhatsApp) when that
//     rail is configured; a channel with no send connector (Telegram has only
//     ingest, X has no connector) is reported as such — never faked as sent
//   * a click is a REAL server-side event: the tracked link points at /api/click,
//     which records the hit and 302-redirects to the campaign. Attribution is
//     counted, never guessed.
//   * clicks are aggregated into campaign analytics as clicks + clicksBySource,
//     distinct from views (page loads) and shares (intent).
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as outbound from '../outbound.js';

/** The tracked URL for a campaign + source. Public origin required (honest null otherwise). */
export function trackedLink(campaign, publicOrigin, { source = 'link', medium = 'social', content = null } = {}) {
  if (!publicOrigin) return null;
  const base = String(publicOrigin).replace(/\/+$/, '');
  const p = new URLSearchParams({
    c: campaign.publicSlug,
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign.id
  });
  if (content) p.set('utm_content', String(content).slice(0, 64));
  return `${base}/api/click?${p.toString()}`;
}

/** Resolve a recipient to a concrete send, returning an honest per-channel result. */
function sendOne(recipient, text) {
  const channel = recipient.channel;
  if (channel === 'telegram') {
    return { ok: false, reason: 'no_send_connector', channel, detail: 'Telegram is ingest-only; no send adapter exists yet.' };
  }
  if (channel === 'x') {
    return { ok: false, reason: 'no_connector', channel, detail: 'No X connector is configured.' };
  }
  if (channel !== 'sms' && channel !== 'whatsapp') {
    return { ok: false, reason: 'unknown_channel', channel };
  }
  if (!recipient.to) return { ok: false, reason: 'missing_recipient', channel };
  return outbound.send({ channel, to: recipient.to, text });
}

/**
 * Blast a campaign's tracked link to a set of recipients. Each recipient gets a
 * UTM-tagged link carrying its own source; the result is per-recipient so the
 * host sees exactly which sends succeeded and which channels are unavailable.
 */
export async function blast(campaign, { recipients = [], message = null, publicOrigin = null } = {}) {
  // Re-read the live row: callers may hold a stale object whose status has
  // since moved (draft -> live). A draft must never blast.
  const fresh = campaign?.id ? store.find('campaigns', (c) => c.id === campaign.id) : null;
  if (!fresh) return { ok: false, reason: 'campaign_not_found' };
  if (fresh.status === 'draft') return { ok: false, reason: 'campaign_is_draft' };
  const origin = publicOrigin || process.env.BRIEF_PUBLIC_ORIGIN || null;
  if (!origin) return { ok: false, reason: 'public_origin_not_configured' };

  const results = [];
  for (const r of recipients) {
    const link = trackedLink(fresh, origin, { source: r.channel ?? 'link', medium: r.medium ?? 'social', content: r.content ?? null });
    if (!link) { results.push({ channel: r.channel, ok: false, reason: 'no_link' }); continue; }
    const text = message ?? `${fresh.title} — ${link}`;
    const sent = await sendOne(r, `${text} ${link}`);
    results.push({ channel: r.channel, ok: sent.ok, reason: sent.reason ?? null, ...(sent.sid ? { sid: sent.sid } : {}), ...(sent.detail ? { detail: sent.detail } : {}) });
  }

  const ok = results.filter((r) => r.ok).length;
  return { ok: ok > 0, sent: ok, total: results.length, results };
}

/**
 * Record an incoming click from a UTM-tagged link. Returns the campaign to
 * redirect to, or null when the campaign is unknown/removed. Never redirects to
 * a foreign host — the target is always the canonical campaign path.
 */
export function recordClick(query) {
  const slug = String(query?.c ?? '');
  const campaign = store.find('campaigns', (x) => x.publicSlug === slug);
  if (!campaign) return null;

  store.insert('clickEvents', {
    id: newId('click'),
    campaignId: campaign.id,
    slug,
    utmSource: String(query?.utm_source ?? 'unknown').slice(0, 64),
    utmMedium: String(query?.utm_medium ?? 'unknown').slice(0, 64),
    utmContent: query?.utm_content ? String(query.utm_content).slice(0, 64) : null,
    at: new Date().toISOString()
  });

  // Also emit a signal so the click flows through the existing engagement rails.
  store.insert('signals', {
    id: newId('sig'),
    type: 'campaign_clicked',
    actorId: null,
    objectId: campaign.objectId,
    metadata: {
      campaignId: campaign.id,
      utmSource: String(query?.utm_source ?? 'unknown').slice(0, 64),
      utmMedium: String(query?.utm_medium ?? 'unknown').slice(0, 64)
    },
    createdAt: new Date().toISOString()
  });

  return campaign;
}

/** Clicks + clicksBySource for a campaign, for the analytics surface. */
export function clicksFor(campaignId) {
  const clicks = store.filter('clickEvents', (c) => c.campaignId === campaignId);
  const bySource = {};
  for (const c of clicks) {
    bySource[c.utmSource] = (bySource[c.utmSource] ?? 0) + 1;
  }
  return { clicks: clicks.length, clicksBySource: bySource };
}
