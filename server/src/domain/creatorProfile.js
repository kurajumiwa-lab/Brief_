// ---------------------------------------------------------------------------
// CREATOR PROFILES + RATE CARDS (Yard Engine)
//
// A creator profile is a view over one canonical `people` row. It adds
// discovery preferences and public links without creating a second identity.
// Rate cards are quotes for services; they are not listings and never create a
// ledger transaction by themselves.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as person from './person.js';

export const REGIONS = ['US_METRO', 'KE', 'NG', 'ZA'];
export const CURRENCIES = ['USD', 'KES', 'NGN', 'ZAR'];
export const SERVICE_TYPES = [
  'WHATSAPP_STATUS',
  'FB_POST',
  'DEDICATED_CAMPAIGN',
  'EVENT_APPEARANCE'
];
export const PROFILE_STATUS = ['draft', 'active', 'paused'];
export const RATE_CARD_STATUS = ['draft', 'published', 'paused', 'archived'];

const SOCIAL_KEYS = new Set(['instagram', 'facebook', 'x', 'tiktok', 'website', 'telegram', 'whatsapp']);

function cleanText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function cleanRegions(value, fallback = []) {
  const values = Array.isArray(value) ? value : fallback;
  return [...new Set(values.filter((region) => REGIONS.includes(region)))];
}

function cleanLinks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const links = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!SOCIAL_KEYS.has(key) || typeof raw !== 'string') continue;
    const url = raw.trim();
    if (/^https:\/\//i.test(url)) links[key] = url.slice(0, 500);
  }
  return links;
}

function profileForPerson(personId) {
  return store.find('creatorProfiles', (profile) => profile.personId === personId);
}

function actorPersonId(actorId) {
  if (!actorId) throw new Error('an authenticated creator is required');
  return person.personIdForUser(actorId);
}

function creatorProfileView(profile) {
  if (!profile) return null;
  const p = person.getPerson(profile.personId);
  return {
    ...profile,
    personId: profile.personId,
    aliases: p?.aliases ?? [],
    rateCards: listRateCards({ creatorId: profile.personId, status: 'published' }),
    performance: performanceSummary(profile.personId)
  };
}

/** Create the profile if it does not exist, or return the existing one. */
export function ensureProfile(actorId) {
  const personId = actorPersonId(actorId);
  const existing = profileForPerson(personId);
  if (existing) return creatorProfileView(existing);
  const p = person.getPerson(personId);
  const now = new Date().toISOString();
  const profile = store.insert('creatorProfiles', {
    id: newId('cprof'),
    personId,
    fullName: p?.displayName ?? person.resolveDisplayName(actorId),
    preferredLanguage: 'en',
    regions: [],
    nicheTags: [],
    externalSocialLinks: {},
    status: 'draft',
    createdAt: now,
    updatedAt: now
  });
  return creatorProfileView(profile);
}

export function getMyProfile(actorId) {
  return ensureProfile(actorId);
}

export function getProfileByPersonId(personId, { publishedOnly = false } = {}) {
  const profile = profileForPerson(personId);
  if (!profile) return null;
  if (publishedOnly && profile.status !== 'active') return null;
  return creatorProfileView(profile);
}

export function updateProfile(actorId, patch = {}) {
  const personId = actorPersonId(actorId);
  const profile = profileForPerson(personId) ?? ensureProfile(actorId);
  const clean = {};

  if ('fullName' in patch) {
    const name = cleanText(patch.fullName);
    if (!name) throw new Error('fullName cannot be empty');
    clean.fullName = name.slice(0, 255);
  }
  if ('preferredLanguage' in patch) {
    const language = cleanText(patch.preferredLanguage);
    if (!language) throw new Error('preferredLanguage cannot be empty');
    clean.preferredLanguage = language.slice(0, 32);
  }
  if ('regions' in patch) {
    const regions = cleanRegions(patch.regions);
    if (Array.isArray(patch.regions) && patch.regions.length !== regions.length) {
      throw new Error(`regions must be from ${REGIONS.join(', ')}`);
    }
    clean.regions = regions;
  }
  if ('nicheTags' in patch) {
    if (!Array.isArray(patch.nicheTags)) throw new Error('nicheTags must be an array');
    clean.nicheTags = [...new Set(patch.nicheTags.map((tag) => cleanText(tag)).filter(Boolean))].slice(0, 20);
  }
  if ('externalSocialLinks' in patch) clean.externalSocialLinks = cleanLinks(patch.externalSocialLinks);
  if ('status' in patch) {
    if (!PROFILE_STATUS.includes(patch.status)) throw new Error(`status must be one of ${PROFILE_STATUS.join(', ')}`);
    clean.status = patch.status;
  }

  const updated = store.update('creatorProfiles', profile.id, clean);
  return creatorProfileView(updated);
}

export function createRateCard(actorId, input = {}) {
  const personId = actorPersonId(actorId);
  const profile = profileForPerson(personId) ?? ensureProfile(actorId);
  const serviceType = input.serviceType ?? input.tier;
  if (!SERVICE_TYPES.includes(serviceType)) {
    throw new Error(`serviceType must be one of ${SERVICE_TYPES.join(', ')}`);
  }
  const basePrice = Number(input.basePrice);
  if (!Number.isFinite(basePrice) || basePrice <= 0) throw new Error('basePrice must be positive');
  const currency = input.currency ?? 'KES';
  if (!CURRENCIES.includes(currency)) throw new Error(`currency must be one of ${CURRENCIES.join(', ')}`);
  const regions = cleanRegions(input.regions, profile.regions);
  if (regions.length === 0) throw new Error('at least one region is required');

  const duplicate = store.find('rateCards', (card) =>
    card.creatorId === personId && card.serviceType === serviceType && card.status !== 'archived'
  );
  if (duplicate) throw new Error('a rate card for this service already exists');

  const now = new Date().toISOString();
  const card = store.insert('rateCards', {
    id: newId('rate'),
    creatorId: personId,
    serviceType,
    basePrice,
    currency,
    regions,
    fulfillmentMetrics: input.fulfillmentMetrics && typeof input.fulfillmentMetrics === 'object'
      ? { ...input.fulfillmentMetrics }
      : {},
    availability: input.availability === 'closed' ? 'closed' : 'open',
    status: input.status === 'published' ? 'published' : 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now
  });
  return card;
}

export function listRateCards({ creatorId = null, status = null, serviceType = null } = {}) {
  let rows = store.all('rateCards');
  if (creatorId) rows = rows.filter((card) => card.creatorId === creatorId);
  if (status) rows = rows.filter((card) => card.status === status);
  if (serviceType) rows = rows.filter((card) => card.serviceType === serviceType);
  return rows.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function updateRateCard(actorId, id, patch = {}) {
  const personId = actorPersonId(actorId);
  const card = store.find('rateCards', (row) => row.id === id && row.creatorId === personId);
  if (!card) throw new Error('rate card not found');
  const clean = {};

  if ('basePrice' in patch) {
    const price = Number(patch.basePrice);
    if (!Number.isFinite(price) || price <= 0) throw new Error('basePrice must be positive');
    clean.basePrice = price;
  }
  if ('currency' in patch) {
    if (!CURRENCIES.includes(patch.currency)) throw new Error(`currency must be one of ${CURRENCIES.join(', ')}`);
    clean.currency = patch.currency;
  }
  if ('regions' in patch) {
    const regions = cleanRegions(patch.regions);
    if (!Array.isArray(patch.regions) || regions.length !== patch.regions.length || regions.length === 0) {
      throw new Error(`regions must be non-empty values from ${REGIONS.join(', ')}`);
    }
    clean.regions = regions;
  }
  if ('fulfillmentMetrics' in patch) {
    if (!patch.fulfillmentMetrics || typeof patch.fulfillmentMetrics !== 'object') throw new Error('fulfillmentMetrics must be an object');
    clean.fulfillmentMetrics = { ...patch.fulfillmentMetrics };
  }
  if ('availability' in patch) {
    if (!['open', 'closed'].includes(patch.availability)) throw new Error('availability must be open or closed');
    clean.availability = patch.availability;
  }
  if ('status' in patch) {
    if (!RATE_CARD_STATUS.includes(patch.status)) throw new Error(`status must be one of ${RATE_CARD_STATUS.join(', ')}`);
    clean.status = patch.status;
  }
  clean.version = (card.version ?? 1) + 1;
  return store.update('rateCards', id, clean);
}

/** Counts of actual activity; no synthetic quality score is stored. */
export function performanceSummary(personId) {
  const matches = store.filter('campaignMatches', (match) => match.creatorId === personId);
  const reservations = store.filter('queueReservations', (row) => row.creatorId === personId);
  const completedDeliveries = matches.filter((match) => match.status === 'fulfilled').length;
  const failedDeliveries = matches.filter((match) => ['declined', 'expired', 'failed'].includes(match.status)).length;
  const activeAllocations = reservations.filter((row) => ['held', 'active'].includes(row.status) && (!row.expiresAt || Date.parse(row.expiresAt) > Date.now())).length;
  return {
    completedDeliveries,
    failedDeliveries,
    activeAllocations,
    totalMatches: matches.length
  };
}

/** Candidate profiles visible to the matching engine. */
export function listMatchableCreators() {
  return store.filter('creatorProfiles', (profile) => profile.status === 'active')
    .map((profile) => ({
      profile: creatorProfileView(profile),
      rateCards: listRateCards({ creatorId: profile.personId, status: 'published' })
        .filter((card) => card.availability === 'open')
    }))
    .filter((row) => row.rateCards.length > 0);
}
