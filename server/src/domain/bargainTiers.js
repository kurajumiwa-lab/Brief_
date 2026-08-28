// ---------------------------------------------------------------------------
// BARGAIN TIERS (Tikiti T2)
//
// A group buy may price PER HEAD instead of pooling toward a target: the
// price each new joiner commits at falls as the participant count climbs
// through bands (1-4 normal, 5-9 discounted, 10+ max discount).
//
// Rules, all server-side:
//   * tiers are a strict ladder: ascending `min`, descending pricePerHead.
//     Anything else is refused at creation -- an unordered ladder is a price
//     nobody agreed to.
//   * the CURRENT tier is derived from the participant count, never sent.
//   * a join records the price at join time; if a better tier fills later,
//     everyone still owes only the FINAL tier price at settlement -- the view
//     states this instead of silently repricing history.
//   * expiry is a wall clock the server owns: after expiresAt, no joins.
//   * min/max participants are hard walls, and reaching a band is a signal
//     (Pulse material), not a silent repricing.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { emitSignal } from './signal.js';

const nowIso = () => new Date().toISOString();

export function validateTiers(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error('a priced bargain needs at least one tier');
  }
  let prevMin = 0;
  let prevPrice = Infinity;
  for (const t of tiers) {
    const min = Math.trunc(Number(t?.min));
    const price = Math.trunc(Number(t?.pricePerHead));
    if (!Number.isSafeInteger(min) || min < 1) throw new Error('each tier needs a minimum of at least 1 participant');
    if (!Number.isSafeInteger(price) || price <= 0) throw new Error('tier prices are whole shillings above zero');
    if (min <= prevMin) throw new Error('tier minimums must climb (each band starts above the last)');
    if (price >= prevPrice) throw new Error('tier prices must fall as participation grows');
    prevMin = min; prevPrice = price;
  }
  return tiers.map((t) => ({
    min: Math.trunc(Number(t.min)),
    max: t.max == null ? null : Math.trunc(Number(t.max)),
    pricePerHead: Math.trunc(Number(t.pricePerHead)),
    label: t.label ? String(t.label).slice(0, 40) : null
  }));
}

/** Attach pricing bands to a group buy. Called by createGroupBuy (T2 shape). */
export function priceGroupBuy(ownerId, groupBuyId, { tiers, minParticipants = null, maxParticipants = null, expiresAt = null }) {
  const buy = store.find('groupBuys', (b) => b.id === groupBuyId);
  if (!buy) throw new Error('group buy not found');
  if (buy.ownerId !== ownerId) throw new Error('only the owner may price this bargain');
  if (buy.pricing) throw new Error('this bargain is already priced');
  const ladder = validateTiers(tiers);
  const minP = minParticipants == null ? ladder[0].min : Math.trunc(Number(minParticipants));
  const maxP = maxParticipants == null ? null : Math.trunc(Number(maxParticipants));
  if (!Number.isSafeInteger(minP) || minP < 1) throw new Error('minParticipants must be at least 1');
  if (maxP != null && (!Number.isSafeInteger(maxP) || maxP < minP)) throw new Error('maxParticipants must be at or above the minimum');
  if (expiresAt != null && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
    throw new Error('expiry must be in the future');
  }
  return store.update('groupBuys', groupBuyId, {
    pricing: { tiers: ladder, minParticipants: minP, maxParticipants: maxP, expiresAt: expiresAt ?? null }
  });
}

export function participantCount(groupBuyId) {
  return store.filter('groupBuyParticipants', (p) => p.groupBuyId === groupBuyId && p.status !== 'cancelled').length;
}

/** The tier a count currently sits in (the LAST band whose min it meets). */
export function tierFor(pricing, count) {
  if (!pricing) return null;
  let current = null;
  for (const t of pricing.tiers) if (count >= t.min) current = t;
  return current ?? { ...pricing.tiers[0], notYetReached: true };
}

export function nextTier(pricing, count) {
  if (!pricing) return null;
  return pricing.tiers.find((t) => t.min > count) ?? null;
}

export function isExpired(buy) {
  return Boolean(buy?.pricing?.expiresAt) && Date.parse(buy.pricing.expiresAt) <= Date.now();
}

/**
 * Join a priced bargain. The price is derived HERE from the live count; a
 * client-sent price is never read. Money is not collected: the participant
 * row records the commitment at the current tier, and settlement (like every
 * economic fact) is a ledger matter with the organiser.
 */
export function joinBargain(userId, groupBuyId) {
  const buy = store.find('groupBuys', (b) => b.id === groupBuyId);
  if (!buy || buy.status === 'closed') throw new Error('group buy not found');
  if (!buy.pricing) throw new Error('this bargain is pooled, not priced per head; contribute instead');
  if (isExpired(buy)) {
    store.update('groupBuys', buy.id, { status: 'expired', updatedAt: nowIso() });
    throw new Error('this bargain has expired');
  }
  const existing = store.find('groupBuyParticipants',
    (p) => p.groupBuyId === groupBuyId && p.userId === userId && p.status !== 'cancelled');
  if (existing) return { participant: existing, changed: false };

  const count = participantCount(groupBuyId);
  const { maxParticipants } = buy.pricing;
  if (maxParticipants != null && count >= maxParticipants) {
    const err = new Error('this bargain is full');
    err.code = 'bargain_full';
    throw err;
  }

  const tier = tierFor(buy.pricing, count + 1);
  const participant = store.insert('groupBuyParticipants', {
    id: newId('gbp'),
    groupBuyId,
    userId,
    priceAtJoin: tier.pricePerHead,
    tierLabelAtJoin: tier.label ?? `tier of ${tier.min}+`,
    status: 'joined',
    joinedAt: nowIso()
  });

  // Reaching a band is an event the room hears about -- and the price the
  // NEXT joiner pays just changed, which is the whole product.
  const newCount = count + 1;
  const nowTier = tierFor(buy.pricing, newCount);
  if (nowTier && newCount === nowTier.min) {
    emitSignal({
      type: 'bargain_tier_reached',
      actorId: userId,
      value: nowTier.pricePerHead,
      metadata: { groupBuyId, tierMin: nowTier.min, pricePerHead: nowTier.pricePerHead, participants: newCount }
    });
  }
  if (buy.pricing.minParticipants != null && newCount === buy.pricing.minParticipants) {
    emitSignal({
      type: 'bargain_tier_reached',
      actorId: userId,
      value: nowTier?.pricePerHead ?? 0,
      metadata: { groupBuyId, minimumMet: true, participants: newCount }
    });
  }
  return { participant, changed: true };
}

/** A participant may leave before the bargain executes; their spot opens. */
export function leaveBargain(userId, groupBuyId) {
  const p = store.find('groupBuyParticipants',
    (x) => x.groupBuyId === groupBuyId && x.userId === userId && x.status !== 'cancelled');
  if (!p) throw new Error('you are not in this bargain');
  const updated = store.update('groupBuyParticipants', p.id, { status: 'cancelled', leftAt: nowIso() });
  return { participant: updated, changed: true };
}

/** The honest price view: what a joiner pays NOW and what the room is waiting for. */
export function bargainView(buy) {
  if (!buy?.pricing) return null;
  const count = participantCount(buy.id);
  const current = tierFor(buy.pricing, count);
  const upcoming = nextTier(buy.pricing, count);
  const finalTier = buy.pricing.tiers[buy.pricing.tiers.length - 1];
  return {
    participants: count,
    requiredParticipants: buy.pricing.minParticipants,
    maxParticipants: buy.pricing.maxParticipants,
    spotsLeft: buy.pricing.maxParticipants == null ? null : Math.max(0, buy.pricing.maxParticipants - count),
    currentPricePerHead: current?.pricePerHead ?? null,
    currentTierLabel: current?.label ?? (current ? `${current.min}+ people` : null),
    nextTier: upcoming ? { at: upcoming.min, pricePerHead: upcoming.pricePerHead, needs: upcoming.min - count } : null,
    // Everyone settles at the FINAL tier price if the room fills; the view
    // says so rather than repricing people's commitments silently.
    settlesAt: finalTier.pricePerHead,
    expiresAt: buy.pricing.expiresAt,
    expired: isExpired(buy),
    minimumMet: count >= buy.pricing.minParticipants
  };
}
