// ---------------------------------------------------------------------------
// STANDALONE CAMPAIGN BANNERS
//
// A banner is a presentation wrapper over a PUBLISHED Brief campaign. It is
// not a second campaign, a reach counter, or a paid placement. Creating one
// gives a host a clean standalone card for the home shelf and the same
// server-configured canonical link they can share on WhatsApp.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as campaigns from './campaign.js';
import { emitSignal } from './signal.js';

export const BANNER_STATUS = ['active', 'archived'];
const MAX_BANNERS = 6;

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function safeImageUrl(value) {
  const url = text(value);
  if (!url) return null;
  if (!/^https:\/\//i.test(url)) throw new Error('imageUrl must be an https URL');
  return url.slice(0, 2000);
}

function campaignFor(id) {
  return store.find('campaigns', (campaign) => campaign.id === id) ?? null;
}

function bannerView(row) {
  const campaign = campaignFor(row.campaignId);
  if (!campaign) return null;
  const share = campaigns.shareView(campaign, process.env.BRIEF_PUBLIC_ORIGIN || null);
  return {
    id: row.id,
    campaignId: row.campaignId,
    title: row.headline || campaign.title,
    body: row.body || campaign.description || null,
    location: campaign.location ?? null,
    startsAt: campaign.startsAt ?? null,
    imageUrl: row.imageUrl ?? null,
    status: row.status,
    createdAt: row.createdAt,
    share: share.available
      ? { available: true, url: share.url, channels: { whatsapp: share.channels.whatsapp } }
      : { available: false, reason: share.reason }
  };
}

export function createBanner({ campaignId, ownerId, headline = '', body = '', imageUrl = null } = {}) {
  const campaign = campaignFor(campaignId);
  if (!campaign) throw new Error('campaign not found');
  if (campaign.ownerId !== ownerId) throw new Error('only the campaign owner may create its banner');
  if (!['published', 'live'].includes(campaign.status)) {
    throw new Error('publish the campaign before creating a banner');
  }

  const existing = store.find('campaignBanners', (row) => row.campaignId === campaignId && row.status === 'active');
  if (existing) return { banner: bannerView(existing), reused: true };

  const active = store.filter('campaignBanners', (row) => row.ownerId === ownerId && row.status === 'active');
  if (active.length >= MAX_BANNERS) {
    throw new Error(`a host may have at most ${MAX_BANNERS} active banners`);
  }

  const row = store.insert('campaignBanners', {
    id: newId('banner'),
    campaignId,
    ownerId,
    headline: text(headline).slice(0, 120),
    body: text(body).slice(0, 240),
    imageUrl: safeImageUrl(imageUrl),
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  emitSignal({
    type: 'campaign_banner_created',
    actorId: ownerId,
    objectId: campaign.objectId,
    metadata: { bannerId: row.id, campaignId }
  });
  return { banner: bannerView(row), reused: false };
}

export function listActive({ limit = MAX_BANNERS } = {}) {
  const rows = store
    .all('campaignBanners')
    .filter((row) => row.status === 'active')
    .filter((row) => {
      const campaign = campaignFor(row.campaignId);
      return campaign && ['published', 'live'].includes(campaign.status);
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, Math.max(0, Math.min(Number(limit) || MAX_BANNERS, MAX_BANNERS)));
  return rows.map(bannerView).filter(Boolean);
}

export function listMine(ownerId) {
  return store
    .all('campaignBanners')
    .filter((row) => row.ownerId === ownerId)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map(bannerView)
    .filter(Boolean);
}

export function getMine(campaignId, ownerId) {
  const row = store.find('campaignBanners', (candidate) =>
    candidate.campaignId === campaignId && candidate.ownerId === ownerId && candidate.status === 'active'
  );
  return row ? bannerView(row) : null;
}

export function archive(id, ownerId) {
  const row = store.find('campaignBanners', (candidate) => candidate.id === id);
  if (!row) throw new Error('banner not found');
  if (row.ownerId !== ownerId) throw new Error('only the banner owner may archive it');
  if (row.status === 'archived') return bannerView(row);
  return bannerView(store.update('campaignBanners', id, {
    status: 'archived',
    updatedAt: new Date().toISOString()
  }));
}
