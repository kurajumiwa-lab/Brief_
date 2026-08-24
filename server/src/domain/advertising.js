// ---------------------------------------------------------------------------
// YARD ENGINE ADVERTISING
//
// Advertiser campaigns, creator matching, ad assets and settlement plans. This
// module composes with Brief's existing authorities:
//
//   identity      -> people / verified aliases
//   content       -> campaigns / objects
//   money         -> ledgerTransactions (never a second ledger)
//   activity      -> signals / workflows
//   delivery      -> outbound provider seam
//
// It is deliberately provider-neutral. Without a real disbursement provider,
// completion produces a durable, retryable `provider_unavailable` state rather
// than claiming that a creator was paid.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import { store, newId } from '../store.js';
import * as person from './person.js';
import * as profiles from './creatorProfile.js';
import * as ledger from './ledger.js';
import * as providers from '../providers.js';
import { emitSignal } from './signal.js';

export const AD_CAMPAIGN_STATUS = [
  'draft',
  'submitted',
  'funding_pending',
  'funded',
  'matching',
  'active',
  'settlement_pending',
  'completed',
  'rejected',
  'cancelled',
  'expired'
];

export const MATCH_STATUS = ['proposed', 'accepted', 'declined', 'expired', 'fulfilled', 'failed'];
export const SETTLEMENT_STATUS = ['pending', 'blocked', 'processing', 'paid', 'failed'];
export const AD_ASSET_STATUS = ['draft', 'approved', 'issued', 'revoked'];
export const TARGET_PLATFORMS = ['WHATSAPP_STATUS', 'FB_POST'];
export const CURRENCIES = profiles.CURRENCIES;
export const REGIONS = profiles.REGIONS;
export const PLATFORM_FEE_RATE = 0.05;
export const MAX_ACTIVE_ALLOCATIONS = 3;
export const MATCH_OFFER_HOURS = 48;

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function positiveAmount(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${field} must be positive`);
  return Math.round(n * 100) / 100;
}

function listOf(value, allowed, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const out = [...new Set(value.map((x) => text(x)).filter(Boolean))];
  if (out.some((x) => !allowed.includes(x))) throw new Error(`${field} contains an unsupported value`);
  return out;
}

function safeUrl(value) {
  const url = text(value);
  if (!url || !/^https:\/\//i.test(url)) return null;
  return url.slice(0, 2000);
}

function safeRedirectUrl(value) {
  const url = safeUrl(value);
  if (!url) return null;
  const configuredOrigin = text(process.env.BRIEF_PUBLIC_ORIGIN).replace(/\/+$/, '');
  if (!configuredOrigin) return url;
  try {
    if (new URL(url).origin !== new URL(configuredOrigin).origin) return null;
  } catch {
    return null;
  }
  return url;
}

function advertiserForPerson(personId) {
  return store.find('advertiserProfiles', (profile) => profile.personId === personId);
}

function personIdForActor(actorId) {
  if (!actorId) throw new Error('an authenticated actor is required');
  return person.personIdForUser(actorId);
}

export function ensureAdvertiser(actorId) {
  const personId = personIdForActor(actorId);
  const existing = advertiserForPerson(personId);
  if (existing) return existing;
  const p = person.getPerson(personId);
  const now = new Date().toISOString();
  return store.insert('advertiserProfiles', {
    id: newId('advertiser'),
    personId,
    displayName: p?.displayName ?? person.resolveDisplayName(actorId),
    status: 'active',
    createdAt: now,
    updatedAt: now
  });
}

export function getMyAdvertiserProfile(actorId) {
  return ensureAdvertiser(actorId);
}

export function updateAdvertiserProfile(actorId, patch = {}) {
  const personId = personIdForActor(actorId);
  const profile = advertiserForPerson(personId) ?? ensureAdvertiser(actorId);
  const clean = {};
  if ('displayName' in patch) {
    const value = text(patch.displayName);
    if (!value) throw new Error('displayName cannot be empty');
    clean.displayName = value.slice(0, 255);
  }
  if ('status' in patch) {
    if (!['active', 'paused'].includes(patch.status)) throw new Error('status must be active or paused');
    clean.status = patch.status;
  }
  return store.update('advertiserProfiles', profile.id, clean);
}

function campaignRowView(campaign) {
  if (!campaign) return null;
  return {
    ...campaign,
    budgetSummary: budgetSummary(campaign.id),
    matches: listMatches({ advertiserCampaignId: campaign.id }).map(matchViewForRoute)
  };
}

export function createCampaign(actorId, input = {}) {
  const advertiserId = personIdForActor(actorId);
  ensureAdvertiser(actorId);
  const title = text(input.title || input.campaignName);
  if (!title) throw new Error('title is required');
  const budget = positiveAmount(input.budget ?? input.totalBudget, 'budget');
  const currency = input.currency ?? 'KES';
  if (!CURRENCIES.includes(currency)) throw new Error(`currency must be one of ${CURRENCIES.join(', ')}`);
  const targetRegions = input.targetRegions ?? input.regions ?? [];
  const targetNiches = input.targetNiches ?? input.nicheTags ?? [];
  const regions = listOf(targetRegions, REGIONS, 'targetRegions');
  if (!Array.isArray(targetNiches)) throw new Error('targetNiches must be an array');
  const niches = [...new Set(targetNiches.map((x) => text(x)).filter(Boolean))].slice(0, 30);
  const requiredServiceType = input.requiredServiceType ?? input.requiredTier ?? 'DEDICATED_CAMPAIGN';
  if (!profiles.SERVICE_TYPES.includes(requiredServiceType)) {
    throw new Error(`requiredServiceType must be one of ${profiles.SERVICE_TYPES.join(', ')}`);
  }
  const expirationBoundAt = input.expirationBoundAt ?? input.expiresAt ?? null;
  if (expirationBoundAt && (!Number.isFinite(Date.parse(expirationBoundAt)) || Date.parse(expirationBoundAt) <= Date.now())) {
    throw new Error('expirationBoundAt must be a future timestamp');
  }
  const linkedCampaignId = input.campaignId ? String(input.campaignId) : null;
  if (linkedCampaignId) {
    const linked = store.find('campaigns', (row) => row.id === linkedCampaignId && (row.status === 'published' || row.status === 'live'));
    if (!linked) throw new Error('linked public campaign not found');
  }
  const linkedObjectId = input.objectId ? String(input.objectId) : null;
  if (linkedObjectId) {
    const linkedObject = store.find('objects', (row) => row.id === linkedObjectId && row.publication === 'public');
    if (!linkedObject) throw new Error('linked public object not found');
  }
  const now = new Date().toISOString();
  const row = store.insert('advertiserCampaigns', {
    id: newId('adcamp'),
    advertiserId,
    campaignId: linkedCampaignId,
    objectId: linkedObjectId,
    title,
    brief: text(input.brief || input.description),
    budget,
    currency,
    targetRegions: regions,
    targetNiches: niches,
    requiredServiceType,
    minInteractionThreshold: input.minInteractionThreshold && typeof input.minInteractionThreshold === 'object'
      ? { ...input.minInteractionThreshold }
      : {},
    maxActiveAllocations: Number.isInteger(input.maxActiveAllocations) && input.maxActiveAllocations > 0
      ? input.maxActiveAllocations
      : MAX_ACTIVE_ALLOCATIONS,
    status: 'draft',
    expirationBoundAt,
    fundingTransactionId: null,
    createdAt: now,
    updatedAt: now
  });
  emitSignal({ type: 'advertiser_campaign_created', actorId, metadata: { advertiserCampaignId: row.id } });
  return campaignRowView(row);
}

export function listCampaigns({ advertiserId = null, actorId = null, status = null } = {}) {
  const owner = advertiserId ?? (actorId ? personIdForActor(actorId) : null);
  let rows = store.all('advertiserCampaigns');
  if (owner) rows = rows.filter((row) => row.advertiserId === owner);
  if (status) rows = rows.filter((row) => row.status === status);
  return rows.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map(campaignRowView);
}

export function getCampaign(id, actorId = null) {
  const row = store.find('advertiserCampaigns', (campaign) => campaign.id === id);
  if (!row) return null;
  if (actorId && row.advertiserId !== personIdForActor(actorId)) return null;
  return campaignRowView(row);
}

function ownedCampaign(id, actorId) {
  const row = store.find('advertiserCampaigns', (campaign) => campaign.id === id);
  if (!row) throw new Error('advertiser campaign not found');
  if (row.advertiserId !== personIdForActor(actorId)) throw new Error('only the advertiser may change this campaign');
  return row;
}

export function updateCampaign(id, actorId, patch = {}) {
  const row = ownedCampaign(id, actorId);
  if (!['draft', 'submitted', 'funding_pending'].includes(row.status)) {
    throw new Error(`campaign cannot be edited while ${row.status}`);
  }
  const clean = {};
  if ('title' in patch) {
    const value = text(patch.title);
    if (!value) throw new Error('title cannot be empty');
    clean.title = value.slice(0, 255);
  }
  if ('brief' in patch || 'description' in patch) clean.brief = text(patch.brief ?? patch.description);
  if ('budget' in patch) clean.budget = positiveAmount(patch.budget, 'budget');
  if ('currency' in patch) {
    if (!CURRENCIES.includes(patch.currency)) throw new Error(`currency must be one of ${CURRENCIES.join(', ')}`);
    clean.currency = patch.currency;
  }
  if ('targetRegions' in patch) clean.targetRegions = listOf(patch.targetRegions, REGIONS, 'targetRegions');
  if ('targetNiches' in patch) {
    if (!Array.isArray(patch.targetNiches)) throw new Error('targetNiches must be an array');
    clean.targetNiches = [...new Set(patch.targetNiches.map((x) => text(x)).filter(Boolean))].slice(0, 30);
  }
  if ('requiredServiceType' in patch) {
    if (!profiles.SERVICE_TYPES.includes(patch.requiredServiceType)) throw new Error('invalid requiredServiceType');
    clean.requiredServiceType = patch.requiredServiceType;
  }
  if ('minInteractionThreshold' in patch) {
    if (!patch.minInteractionThreshold || typeof patch.minInteractionThreshold !== 'object') throw new Error('minInteractionThreshold must be an object');
    clean.minInteractionThreshold = { ...patch.minInteractionThreshold };
  }
  if ('expirationBoundAt' in patch) {
    if (patch.expirationBoundAt && Date.parse(patch.expirationBoundAt) <= Date.now()) throw new Error('expirationBoundAt must be in the future');
    clean.expirationBoundAt = patch.expirationBoundAt || null;
  }
  return campaignRowView(store.update('advertiserCampaigns', id, clean));
}

export function submitCampaign(id, actorId) {
  const row = ownedCampaign(id, actorId);
  if (row.status !== 'draft') throw new Error(`cannot submit from ${row.status}`);
  const updated = store.update('advertiserCampaigns', id, { status: 'funding_pending' });
  emitSignal({ type: 'advertiser_campaign_submitted', actorId, metadata: { advertiserCampaignId: id } });
  return campaignRowView(updated);
}

/**
 * Manual confirmation is the honest fallback when the provider is unavailable:
 * an authorized advertiser attests that funds arrived outside Brief. It creates
 * a held ledger row, never a settled/final row, and remains auditable.
 */
export function confirmFunding(id, actorId, { confirmation = false, reference = null } = {}) {
  const row = ownedCampaign(id, actorId);
  if (!confirmation) throw new Error('explicit funding confirmation is required');
  if (!['submitted', 'funding_pending'].includes(row.status)) {
    if (row.status === 'funded' || row.status === 'matching' || row.status === 'active') return { campaign: campaignRowView(row), reused: true };
    throw new Error(`campaign cannot be funded while ${row.status}`);
  }
  const prior = row.fundingTransactionId
    ? store.find('ledgerTransactions', (tx) => tx.id === row.fundingTransactionId)
    : store.find('ledgerTransactions', (tx) => tx.metadata?.advertiserCampaignId === id && tx.type === 'advertising_escrow');
  if (prior) {
    store.update('advertiserCampaigns', id, { status: 'funded', fundingTransactionId: prior.id });
    return { campaign: campaignRowView(store.find('advertiserCampaigns', (x) => x.id === id)), reused: true };
  }
  const tx = ledger.createTransaction({
    amount: row.budget,
    currency: row.currency,
    type: 'advertising_escrow',
    counterparty: row.advertiserId,
    metadata: {
      advertiserCampaignId: id,
      direction: 'inflow',
      state: 'held',
      source: 'manual_confirmation',
      reference: reference ? text(reference).slice(0, 120) : null
    }
  });
  ledger.transitionTransaction(tx.id, 'pending', 'funding received outside Brief');
  ledger.transitionTransaction(tx.id, 'confirmed', 'advertiser confirmed funding');
  ledger.transitionTransaction(tx.id, 'held', 'reserved for creator distribution');
  const updated = store.update('advertiserCampaigns', id, { status: 'funded', fundingTransactionId: tx.id });
  emitSignal({ type: 'advertiser_campaign_funded', actorId, metadata: { advertiserCampaignId: id, transactionId: tx.id, manual: true } });
  return { campaign: campaignRowView(updated), reused: false };
}

function interactionSummary(personId) {
  const p = person.getPerson(personId);
  const userIds = new Set((p?.aliases ?? []).filter((alias) => alias.kind === 'user').map((alias) => alias.value));
  const objectIds = new Set(store.filter('objects', (object) => object.publication === 'public' && userIds.has(object.capturedBy)).map((object) => object.id));
  const ownSignals = store.filter('signals', (signal) => userIds.has(signal.actorId));
  const objectSignals = store.filter('signals', (signal) => objectIds.has(signal.objectId));
  return {
    views: objectSignals.filter((signal) => signal.type === 'object_viewed').length,
    saves: objectSignals.filter((signal) => signal.type === 'object_saved').length,
    shares: objectSignals.filter((signal) => signal.type === 'object_shared').length,
    contributions: ownSignals.filter((signal) => signal.type === 'object_created').length
  };
}

function matchReasons(campaign, profile, card, interaction) {
  const regionMatch = campaign.targetRegions.length === 0 || card.regions.some((region) => campaign.targetRegions.includes(region)) || profile.regions.some((region) => campaign.targetRegions.includes(region));
  const nicheMatch = campaign.targetNiches.length === 0 || campaign.targetNiches.some((niche) => profile.nicheTags.includes(niche));
  const threshold = campaign.minInteractionThreshold ?? {};
  const interactionMatch = (!Number.isFinite(Number(threshold.views)) || interaction.views >= Number(threshold.views)) &&
    (!Number.isFinite(Number(threshold.saves)) || interaction.saves >= Number(threshold.saves)) &&
    (!Number.isFinite(Number(threshold.contributions)) || interaction.contributions >= Number(threshold.contributions));
  const serviceMatch = card.serviceType === campaign.requiredServiceType;
  return { region: regionMatch, niche: nicheMatch, interactionThreshold: interactionMatch, service: serviceMatch };
}

function allocationCount(personId) {
  return store.filter('queueReservations', (row) =>
    row.creatorId === personId && ['held', 'active'].includes(row.status) && (!row.expiresAt || Date.parse(row.expiresAt) > Date.now())
  ).length;
}

function currentMatches(campaignId) {
  return store.filter('campaignMatches', (match) => match.advertiserCampaignId === campaignId);
}

function reservedAmount(campaignId) {
  return currentMatches(campaignId)
    .filter((match) => ['proposed', 'accepted', 'fulfilled'].includes(match.status))
    .reduce((sum, match) => sum + Number(match.quotedAmount || 0), 0);
}

export function budgetSummary(campaignId) {
  const campaign = store.find('advertiserCampaigns', (row) => row.id === campaignId);
  if (!campaign) return null;
  const funding = store.filter('ledgerTransactions', (tx) => tx.metadata?.advertiserCampaignId === campaignId && tx.type === 'advertising_escrow');
  const paid = store.filter('ledgerTransactions', (tx) => tx.metadata?.advertiserCampaignId === campaignId && tx.type === 'ad_creator_payout' && tx.status === 'settled');
  const funded = funding.filter((tx) => tx.status === 'held' || tx.status === 'settled').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const paidOut = paid.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  return {
    budget: campaign.budget,
    currency: campaign.currency,
    funded,
    reserved: reservedAmount(campaignId),
    paidOut,
    remaining: Math.max(0, campaign.budget - reservedAmount(campaignId)),
    fundingTransactionId: campaign.fundingTransactionId
  };
}

/** Allocate the highest-fit rate cards until the campaign budget is reserved. */
export function allocate(id, actorId) {
  const campaign = ownedCampaign(id, actorId);
  if (!['funded', 'matching'].includes(campaign.status)) throw new Error(`campaign must be funded before matching; current status is ${campaign.status}`);
  const already = new Set(currentMatches(id).map((match) => `${match.creatorId}:${match.rateCardId}`));
  let remaining = Math.max(0, campaign.budget - reservedAmount(id));
  const candidates = [];

  for (const candidate of profiles.listMatchableCreators()) {
    const creator = candidate.profile;
    const interaction = interactionSummary(creator.personId);
    for (const card of candidate.rateCards) {
      const key = `${creator.personId}:${card.id}`;
      if (already.has(key) || card.currency !== campaign.currency) continue;
      const reasons = matchReasons(campaign, creator, card, interaction);
      if (!reasons.region || !reasons.niche || !reasons.interactionThreshold || !reasons.service) continue;
      if (allocationCount(creator.personId) >= campaign.maxActiveAllocations) continue;
      if (Number(card.basePrice) > remaining) continue;
      candidates.push({ creator, card, interaction, reasons });
    }
  }

  candidates.sort((a, b) =>
    (b.interaction.views - a.interaction.views) ||
    (a.creator.performance.activeAllocations - b.creator.performance.activeAllocations) ||
    (a.card.basePrice - b.card.basePrice)
  );

  const created = [];
  for (const candidate of candidates) {
    if (Number(candidate.card.basePrice) > remaining) continue;
    const now = new Date().toISOString();
    const offerExpiresAt = new Date(Date.now() + MATCH_OFFER_HOURS * 3600000).toISOString();
    const match = store.insert('campaignMatches', {
      id: newId('match'),
      advertiserCampaignId: id,
      creatorId: candidate.creator.personId,
      rateCardId: candidate.card.id,
      serviceType: candidate.card.serviceType,
      quotedAmount: candidate.card.basePrice,
      currency: candidate.card.currency,
      matchReason: { ...candidate.reasons, interaction: candidate.interaction },
      status: 'proposed',
      settlementStatus: 'pending',
      settlementReason: null,
      proofUrl: null,
      payoutTransactionId: null,
      providerRef: null,
      proposedAt: now,
      offerExpiresAt,
      fulfilledAt: null,
      createdAt: now,
      updatedAt: now
    });
    const reservation = store.insert('queueReservations', {
      id: newId('qres'),
      campaignMatchId: match.id,
      advertiserCampaignId: id,
      creatorId: candidate.creator.personId,
      queuePosition: allocationCount(candidate.creator.personId) + 1,
      capacityUnits: 1,
      status: 'held',
      reservedAt: now,
      expiresAt: offerExpiresAt,
      releasedAt: null,
      createdAt: now,
      updatedAt: now
    });
    store.update('campaignMatches', match.id, { queueReservationId: reservation.id });
    remaining -= Number(candidate.card.basePrice);
    created.push(store.find('campaignMatches', (row) => row.id === match.id));
    emitSignal({ type: 'creator_match_proposed', metadata: { advertiserCampaignId: id, campaignMatchId: match.id, creatorId: candidate.creator.personId } });
  }

  const updated = store.update('advertiserCampaigns', id, { status: created.length > 0 ? 'matching' : campaign.status });
  return {
    campaign: campaignRowView(updated),
    matches: created.map(matchViewForRoute),
    remainingBudget: remaining,
    reason: created.length > 0 ? null : 'no_eligible_creators'
  };
}

export function listMatches({ advertiserCampaignId = null, creatorId = null, actorId = null } = {}) {
  let creator = creatorId;
  if (!creator && actorId) creator = personIdForActor(actorId);
  let rows = store.all('campaignMatches');
  if (advertiserCampaignId) rows = rows.filter((match) => match.advertiserCampaignId === advertiserCampaignId);
  if (creator) rows = rows.filter((match) => match.creatorId === creator);
  return rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function matchViewForRoute(match) {
  const campaign = store.find('advertiserCampaigns', (row) => row.id === match.advertiserCampaignId);
  const profile = profiles.getProfileByPersonId(match.creatorId, { publishedOnly: false });
  const card = store.find('rateCards', (row) => row.id === match.rateCardId);
  const reservation = store.find('queueReservations', (row) => row.id === match.queueReservationId);
  return {
    ...match,
    campaignTitle: campaign?.title ?? null,
    creator: profile ? { id: profile.personId, fullName: profile.fullName, regions: profile.regions, nicheTags: profile.nicheTags } : null,
    rateCard: card ? { id: card.id, serviceType: card.serviceType, basePrice: card.basePrice, currency: card.currency } : null,
    reservation: reservation ? { id: reservation.id, status: reservation.status, expiresAt: reservation.expiresAt, queuePosition: reservation.queuePosition } : null
  };
}

function releaseReservation(match, status, reason) {
  const reservation = match.queueReservationId
    ? store.find('queueReservations', (row) => row.id === match.queueReservationId)
    : null;
  if (reservation && ['held', 'active'].includes(reservation.status)) {
    store.update('queueReservations', reservation.id, { status, releasedAt: new Date().toISOString(), releaseReason: reason });
  }
}

export function acceptMatch(id, actorId) {
  const match = store.find('campaignMatches', (row) => row.id === id);
  if (!match) throw new Error('campaign match not found');
  const creatorId = personIdForActor(actorId);
  if (match.creatorId !== creatorId) throw new Error('only the matched creator may accept this offer');
  if (match.status !== 'proposed') throw new Error(`match cannot be accepted while ${match.status}`);
  if (match.offerExpiresAt && Date.parse(match.offerExpiresAt) <= Date.now()) {
    expireMatch(id, 'offer_expired');
    throw new Error('match offer has expired');
  }
  const updated = store.update('campaignMatches', id, { status: 'accepted', acceptedAt: new Date().toISOString() });
  const reservation = store.find('queueReservations', (row) => row.id === match.queueReservationId);
  if (reservation) store.update('queueReservations', reservation.id, { status: 'active' });
  const campaign = store.find('advertiserCampaigns', (row) => row.id === match.advertiserCampaignId);
  if (campaign && ['funded', 'matching'].includes(campaign.status)) store.update('advertiserCampaigns', campaign.id, { status: 'active' });
  emitSignal({ type: 'creator_match_accepted', actorId, metadata: { campaignMatchId: id, advertiserCampaignId: match.advertiserCampaignId } });
  return matchViewForRoute(updated);
}

export function declineMatch(id, actorId) {
  const match = store.find('campaignMatches', (row) => row.id === id);
  if (!match) throw new Error('campaign match not found');
  const creatorId = personIdForActor(actorId);
  if (match.creatorId !== creatorId) throw new Error('only the matched creator may decline this offer');
  if (match.status !== 'proposed') throw new Error(`match cannot be declined while ${match.status}`);
  const updated = store.update('campaignMatches', id, { status: 'declined', declinedAt: new Date().toISOString() });
  releaseReservation(match, 'released', 'creator_declined');
  emitSignal({ type: 'creator_match_declined', actorId, metadata: { campaignMatchId: id, advertiserCampaignId: match.advertiserCampaignId } });
  return matchViewForRoute(updated);
}

export function expireMatch(id, reason = 'offer_expired') {
  const match = store.find('campaignMatches', (row) => row.id === id);
  if (!match || !['proposed', 'accepted'].includes(match.status)) return null;
  const updated = store.update('campaignMatches', id, { status: 'expired', settlementStatus: 'failed', settlementReason: reason });
  releaseReservation(match, 'released', reason);
  emitSignal({ type: 'queue_reservation_released', metadata: { campaignMatchId: id, advertiserCampaignId: match.advertiserCampaignId, reason } });
  return matchViewForRoute(updated);
}

export async function verifyFulfillment(id, actorId, { performanceVerified = false, proofUrl = null } = {}) {
  const match = store.find('campaignMatches', (row) => row.id === id);
  if (!match) throw new Error('campaign match not found');
  const campaign = ownedCampaign(match.advertiserCampaignId, actorId);
  if (!performanceVerified) throw new Error('explicit performance verification is required');
  if (match.status !== 'accepted') throw new Error(`match must be accepted before fulfilment; current status is ${match.status}`);
  const proof = proofUrl ? safeUrl(proofUrl) : null;
  const updated = store.update('campaignMatches', id, {
    status: 'fulfilled',
    fulfilledAt: new Date().toISOString(),
    performanceVerifiedAt: new Date().toISOString(),
    proofUrl: proof,
    settlementStatus: 'pending',
    settlementReason: null
  });
  releaseReservation(match, 'released', 'fulfilment_verified');
  emitSignal({ type: 'campaign_fulfilment_verified', actorId, metadata: { campaignMatchId: id, advertiserCampaignId: campaign.id } });
  const settlement = await settleMatch(id);
  return { match: settlement.match ?? matchViewForRoute(updated), settlement };
}

export function payoutPlan(id) {
  const match = store.find('campaignMatches', (row) => row.id === id);
  if (!match) return null;
  const gross = Number(match.quotedAmount);
  const platformFee = Math.round(gross * PLATFORM_FEE_RATE * 100) / 100;
  return {
    gross,
    currency: match.currency,
    platformFee,
    creatorPayout: Math.round((gross - platformFee) * 100) / 100,
    feeRate: PLATFORM_FEE_RATE
  };
}

function creatorPhone(personId) {
  const p = person.getPerson(personId);
  return p?.aliases?.find((alias) => alias.kind === 'phone' && alias.verified)?.value ?? null;
}

/** Attempt the final provider-backed release; safe to retry after configuration. */
export async function settleMatch(id, { fetchImpl = fetch } = {}) {
  const match = store.find('campaignMatches', (row) => row.id === id);
  if (!match) return { ok: false, reason: 'campaign_match_not_found' };
  const plan = payoutPlan(id);
  if (!plan) return { ok: false, reason: 'campaign_match_not_found' };
  if (match.settlementStatus === 'paid') return { ok: true, duplicate: true, plan, match: matchViewForRoute(match) };

  const providerName = providers.activeDisbursementProvider();
  const phone = creatorPhone(match.creatorId);
  if (!providerName) {
    const updated = store.update('campaignMatches', id, { settlementStatus: 'blocked', settlementReason: 'provider_unavailable' });
    const campaign = store.find('advertiserCampaigns', (row) => row.id === match.advertiserCampaignId);
    if (campaign && campaign.status !== 'completed') store.update('advertiserCampaigns', campaign.id, { status: 'settlement_pending' });
    emitSignal({ type: 'payout_ready', metadata: { campaignMatchId: id, advertiserCampaignId: match.advertiserCampaignId, reason: 'provider_unavailable' } });
    return { ok: false, reason: 'provider_unavailable', next: 'configure a disbursement provider and retry settlement', plan, match: matchViewForRoute(updated) };
  }
  if (!phone) {
    const updated = store.update('campaignMatches', id, { settlementStatus: 'blocked', settlementReason: 'creator_phone_missing' });
    return { ok: false, reason: 'creator_phone_missing', next: 'verify a creator phone alias and retry settlement', plan, match: matchViewForRoute(updated) };
  }

  store.update('campaignMatches', id, { settlementStatus: 'processing' });
  const provider = providers.disbursementProvider(providerName);
  let result;
  try {
    result = await provider.disburse({
      amount: Math.round(plan.creatorPayout),
      phone,
      remarks: `Brief advertising payout ${id}`,
      fetchImpl
    });
  } catch (error) {
    result = { ok: false, reason: 'provider_error', detail: String(error?.message ?? error) };
  }
  if (!result?.ok) {
    const updated = store.update('campaignMatches', id, { settlementStatus: 'failed', settlementReason: result?.reason ?? 'provider_rejected' });
    return { ok: false, reason: result?.reason ?? 'provider_rejected', plan, match: matchViewForRoute(updated) };
  }

  const tx = ledger.createTransaction({
    amount: plan.creatorPayout,
    currency: plan.currency,
    type: 'ad_creator_payout',
    counterparty: match.creatorId,
    metadata: {
      advertiserCampaignId: match.advertiserCampaignId,
      campaignMatchId: id,
      provider: providerName,
      providerRef: result.providerRef ?? null,
      direction: 'outflow',
      gross: plan.gross,
      platformFee: plan.platformFee
    }
  });
  ledger.transitionTransaction(tx.id, 'pending', 'provider accepted creator payout');
  ledger.transitionTransaction(tx.id, 'confirmed', 'provider confirmed creator payout');
  ledger.transitionTransaction(tx.id, 'settled', 'creator payout settled');
  const updated = store.update('campaignMatches', id, {
    settlementStatus: 'paid',
    settlementReason: null,
    payoutTransactionId: tx.id,
    providerRef: result.providerRef ?? null
  });
  const campaign = store.find('advertiserCampaigns', (row) => row.id === match.advertiserCampaignId);
  const allMatches = currentMatches(match.advertiserCampaignId);
  const complete = allMatches.length > 0 && allMatches.every((row) => row.id === id ? true : row.settlementStatus === 'paid' || ['declined', 'expired'].includes(row.status));
  if (complete && campaign) {
    const funding = campaign.fundingTransactionId ? store.find('ledgerTransactions', (row) => row.id === campaign.fundingTransactionId) : null;
    if (funding?.status === 'held') ledger.transitionTransaction(funding.id, 'settled', 'advertising campaign completed; platform retains derived fee');
    store.update('advertiserCampaigns', campaign.id, { status: 'completed' });
  }
  emitSignal({ type: 'advertising_payout_settled', metadata: { campaignMatchId: id, advertiserCampaignId: match.advertiserCampaignId, transactionId: tx.id } });
  return { ok: true, plan, match: matchViewForRoute(updated), transactionId: tx.id };
}

export async function retrySettlement(id, actorId, options = {}) {
  const match = store.find('campaignMatches', (row) => row.id === id);
  if (!match) throw new Error('campaign match not found');
  ownedCampaign(match.advertiserCampaignId, actorId);
  if (match.status !== 'fulfilled') throw new Error(`match must be fulfilled before settlement; current status is ${match.status}`);
  return settleMatch(id, options);
}

export function assetForTrackingHash(trackingHash, campaignId = null) {
  const asset = store.find('adAssets', (row) => row.uniqueTrackingHash === trackingHash && row.status === 'issued');
  if (!asset) return null;
  if (campaignId && asset.campaignId !== campaignId) return null;
  return asset;
}

export function recordAssetClick(trackingHash, { source = 'public', medium = 'asset' } = {}) {
  const asset = assetForTrackingHash(trackingHash);
  if (!asset) return null;
  const now = new Date().toISOString();
  const click = store.insert('clickEvents', {
    id: newId('click'),
    campaignId: asset.campaignId ?? null,
    advertiserCampaignId: asset.advertiserCampaignId,
    adAssetId: asset.id,
    trackingHash,
    creatorId: asset.creatorId,
    utmSource: String(source).slice(0, 64),
    utmMedium: String(medium).slice(0, 64),
    at: now
  });
  emitSignal({ type: 'tracked_asset_clicked', objectId: asset.objectId ?? null, metadata: { adAssetId: asset.id, advertiserCampaignId: asset.advertiserCampaignId, trackingHash } });
  return { asset, click };
}

function assetView(asset, actorId = null) {
  const canRead = actorId && (asset.advertiserId === personIdForActor(actorId) || asset.creatorId === personIdForActor(actorId));
  if (!canRead) return null;
  return { ...asset, trackingUrl: publicTrackingUrl(asset.uniqueTrackingHash) };
}

function publicTrackingUrl(hash) {
  const origin = process.env.BRIEF_PUBLIC_ORIGIN;
  return origin ? `${String(origin).replace(/\/+$/, '')}/api/public/ad/${encodeURIComponent(hash)}` : null;
}

function adCampaignForAsset(asset) {
  return store.find('advertiserCampaigns', (row) => row.id === asset.advertiserCampaignId);
}

export function createAsset(actorId, input = {}) {
  const advertiserId = personIdForActor(actorId);
  const campaign = ownedCampaign(input.advertiserCampaignId, actorId);
  if (!['funded', 'matching', 'active', 'settlement_pending'].includes(campaign.status)) {
    throw new Error(`assets cannot be issued while campaign is ${campaign.status}`);
  }
  const targetPlatform = input.targetPlatform ?? input.platform;
  if (!TARGET_PLATFORMS.includes(targetPlatform)) throw new Error(`targetPlatform must be one of ${TARGET_PLATFORMS.join(', ')}`);
  const creatorId = input.creatorId ? String(input.creatorId) : null;
  if (creatorId) {
    const match = store.find('campaignMatches', (row) => row.advertiserCampaignId === campaign.id && row.creatorId === creatorId && ['accepted', 'fulfilled'].includes(row.status));
    if (!match) throw new Error('creator does not have an accepted match for this campaign');
  }
  const baseRedirectUrl = safeRedirectUrl(input.baseRedirectUrl || input.rawRedirectUrl);
  if (!baseRedirectUrl) throw new Error('baseRedirectUrl must be an https URL on the configured public origin');
  const now = new Date().toISOString();
  let hash;
  do { hash = crypto.randomBytes(20).toString('hex'); } while (store.find('adAssets', (row) => row.uniqueTrackingHash === hash));
  const asset = store.insert('adAssets', {
    id: newId('asset'),
    advertiserCampaignId: campaign.id,
    advertiserId,
    campaignId: campaign.campaignId ?? null,
    objectId: campaign.objectId ?? null,
    creatorId,
    targetPlatform,
    baseRedirectUrl,
    uniqueTrackingHash: hash,
    mediaAssetUrl: safeUrl(input.mediaAssetUrl),
    optimizedCopyText: text(input.optimizedCopyText || input.copyText) || null,
    status: 'draft',
    approvedAt: null,
    issuedAt: null,
    createdAt: now,
    updatedAt: now
  });
  return assetView(asset, actorId);
}

export function listAssets({ actorId, advertiserCampaignId = null, creatorId = null } = {}) {
  const personId = personIdForActor(actorId);
  return store.all('adAssets')
    .filter((asset) => asset.advertiserId === personId || asset.creatorId === personId)
    .filter((asset) => !advertiserCampaignId || asset.advertiserCampaignId === advertiserCampaignId)
    .filter((asset) => !creatorId || asset.creatorId === creatorId)
    .map((asset) => assetView(asset, actorId));
}

export function approveAsset(id, actorId) {
  const asset = store.find('adAssets', (row) => row.id === id);
  if (!asset) throw new Error('ad asset not found');
  if (asset.advertiserId !== personIdForActor(actorId)) throw new Error('only the advertiser may approve this asset');
  if (asset.status !== 'draft') throw new Error(`asset cannot be approved while ${asset.status}`);
  const updated = store.update('adAssets', id, { status: 'approved', approvedAt: new Date().toISOString() });
  emitSignal({ type: 'ad_asset_approved', metadata: { adAssetId: id, advertiserCampaignId: asset.advertiserCampaignId } });
  return assetView(updated, actorId);
}

export function issueAsset(id, actorId) {
  const asset = store.find('adAssets', (row) => row.id === id);
  if (!asset) throw new Error('ad asset not found');
  const personId = personIdForActor(actorId);
  if (asset.advertiserId !== personId && asset.creatorId !== personId) throw new Error('not authorised to issue this asset');
  if (!['approved', 'issued'].includes(asset.status)) throw new Error(`asset must be approved before issue; current status is ${asset.status}`);
  const updated = store.update('adAssets', id, { status: 'issued', issuedAt: new Date().toISOString() });
  emitSignal({ type: 'ad_asset_issued', actorId, metadata: { adAssetId: id, advertiserCampaignId: asset.advertiserCampaignId } });
  return assetView(updated, actorId);
}

export function distributionKit(id, actorId) {
  const asset = store.find('adAssets', (row) => row.id === id);
  if (!asset) throw new Error('ad asset not found');
  const personId = personIdForActor(actorId);
  if (asset.advertiserId !== personId && asset.creatorId !== personId) throw new Error('not authorised to read this asset');
  if (!['approved', 'issued'].includes(asset.status)) throw new Error('asset must be approved before a distribution kit can be issued');
  const campaign = adCampaignForAsset(asset);
  const publicUrl = publicTrackingUrl(asset.uniqueTrackingHash);
  const copy = asset.optimizedCopyText;
  const media = asset.mediaAssetUrl;
  const unavailable = [];
  if (!publicUrl) unavailable.push('BRIEF_PUBLIC_ORIGIN');
  if (!media) unavailable.push('mediaAssetUrl');
  if (!copy) unavailable.push('optimizedCopyText');
  const caption = publicUrl && copy ? `${copy} ${publicUrl}` : null;
  return {
    asset: assetView(asset, actorId),
    available: unavailable.length === 0,
    unavailable,
    tracking: {
      hash: asset.uniqueTrackingHash,
      url: publicUrl
    },
    distributionKits: {
      whatsappStatus: {
        actionType: 'ONE_CLICK_COPY',
        mediaPayloadUrl: media,
        captionTemplate: caption,
        autoPublish: false,
        reason: 'Brief prepares a status-ready asset; it does not claim personal WhatsApp Status publishing.'
      },
      facebookFeed: {
        actionType: 'OPEN_GRAPH_CARD',
        ogTags: {
          'og:title': campaign?.title ?? asset.optimizedCopyText ?? 'Brief campaign',
          'og:description': copy,
          'og:image': media,
          'og:url': publicUrl
        }
      }
    }
  };
}

export function expireCampaign(id, reason = 'expiration_bound_reached') {
  const campaign = store.find('advertiserCampaigns', (row) => row.id === id);
  if (!campaign || ['completed', 'cancelled', 'expired'].includes(campaign.status)) return null;
  const updated = store.update('advertiserCampaigns', id, { status: 'expired', expirationReason: reason });
  for (const match of currentMatches(id)) {
    if (['proposed', 'accepted'].includes(match.status)) expireMatch(match.id, reason);
  }
  emitSignal({ type: 'advertiser_campaign_expired', metadata: { advertiserCampaignId: id, reason } });
  return campaignRowView(updated);
}

/** Time-based sweep hook; safe to call from a worker or a request. */
export function sweep() {
  const now = Date.now();
  const expiredCampaigns = [];
  for (const campaign of store.all('advertiserCampaigns')) {
    if (campaign.expirationBoundAt && Date.parse(campaign.expirationBoundAt) <= now && !['completed', 'cancelled', 'expired'].includes(campaign.status)) {
      expiredCampaigns.push(expireCampaign(campaign.id));
    }
  }
  const expiredMatches = [];
  for (const match of store.all('campaignMatches')) {
    if (match.offerExpiresAt && Date.parse(match.offerExpiresAt) <= now && ['proposed', 'accepted'].includes(match.status)) {
      const hit = expireMatch(match.id);
      if (hit) expiredMatches.push(hit);
    }
  }
  return { expiredCampaigns: expiredCampaigns.length, expiredMatches: expiredMatches.length };
}
