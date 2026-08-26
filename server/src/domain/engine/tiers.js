// ---------------------------------------------------------------------------
// ENGINE — TIER GUARDRAILS (the "Inline Tier Controller" layer)
//
// Access tiers are enforced SERVER-SIDE at the point of use, not painted on
// in the client: the sync heartbeat cannot run faster than the tier allows,
// routing routes cannot exceed the tier cap. The client guardrail UI is a
// projection of these caps — it can blur a locked capability, but it cannot
// grant one.
//
// MICRO-BILLING, HONESTLY: no payment rail is connected in this codebase (see
// the compliance-gated economy elsewhere), so requestUpgrade() REFUSES with a
// machine-readable reason instead of pretending to take money. Operator grants
// (engineTierGrants) are the real promotion path today, and the refusal says
// exactly that. The moment billing is wired, this is the single seam to change.
// ---------------------------------------------------------------------------

import { store, newId } from '../../store.js';

export const TIER_IDS = ['free', 'pro', 'operator'];

export const TIERS = {
  free: {
    id: 'free',
    label: 'Free',
    syncIntervalMs: 30_000,
    maxRoutes: 1,
    pipelineDepth: 'core',
    micro: 'Background sync every 30s · core pipeline · 1 routing route'
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    syncIntervalMs: 10_000,
    maxRoutes: 5,
    pipelineDepth: 'full',
    micro: 'Sync every 10s · full stage telemetry · 5 routing routes'
  },
  operator: {
    id: 'operator',
    label: 'Operator',
    syncIntervalMs: 3_000,
    maxRoutes: null, // unlimited
    pipelineDepth: 'telemetry',
    micro: 'Sync every 3s · raw stage telemetry · unlimited routes'
  }
};

export function tierConfig(tierId) {
  return TIERS[TIER_IDS.includes(tierId) ? tierId : 'free'];
}

/** The effective tier for a user: an operator grant, else free. */
export function tierForUser(userId) {
  if (!userId) return 'free';
  const grant = store.find('engineTierGrants', (g) => g.userId === userId && g.status === 'active');
  return grant ? grant.tier : 'free';
}

export function grantTier(userId, tier, { grantedBy = 'operator' } = {}) {
  if (!TIER_IDS.includes(tier)) throw new Error(`unknown tier: ${tier}`);
  if (!userId) throw new Error('userId is required');
  const existing = store.find('engineTierGrants', (g) => g.userId === userId && g.status === 'active');
  const now = new Date().toISOString();
  if (existing) {
    return store.update('engineTierGrants', existing.id, { tier, grantedBy, updatedAt: now });
  }
  return store.insert('engineTierGrants', {
    id: newId('etg'),
    userId,
    tier,
    grantedBy,
    status: 'active',
    createdAt: now,
    updatedAt: now
  });
}

export function revokeTier(userId) {
  const existing = store.find('engineTierGrants', (g) => g.userId === userId && g.status === 'active');
  if (!existing) return false;
  store.update('engineTierGrants', existing.id, {
    status: 'revoked',
    updatedAt: new Date().toISOString()
  });
  return true;
}

/**
 * The honest micro-billing seam. Until a payment provider is connected this
 * REFUSES — machine-readable, with exactly what unlocks and what is missing,
 * so the client's inline tier controller can render the truth.
 */
export function requestUpgrade(userId, tier) {
  if (!TIER_IDS.includes(tier)) throw new Error(`unknown tier: ${tier}`);
  if (!userId) return { ok: false, reason: 'authentication required' };
  const current = tierForUser(userId);
  if (current === tier) return { ok: false, reason: 'already_on_tier', tier: current };
  return {
    ok: false,
    reason: 'billing_not_configured',
    tier: current,
    requested: tier,
    unlocks: TIERS[tier].micro,
    detail:
      'No billing rail is connected yet, so Brief will not pretend to take your money. ' +
      'An operator can grant this tier today; paid self-serve upgrade arrives with billing.'
  };
}

/** The full guardrail picture a route or the client needs. */
export function guardrailFor(userId) {
  const tier = tierForUser(userId);
  const cfg = TIERS[tier];
  const next = tier === 'free' ? 'pro' : tier === 'pro' ? 'operator' : null;
  return {
    tier,
    label: cfg.label,
    caps: {
      syncIntervalMs: cfg.syncIntervalMs,
      maxRoutes: cfg.maxRoutes,
      pipelineDepth: cfg.pipelineDepth
    },
    micro: cfg.micro,
    next: next ? { tier: next, label: TIERS[next].label, micro: TIERS[next].micro } : null,
    billingConfigured: false
  };
}
