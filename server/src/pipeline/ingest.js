// ---------------------------------------------------------------------------
// RAW -> STRUCTURED PIPELINE
//
//   SOURCE -> RAW ITEM -> NORMALIZE -> EXTRACT -> DEDUPE -> OBJECT -> GRAPH
//
// Two invariants drive the whole file:
//
//  1. A message is never silently published. Everything lands as a raw item
//     first, and an object derived from a private source defaults to a
//     non-public publication state (spec 24).
//  2. The same event arriving from five places produces ONE canonical object
//     with five source attachments -- not five events (spec 8).
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { extractFields, extractVendors, extractProducts, isObjectWorthy } from './extract.js';

/** Character-bigram Dice coefficient: steady on short trader names. */
function similarity(a, b) {
  const norm = (v) => v.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const grams = (v) => {
    const m = new Map();
    for (let i = 0; i < v.length - 1; i++) {
      const g = v.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const gx = grams(x);
  const gy = grams(y);
  let shared = 0;
  for (const [g, n] of gx) shared += Math.min(n, gy.get(g) ?? 0);
  const total = [...gx.values()].reduce((s, n) => s + n, 0) +
                [...gy.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * shared) / total;
}

const DUPLICATE_THRESHOLD = 0.72;

/**
 * PHASE 2. Store the raw item exactly as received. This is the audit record:
 * even if extraction later proves wrong, the original text survives.
 * Returns the existing row when the (source, externalId) pair was already
 * seen, which is what makes redelivered webhooks harmless (spec 31).
 */
export function storeRawItem({
  sourceId, externalId, messageId, author, text, media,
  publishedAt, rawUrl
}) {
  const existing = store.find(
    'rawItems',
    (r) => r.sourceId === sourceId && r.externalId === String(externalId)
  );
  if (existing) return { row: existing, duplicate: true };

  const row = {
    id: newId('raw'),
    sourceId,
    externalId: String(externalId),
    messageId: messageId ? String(messageId) : null,
    author: author ?? null,
    text: text ?? '',
    media: media ?? [],
    publishedAt: publishedAt ?? null,
    retrievedAt: new Date().toISOString(),
    rawUrl: rawUrl ?? null,
    processingStatus: 'pending',
    createdAt: new Date().toISOString()
  };
  store.insert('rawItems', row);
  return { row, duplicate: false };
}

/**
 * Find an existing canonical object this raw item is probably about.
 * Title similarity plus a corroborating signal (same day, place or price) --
 * title alone is not enough to merge two records.
 */
function findCanonical(fields) {
  if (!fields.title) return null;
  let best = null;
  for (const obj of store.all('objects')) {
    const score = similarity(fields.title, obj.title);
    if (score < DUPLICATE_THRESHOLD) continue;
    const corroborates =
      (fields.locationName && obj.locationName &&
        similarity(fields.locationName, obj.locationName) > 0.6) ||
      (fields.dayOfWeek && obj.metadata?.dayOfWeek === fields.dayOfWeek) ||
      (fields.dateText && obj.metadata?.dateText === fields.dateText) ||
      (fields.price !== undefined && obj.metadata?.price === fields.price);
    if (!corroborates) continue;
    if (!best || score > best.score) best = { obj, score };
  }
  return best;
}

/** Attach provenance. Many sources may point at one object (spec 8). */
function attachSource(objectId, rawItem, source, confidence) {
  const already = store.find(
    'objectSources',
    (s) => s.objectId === objectId && s.rawItemId === rawItem.id
  );
  if (already) return already;
  return store.insert('objectSources', {
    id: newId('osrc'),
    objectId,
    sourceId: source.id,
    rawItemId: rawItem.id,
    sourceExternalId: rawItem.externalId,
    sourceMessageId: rawItem.messageId,
    sourcePublishedAt: rawItem.publishedAt,
    sourceAuthor: rawItem.author,
    sourceRetrievedAt: rawItem.retrievedAt,
    sourceUrl: rawItem.rawUrl,
    sourceConfidence: source.confidence ?? 0.5,
    extractionConfidence: confidence,
    createdAt: new Date().toISOString()
  });
}

/** Verification escalates only with genuine corroboration (spec 9). */
function verificationFor(objectId) {
  const distinct = new Set(
    store.filter('objectSources', (s) => s.objectId === objectId).map((s) => s.sourceId)
  );
  if (distinct.size >= 2) return 'cross_source_confirmed';
  if (distinct.size === 1) return 'source_confirmed';
  return 'unverified';
}

/**
 * Publication state (spec 24). A private/member source produces objects that
 * are NOT public by default. Only a genuinely public source may yield a
 * publicly discoverable object without a human choosing to publish it.
 */
function defaultPublication(source) {
  return source.accessType === 'public' ? 'public' : 'source_members';
}

function relate(sourceObjId, verb, targetObjId) {
  const existing = store.find(
    'relationships',
    (r) => r.sourceId === sourceObjId && r.verb === verb && r.targetId === targetObjId
  );
  if (existing) return existing;
  return store.insert('relationships', {
    id: newId('rel'),
    sourceId: sourceObjId,
    verb,
    targetId: targetObjId,
    createdAt: new Date().toISOString()
  });
}

/**
 * PHASE 3-5, 12. Process one raw item end to end.
 *
 * Never throws for ordinary "nothing useful here" outcomes -- a chatty message
 * is a normal result, recorded as rejected with a reason.
 */
export function processRawItem(rawItemId) {
  const raw = store.find('rawItems', (r) => r.id === rawItemId);
  if (!raw) return { ok: false, reason: 'raw item not found' };

  const source = store.find('sources', (s) => s.id === raw.sourceId);
  if (!source) return { ok: false, reason: 'source not found' };

  store.update('rawItems', raw.id, { processingStatus: 'processing' });

  const { fields, evidence, confidence } = extractFields(raw.text);

  if (!isObjectWorthy(fields)) {
    store.update('rawItems', raw.id, {
      processingStatus: 'rejected',
      rejectionReason: 'no object-worthy content (conversation or too sparse)'
    });
    return { ok: true, created: false, reason: 'not object worthy', fields, confidence };
  }

  const metadata = {};
  for (const k of ['price', 'currency', 'timeRange', 'dayOfWeek', 'dateText',
                   'vendorCount', 'contactPhone', 'contactName', 'deadline', 'categories']) {
    if (fields[k] !== undefined) metadata[k] = fields[k];
  }
  // Fields we could not establish are explicitly marked unknown rather than
  // being quietly omitted, so the UI can say "unknown" instead of implying.
  const unknown = ['dateText', 'timeRange', 'locationName', 'price']
    .filter((k) => fields[k] === undefined);
  if (unknown.length) metadata.unknownFields = unknown;

  const match = findCanonical(fields);
  let object;
  let merged = false;

  if (match) {
    // DEDUPE: enrich the canonical object with fields it was missing, but do
    // not overwrite anything already established.
    merged = true;
    object = match.obj;
    const patch = {};
    if (!object.locationName && fields.locationName) patch.locationName = fields.locationName;
    const meta = { ...object.metadata };
    for (const [k, v] of Object.entries(metadata)) {
      if (k === 'unknownFields') continue;
      if (meta[k] === undefined) meta[k] = v;
    }
    meta.unknownFields = ['dateText', 'timeRange', 'locationName', 'price']
      .filter((k) => meta[k] === undefined && !(k === 'locationName' && (patch.locationName || object.locationName)));
    patch.metadata = meta;
    store.update('objects', object.id, patch);
    object = store.find('objects', (o) => o.id === match.obj.id);
  } else {
    object = store.insert('objects', {
      id: newId('obj'),
      type: fields.type ?? 'knowledge',
      title: fields.title,
      category: fields.categories?.[0] ?? null,
      summary: raw.text.slice(0, 240),
      locationName: fields.locationName ?? null,
      metadata,
      isFixture: false,
      publication: defaultPublication(source),
      verificationStatus: 'unverified',
      extractionConfidence: confidence,
      extractionEvidence: evidence,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  attachSource(object.id, raw, source, confidence);
  store.update('objects', object.id, { verificationStatus: verificationFor(object.id) });

  // GRAPH (spec 19-22): vendors and products become real linked objects, but
  // only when the text names them explicitly.
  const createdChildren = [];
  if (fields.type === 'experience' || fields.vendorCount !== undefined) {
    for (const name of extractVendors(raw.text)) {
      let vendor = store.find(
        'objects',
        (o) => o.type === 'identity' && similarity(o.title, name) > 0.85
      );
      if (!vendor) {
        vendor = store.insert('objects', {
          id: newId('obj'),
          type: 'identity',
          title: name,
          category: 'Vendor',
          summary: `Named as a vendor in a ${source.type} post.`,
          locationName: fields.locationName ?? null,
          metadata: {},
          isFixture: false,
          publication: defaultPublication(source),
          verificationStatus: 'unverified',
          extractionConfidence: confidence,
          extractionEvidence: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        createdChildren.push(vendor.id);
      }
      attachSource(vendor.id, raw, source, confidence);
      relate(object.id, 'has_vendor', vendor.id);
      relate(vendor.id, 'appears_at', object.id);
    }
  }

  for (const p of extractProducts(raw.text)) {
    let product = store.find(
      'objects',
      (o) => o.type === 'product' && similarity(o.title, p.name) > 0.85
    );
    if (!product) {
      product = store.insert('objects', {
        id: newId('obj'),
        type: 'product',
        title: p.name,
        category: 'Product',
        summary: `Offered at ${p.currency} ${p.price}.`,
        locationName: fields.locationName ?? null,
        metadata: { price: p.price, currency: p.currency },
        isFixture: false,
        publication: defaultPublication(source),
        verificationStatus: 'unverified',
        extractionConfidence: confidence,
        extractionEvidence: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      createdChildren.push(product.id);
    }
    attachSource(product.id, raw, source, confidence);
    relate(object.id, 'offers', product.id);
  }

  store.update('rawItems', raw.id, { processingStatus: 'processed', objectId: object.id });

  return {
    ok: true,
    created: !merged,
    merged,
    objectId: object.id,
    childIds: createdChildren,
    confidence,
    fields,
    verificationStatus: verificationFor(object.id)
  };
}

/** Preview only -- extraction with nothing written. Powers "Brief It". */
export function previewText(text) {
  const { fields, evidence, confidence } = extractFields(text);
  return {
    worthy: isObjectWorthy(fields),
    fields,
    evidence,
    confidence,
    vendors: extractVendors(text),
    products: extractProducts(text)
  };
}
