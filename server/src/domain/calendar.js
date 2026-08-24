// ---------------------------------------------------------------------------
// CALENDAR + EXPIRATION-BOUNDED WAIT LISTS (Yard Engine)
//
// Campaign dates/capacity already exist in Brief. This module adds the missing
// chronology layer without copying campaign state: calendar entries point at
// the existing campaign/advertiser campaign, while wait-list rows point at the
// existing public campaign and registration.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as campaigns from './campaign.js';
import * as advertising from './advertising.js';
import { personIdForUser } from './person.js';
import { emitSignal } from './signal.js';

export const CALENDAR_KINDS = ['campaign', 'advertiser_campaign'];
export const CALENDAR_STATUS = ['scheduled', 'live', 'completed', 'cancelled', 'expired'];
export const WAITLIST_STATUS = ['waiting', 'offered', 'reserved', 'registered', 'expired', 'withdrawn'];
export const WAITLIST_OFFER_HOURS = 2;

function requireDate(value, field, { future = false } = {}) {
  if (!value || !Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
  if (future && Date.parse(value) <= Date.now()) throw new Error(`${field} must be in the future`);
  return new Date(value).toISOString();
}

function ownerForSource(kind, sourceId) {
  if (kind === 'campaign') {
    const row = store.find('campaigns', (campaign) => campaign.id === sourceId);
    return row ? row.ownerId : null;
  }
  const row = store.find('advertiserCampaigns', (campaign) => campaign.id === sourceId);
  return row ? row.advertiserId : null;
}

function actorPersonId(actorId) {
  return personIdForUser(actorId);
}

export function createEntry(actorId, input = {}) {
  const kind = input.kind ?? 'campaign';
  if (!CALENDAR_KINDS.includes(kind)) throw new Error(`kind must be one of ${CALENDAR_KINDS.join(', ')}`);
  const sourceId = String(input.sourceId ?? '');
  if (!sourceId) throw new Error('sourceId is required');
  const owner = ownerForSource(kind, sourceId);
  if (!owner) throw new Error('calendar source not found');
  const actor = kind === 'advertiser_campaign' ? actorPersonId(actorId) : actorId;
  if (owner !== actor) throw new Error('only the owner may add a calendar entry');
  const startsAt = requireDate(input.startsAt, 'startsAt');
  const endsAt = input.endsAt ? requireDate(input.endsAt, 'endsAt') : null;
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('endsAt must be after startsAt');
  const existing = store.find('calendarEntries', (entry) => entry.kind === kind && entry.sourceId === sourceId);
  if (existing) return existing;
  const now = new Date().toISOString();
  return store.insert('calendarEntries', {
    id: newId('cal'),
    kind,
    sourceId,
    title: String(input.title ?? '').trim() || null,
    startsAt,
    endsAt,
    status: input.status && CALENDAR_STATUS.includes(input.status) ? input.status : 'scheduled',
    createdBy: actor,
    createdAt: now,
    updatedAt: now
  });
}

export function listEntries({ actorId = null, kind = null, status = null } = {}) {
  let rows = store.all('calendarEntries');
  if (actorId) {
    const userPerson = actorPersonId(actorId);
    rows = rows.filter((entry) => ownerForSource(entry.kind, entry.sourceId) === (entry.kind === 'advertiser_campaign' ? userPerson : actorId));
  }
  if (kind) rows = rows.filter((entry) => entry.kind === kind);
  if (status) rows = rows.filter((entry) => entry.status === status);
  return rows.slice().sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
}

function campaignOrNull(campaignId) {
  return store.find('campaigns', (campaign) => campaign.id === campaignId);
}

function occupiedCount(campaignId) {
  return store.filter('registrations', (registration) =>
    registration.campaignId === campaignId && ['started', 'registered', 'confirmed', 'checked_in'].includes(registration.status)
  ).length;
}

function waitlistView(row) {
  if (!row) return null;
  const campaign = campaignOrNull(row.campaignId);
  return {
    ...row,
    campaignTitle: campaign?.title ?? null,
    campaignSlug: campaign?.publicSlug ?? null
  };
}

export function joinWaitlist({ campaignId, attendeeRef, name = null, contact = null, userId = null } = {}) {
  const campaign = campaignOrNull(campaignId);
  if (!campaign || (campaign.status !== 'published' && campaign.status !== 'live')) throw new Error('campaign is not open');
  if (campaign.capacity === null) throw new Error('campaign has no waiting-list limit');
  if (occupiedCount(campaignId) < campaign.capacity) throw new Error('campaign still has space; register directly');
  if (!attendeeRef) throw new Error('attendeeRef is required');

  const existing = store.find('waitlistEntries', (row) =>
    row.campaignId === campaignId && row.attendeeRef === String(attendeeRef) && !['expired', 'withdrawn'].includes(row.status)
  );
  if (existing) return { entry: waitlistView(existing), reused: true };

  const position = store.filter('waitlistEntries', (row) => row.campaignId === campaignId).reduce((max, row) => Math.max(max, Number(row.position) || 0), 0) + 1;
  const now = new Date().toISOString();
  const row = store.insert('waitlistEntries', {
    id: newId('wait'),
    campaignId,
    attendeeRef: String(attendeeRef),
    userId: userId ?? null,
    personId: userId ? personIdForUser(userId) : null,
    name: name ? String(name).slice(0, 255) : null,
    contact: contact ? String(contact).slice(0, 255) : null,
    position,
    status: 'waiting',
    reservedAt: null,
    offerExpiresAt: null,
    registrationId: null,
    createdAt: now,
    updatedAt: now
  });
  emitSignal({ type: 'waitlist_joined', objectId: campaign.objectId ?? null, metadata: { waitlistEntryId: row.id, campaignId } });
  // If capacity changes between the request and this call, the offer is still
  // derived from the live count and is safe to run idempotently.
  return { entry: waitlistView(row), reused: false };
}

export function offerNext(campaignId) {
  const campaign = campaignOrNull(campaignId);
  if (!campaign || campaign.capacity === null) return null;
  if (occupiedCount(campaignId) >= campaign.capacity) return null;
  const open = store.find('waitlistEntries', (row) => row.campaignId === campaignId && ['offered', 'reserved'].includes(row.status) && (!row.offerExpiresAt || Date.parse(row.offerExpiresAt) > Date.now()));
  if (open) return waitlistView(open);
  const next = store.filter('waitlistEntries', (row) => row.campaignId === campaignId && row.status === 'waiting')
    .sort((a, b) => Number(a.position) - Number(b.position))[0];
  if (!next) return null;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + WAITLIST_OFFER_HOURS * 3600000).toISOString();
  const updated = store.update('waitlistEntries', next.id, { status: 'offered', reservedAt: now, offerExpiresAt: expires });
  emitSignal({ type: 'waitlist_offered', objectId: campaign.objectId ?? null, metadata: { waitlistEntryId: next.id, campaignId, offerExpiresAt: expires } });
  return waitlistView(updated);
}

export function acceptOffer(id, { attendeeRef = null, userId = null } = {}) {
  const row = store.find('waitlistEntries', (entry) => entry.id === id);
  if (!row) throw new Error('wait-list entry not found');
  if (row.status !== 'offered') throw new Error(`offer cannot be accepted while ${row.status}`);
  if (row.offerExpiresAt && Date.parse(row.offerExpiresAt) <= Date.now()) {
    expireEntry(id, 'offer_expired');
    throw new Error('wait-list offer has expired');
  }
  if (row.userId && row.userId !== userId) throw new Error('this offer belongs to another attendee');
  if (!row.userId && String(row.attendeeRef) !== String(attendeeRef ?? '')) throw new Error('attendeeRef does not match this offer');

  const campaign = campaignOrNull(row.campaignId);
  const registration = campaigns.register(campaign, {
    attendeeRef: row.attendeeRef,
    name: row.name,
    contact: row.contact,
    userId: row.userId ?? userId ?? null
  });
  const updated = store.update('waitlistEntries', id, {
    status: 'registered',
    registrationId: registration.id,
    offerExpiresAt: null
  });
  emitSignal({ type: 'waitlist_registered', objectId: campaign.objectId ?? null, metadata: { waitlistEntryId: id, campaignId: row.campaignId, registrationId: registration.id } });
  return { entry: waitlistView(updated), registration };
}

export function expireEntry(id, reason = 'offer_expired') {
  const row = store.find('waitlistEntries', (entry) => entry.id === id);
  if (!row || !['offered', 'reserved'].includes(row.status)) return null;
  const updated = store.update('waitlistEntries', id, { status: 'expired', expirationReason: reason });
  emitSignal({ type: 'waitlist_expired', objectId: campaignOrNull(row.campaignId)?.objectId ?? null, metadata: { waitlistEntryId: id, campaignId: row.campaignId, reason } });
  return waitlistView(updated);
}

export function listWaitlist(campaignId, { publicView = true } = {}) {
  const rows = store.filter('waitlistEntries', (row) => row.campaignId === campaignId)
    .slice().sort((a, b) => Number(a.position) - Number(b.position));
  return publicView
    ? rows.filter((row) => ['waiting', 'offered', 'reserved'].includes(row.status)).map((row) => ({ id: row.id, position: row.position, status: row.status, offerExpiresAt: row.offerExpiresAt }))
    : rows.map(waitlistView);
}

/** Called by a durable worker in production; unref'd interval in this adapter. */
export function sweep() {
  const now = Date.now();
  let expiredOffers = 0;
  for (const row of store.all('waitlistEntries')) {
    if (row.offerExpiresAt && Date.parse(row.offerExpiresAt) <= now && ['offered', 'reserved'].includes(row.status)) {
      if (expireEntry(row.id)) expiredOffers++;
    }
  }
  const campaignsWithWaitlists = new Set(store.all('waitlistEntries').map((row) => row.campaignId));
  let offered = 0;
  for (const campaignId of campaignsWithWaitlists) {
    if (offerNext(campaignId)) offered++;
  }
  const advertisingResult = advertising.sweep();
  return { expiredOffers, offered, ...advertisingResult };
}

export function installSweep({ intervalMs = 60 * 1000 } = {}) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
  const timer = setInterval(() => {
    try { sweep(); } catch { /* a scheduler failure must not crash Brief */ }
  }, intervalMs);
  timer.unref?.();
  return timer;
}
