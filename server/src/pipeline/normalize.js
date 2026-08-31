// ---------------------------------------------------------------------------
// WEB + RSS NORMALIZATION — one path from a fetched item to the raw payload.
//
// Every Web/RSS item, however it was fetched (manual route or the recurring
// poller), is normalised here into the exact shape `storeRawItem` expects, so
// it enters the SAME downstream pipeline as Telegram:
//
//   fetch (web.js) -> normalize -> storeRawItem -> processRawItem -> object
//
// Two rules govern the payload:
//
//   1. The free TEXT is what the classifier/extractors see (title + summary +
//      body), so a message reads the same whether it came from a feed or was
//      pasted in.
//   2. Facts the connector read from RELIABLE metadata (JSON-LD, OpenGraph,
//      feed fields) that the text parser might miss are carried in `structured`
//      and merged in as FILL-INS only — they never overwrite a text-derived
//      value, and they are always tagged in the extraction evidence.
//
// Provenance is preserved throughout: source, canonical/article URL, item
// GUID, and ingestion timestamp all travel on the raw item and its object
// provenance row.
// ---------------------------------------------------------------------------

import { extractFields } from './extract.js';

/**
 * Build the raw payload for one RSS/Atom item.
 * externalId is the GUID (or link) — the idempotency key per source.
 */
export function normalizeRssItem({ source, item, feedTitle = null }) {
  const title = item.title || item.link || 'Untitled';
  const text = [item.title, item.description].filter(Boolean).join('\n');
  const media = [];
  if (item.enclosure) {
    media.push({
      kind: 'image',
      reference: item.enclosure,
      caption: item.title || null
    });
  }

  const structured = {};
  if (item.author) structured.author = item.author;
  if (Array.isArray(item.categories) && item.categories.length) structured.categories = item.categories;

  return {
    sourceId: source.id,
    externalId: item.guid || item.link || item.title,
    messageId: null,
    author: item.author || feedTitle || null,
    text: text || title,
    media,
    publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
    rawUrl: item.link ?? null,
    canonicalUrl: item.canonicalUrl ?? item.link ?? null,
    categories: item.categories ?? [],
    structured
  };
}

/**
 * Build the raw payload for one web page. externalId is the canonical URL —
 * the idempotency key per source (re-fetching the same page yields no dup).
 */
export function normalizeWebPage({ source, page, url = null }) {
  const ex = page.extracted ?? {};
  const finalUrl = url || page.finalUrl || ex.canonicalUrl;
  const text = [ex.title, ex.description, page.text].filter(Boolean).join('\n');

  const media = [];
  if (ex.image) media.push({ kind: 'image', reference: ex.image, caption: ex.title || null });

  // Structured facts from JSON-LD / OpenGraph, merged in as fill-ins only.
  const structured = {};
  if (ex.ldType) {
    // A JSON-LD type the classifier can trust: Event -> experience, etc.
    if (/Event/i.test(ex.ldType)) structured.type = 'experience';
    else if (/Product|Offer/i.test(ex.ldType)) structured.type = 'product';
    else if (/Place|LocalBusiness/i.test(ex.ldType)) structured.type = 'place';
    else if (/Article|NewsArticle|Report/i.test(ex.ldType)) structured.type = 'news';
  }
  if (ex.startDate) {
    structured.startDate = ex.startDate;
    structured.dateCanonical = isoDateOf(ex.startDate);
  }
  if (ex.endDate) structured.endDate = ex.endDate;
  if (ex.locationName) structured.locationName = ex.locationName;
  if (ex.venue) structured.venue = ex.venue;
  if (ex.organizer) structured.organizer = ex.organizer;
  if (ex.price != null && Number.isFinite(Number(ex.price))) structured.price = Number(ex.price);
  if (ex.currency) structured.currency = ex.currency;
  if (ex.publisher) structured.publisher = ex.publisher;
  if (Array.isArray(ex.categories) && ex.categories.length) structured.categories = ex.categories;

  return {
    sourceId: source.id,
    externalId: ex.canonicalUrl || finalUrl,
    messageId: null,
    author: ex.author || ex.siteName || null,
    text,
    media,
    publishedAt: ex.publishedAt ? new Date(ex.publishedAt).toISOString() : null,
    rawUrl: finalUrl ?? null,
    canonicalUrl: ex.canonicalUrl || finalUrl,
    categories: ex.categories ?? [],
    structured
  };
}

/** A canonical ISO date from a JSON-LD ISO timestamp, or null. */
function isoDateOf(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Preview-only helper: what would extractFields say about a normalized item's
 * text, before anything is written. Used to decide worthiness in tests and to
 * keep the manual "Brief It" behaviour identical to the pipeline.
 */
export function previewNormalized(text) {
  return extractFields(text);
}
