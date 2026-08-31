// ---------------------------------------------------------------------------
// SOURCE-LEVEL TRUST
//
// The source registry is the provenance root: every object carries which
// source(s) it came from. An administrator may mark a source as
// trusted | normal | degraded | disabled. This is an OPERATOR decision about
// a source's standing — it is never a public rating and never a claim that
// "this source is always true". It influences internal processing/ranking
// only where justified:
//
//   * disabled  — the source's content stops appearing in the default
//                 discovery feed (it stays reachable by direct link/detail;
//                 nothing is deleted — trust never destroys history).
//   * degraded  — a rank penalty on the feed (less prominent, not hidden).
//   * trusted   — no rank boost: a trusted label must not be sold as proof.
//   * normal    — the default, no effect.
// ---------------------------------------------------------------------------

import { store } from '../store.js';

export const SOURCE_TRUST_STATUSES = ['trusted', 'normal', 'degraded', 'disabled'];

function now() {
  return new Date().toISOString();
}

/** Set (or clear) an operator's trust decision on a source. Audited at the route. */
export function setSourceTrust(sourceId, operatorId, status, reason = null) {
  if (!operatorId) throw new Error('an operator is required');
  if (!SOURCE_TRUST_STATUSES.includes(status)) {
    throw new Error(`status must be one of ${SOURCE_TRUST_STATUSES.join(', ')}`);
  }
  const source = store.find('sources', (s) => s.id === sourceId);
  if (!source) throw new Error('source not found');

  return store.update('sources', sourceId, {
    trustStatus: status,
    trustUpdatedBy: operatorId,
    trustUpdatedAt: now(),
    trustReason: reason ? String(reason).slice(0, 300) : null
  });
}

/** The trust standing of one source row (default: normal). */
export function trustOf(source) {
  if (!source) return 'normal';
  return SOURCE_TRUST_STATUSES.includes(source.trustStatus) ? source.trustStatus : 'normal';
}

/**
 * The trust standing of an OBJECT, derived from its provenance sources.
 * Returns { disabled, degraded } — true only when the provenance actually
 * says so. An object with no attached sources is 'normal' (absence of
 * evidence is not a demotion).
 */
export function trustOfObject(object) {
  if (!object?.id) return { disabled: false, degraded: false };
  const rows = store.filter('objectSources', (s) => s.objectId === object.id);
  if (rows.length === 0) return { disabled: false, degraded: false };

  const statuses = rows
    .map((s) => store.find('sources', (x) => x.id === s.sourceId))
    .filter(Boolean)
    .map(trustOf);

  // Every provenance source disabled → content stops flowing in discovery.
  const disabled = statuses.length > 0 && statuses.every((st) => st === 'disabled');
  // Any degraded source in the provenance → prominence penalty.
  const degraded = statuses.some((st) => st === 'degraded');
  return { disabled, degraded };
}

/** Operator-facing list: every source with its trust standing and size. */
export function sourceTrustList() {
  return store.all('sources')
    .map((s) => {
      const objectIds = new Set(
        store.filter('objectSources', (o) => o.sourceId === s.id).map((o) => o.objectId)
      );
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        platform: s.platform,
        trustStatus: trustOf(s),
        trustUpdatedBy: s.trustUpdatedBy ?? null,
        trustUpdatedAt: s.trustUpdatedAt ?? null,
        trustReason: s.trustReason ?? null,
        objectsCreated: objectIds.size,
        enabled: s.enabled ?? false,
        seedBatch: s.seedBatch ?? null
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
