// ---------------------------------------------------------------------------
// CORRECTIONS — a lightweight, audited fix for bad extracted information.
//
// An administrator corrects a field on an object (title, type, location,
// venue, date, time, organizer, ...). The correction NEVER destroys the
// original source evidence:
//
//   * the object row keeps its provenance (objectSources) untouched;
//   * the original value is preserved verbatim in the correction row, next to
//     the corrected value, with who did it, when, and why;
//   * the correction is a log entry — history is the record, so a mistaken
//     fix can be answered by a further correction back, not by silent edits.
//
// Applied corrections are attached to the authenticated detail response so
// the client can show "Corrected — was X, now Y" honestly, without ever
// rewriting provenance.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { CONTENT_TYPES } from './discovery.js';

/** Top-level object fields an operator may correct. */
export const CORRECTABLE_FIELDS = [
  'title',
  'type',
  'summary',
  'category',
  'locationName'
];

/** Metadata fields an operator may correct (venue/date/time/organizer...). */
export const CORRECTABLE_META = [
  'venue',
  'organizer',
  'dateCanonical',
  'eventStart',
  'eventEnd',
  'deadlineCanonical',
  'operatingHours',
  'price',
  'statusBadge'
];

const CORRECTION_STATUSES = ['applied', 'rejected'];

function now() {
  return new Date().toISOString();
}

function currentValue(object, field, isMeta) {
  if (isMeta) {
    const value = object?.metadata?.[field];
    return value === undefined || value === null ? null : String(value);
  }
  const value = object?.[field];
  return value === undefined || value === null ? null : String(value);
}

/**
 * Apply a correction. `field` names either a top-level field or a metadata
 * key; `isMeta` disambiguates when both could exist. Validation rejects
 * unknown fields and empty values — a correction must always say what it
 * changed and to what. `reason` is required so the log reads as a decision,
 * not a keystroke.
 */
export function correctObject({ objectId, field, value, operatorId, reason, isMeta = false }) {
  if (!objectId) throw new Error('objectId is required');
  if (!operatorId) throw new Error('an operator is required');
  if (!field) throw new Error('field is required');
  const object = store.find('objects', (o) => o.id === objectId);
  if (!object) throw new Error('object not found');
  if (object.publication === 'discarded') throw new Error('cannot correct a discarded object');

  const allowed = isMeta ? CORRECTABLE_META : CORRECTABLE_FIELDS;
  if (!allowed.includes(field)) {
    throw new Error(`field must be one of ${allowed.join(', ')}`);
  }
  const correctedValue = value === undefined || value === null ? null : String(value).trim();
  if (!correctedValue) throw new Error('a non-empty corrected value is required');
  if (field === 'type' && !CONTENT_TYPES.has(correctedValue)) {
    throw new Error(`type must be one of: ${[...CONTENT_TYPES].join(', ')}`);
  }
  const reasonText = reason ? String(reason).slice(0, 300) : 'correction';
  const originalValue = currentValue(object, field, isMeta);

  // Apply to the live object. The original lives on in the correction row.
  if (isMeta) {
    const meta = { ...(object.metadata ?? {}) };
    meta[field] = correctedValue;
    store.update('objects', objectId, { metadata: meta, updatedAt: now() });
  } else {
    store.update('objects', objectId, { [field]: correctedValue, updatedAt: now() });
  }

  const correction = store.insert('corrections', {
    id: newId('corr'),
    objectId,
    field,
    isMeta,
    originalValue,
    correctedValue,
    reason: reasonText,
    status: 'applied',
    createdBy: operatorId,
    createdAt: now(),
    decidedBy: null,
    decidedAt: null,
    decisionReason: null
  });

  return { correction, changed: originalValue !== correctedValue };
}

/** The correction log for one object (or everything, newest first). */
export function listCorrections({ objectId = null, status = null } = {}) {
  const rows = store.filter('corrections', (c) =>
    (!objectId || c.objectId === objectId) &&
    (!status || c.status === status)
  ).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return rows;
}

/** Applied corrections for an object — what the detail view may display. */
export function appliedCorrections(objectId) {
  return listCorrections({ objectId, status: 'applied' });
}

/**
 * Reject a correction (e.g. an accidental or wrong fix). Rejection marks the
 * row; it does NOT auto-rollback the object, because silently rewriting the
 * value would be the same sin the correction exists to fix — the operator
 * corrects back explicitly, and both steps stay on the log.
 */
export function rejectCorrection(correctionId, operatorId, reason) {
  if (!operatorId) throw new Error('an operator is required');
  const correction = store.find('corrections', (c) => c.id === correctionId);
  if (!correction) throw new Error('correction not found');
  if (!CORRECTION_STATUSES.includes(correction.status)) {
    throw new Error(`correction status must be one of ${CORRECTION_STATUSES.join(', ')}`);
  }
  if (correction.status === 'rejected') return { correction, reused: true };
  return {
    correction: store.update('corrections', correctionId, {
      status: 'rejected',
      decidedBy: operatorId,
      decidedAt: now(),
      decisionReason: reason ? String(reason).slice(0, 300) : 'rejected'
    }),
    reused: false
  };
}
