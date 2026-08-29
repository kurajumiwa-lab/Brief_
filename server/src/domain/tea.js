// ---------------------------------------------------------------------------
// TEA — the editorial layer (home-feed master build, Phase 4)
//
// Tea is "what the city is talking about, what changed, what is useful". It is
// an editorial content model, NOT news, and NOT hardcoded frontend copy.
//
// Every field maps to the master-build spec §21. Articles are persisted rows;
// only `published` (and unexpired) articles are ever returned publicly. The
// status lifecycle is draft -> review -> approved -> published -> (expired |
// archived). A `scheduled` article publishes itself when its time arrives.
//
// Expiry is opportunistic (swept on read, like discovery): an article whose
// expiresAt has passed leaves the public feed without a cron daemon.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

export const CATEGORIES = ['live', 'guide', 'explainer', 'culture', 'useful', 'trend', 'weekend', 'local_business', 'opportunity', 'howto'];
export const STATUSES = ['draft', 'review', 'approved', 'published', 'scheduled', 'expired', 'archived'];

export function slugify(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `article-${Date.now().toString(36)}`;
}

/** Reading time derived from body word count (≈200 wpm), never a stored guess. */
function estimateReadingTime(body) {
  const words = String(body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Sweep: a published article whose expiry has passed becomes `expired`. A
 * scheduled article whose publishedAt has arrived becomes `published`. Runs
 * opportunistically on read, so no daemon is required.
 */
export function sweep() {
  const nowMs = Date.now();
  let changed = { expired: 0, published: 0 };
  for (const a of store.all('teaArticles')) {
    if (a.status === 'published' && a.expiresAt && Date.parse(a.expiresAt) <= nowMs) {
      store.update('teaArticles', a.id, { status: 'expired' });
      changed.expired++;
    }
    if (a.status === 'scheduled' && a.publishedAt && Date.parse(a.publishedAt) <= nowMs) {
      store.update('teaArticles', a.id, { status: 'published' });
      changed.published++;
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// STORY DESIGN — the editorial presentation system.
//
// An article carries a DESIGN: a THEME preset (typography + surface), a
// LAYOUT preset (how the hero and the text sit), plus FREEHAND overrides
// (accent colour, overlay strength over the hero photo). Presets make it
// fast; freehand makes it yours. Everything is validated here so the reader
// and the home shelf can render it without trusting client input.
// ---------------------------------------------------------------------------
export const THEMES = [
  { id: 'classic', label: 'Classic', blurb: 'Serif headline on clean paper.' },
  { id: 'noir',    label: 'Noir',    blurb: 'Ink-on-black night edition.' },
  { id: 'poster',  label: 'Poster',  blurb: 'Big display type, loud and simple.' },
  { id: 'gazette', label: 'Gazette', blurb: 'Warm paper, ruled and quiet.' }
];
export const LAYOUTS = [
  { id: 'center',    label: 'Centered',    blurb: 'Text centred under the hero.' },
  { id: 'left',      label: 'Left rail',   blurb: 'A strong left-aligned column.' },
  { id: 'full-bleed', label: 'Full-bleed', blurb: 'Hero fills the frame, type over it.' },
  { id: 'split',     label: 'Split',       blurb: 'Hero beside the text.' }
];
const THEME_IDS = THEMES.map((t) => t.id);
const LAYOUT_IDS = LAYOUTS.map((l) => l.id);

export const DEFAULT_DESIGN = { theme: 'classic', layout: 'center', accent: null, overlay: 0.55 };

/**
 * Sanitize a (possibly partial) design object. A partial patch merges over
 * the defaults; unknown presets and bad values are refused, never silently
 * coerced — the reader and the shelf render this verbatim.
 */
function validateDesign(design) {
  const merged = { ...DEFAULT_DESIGN, ...(design ?? {}) };
  if (!THEME_IDS.includes(merged.theme)) {
    throw new Error(`theme must be one of ${THEME_IDS.join(', ')}`);
  }
  if (!LAYOUT_IDS.includes(merged.layout)) {
    throw new Error(`layout must be one of ${LAYOUT_IDS.join(', ')}`);
  }
  if (merged.accent != null && !/^#[0-9a-fA-F]{6}$/.test(String(merged.accent))) {
    throw new Error('accent must be a #rrggbb hex colour or null');
  }
  const overlay = Number(merged.overlay);
  if (!Number.isFinite(overlay) || overlay < 0 || overlay > 0.9) {
    throw new Error('overlay must be between 0 and 0.9');
  }
  return { theme: merged.theme, layout: merged.layout, accent: merged.accent ?? null, overlay };
}

// ---------------------------------------------------------------------------
// LIKES — the public rating. One row per (article, actor); counts are derived
// by scanning the rows, exactly like votes and confirmations elsewhere. A
// like is a real recorded act, never a stored counter to drift.
// ---------------------------------------------------------------------------
export function likeCountFor(articleId) {
  return store.filter('articleLikes', (l) => l.articleId === articleId).length;
}

export function likeArticle(articleId, actorId) {
  const a = store.find('teaArticles', (x) => x.id === articleId);
  if (!a) throw new Error('article not found');
  if (!actorId) throw new Error('signing in is required to like a story');
  const existing = store.find('articleLikes', (l) => l.articleId === articleId && l.actorId === actorId);
  if (existing) return { liked: true, likeCount: likeCountFor(articleId) };
  store.insert('articleLikes', {
    id: newId('tlike'),
    articleId,
    actorId,
    at: new Date().toISOString()
  });
  return { liked: true, likeCount: likeCountFor(articleId) };
}

export function unlikeArticle(articleId, actorId) {
  const a = store.find('teaArticles', (x) => x.id === articleId);
  if (!a) throw new Error('article not found');
  const existing = store.find('articleLikes', (l) => l.articleId === articleId && l.actorId === actorId);
  if (existing) store.remove('articleLikes', existing.id);
  return { liked: false, likeCount: likeCountFor(articleId) };
}

export function hasLiked(articleId, actorId) {
  if (!actorId) return false;
  return Boolean(store.find('articleLikes', (l) => l.articleId === articleId && l.actorId === actorId));
}

export function createArticle({
  title, dek = '', body = '', category = 'guide', subCategory = null,
  location = null, heroImage = null, images = [], author = null,
  createdBy = null,
  source = null, sourceUrl = null, readingTime = null, status = 'draft',
  publishedAt = null, expiresAt = null, tags = [], entities = [],
  relatedContent = [], relatedPlaces = [], relatedEvents = [], design = null
}) {
  if (!title || !String(title).trim()) throw new Error('title is required');
  if (!CATEGORIES.includes(category)) throw new Error(`category must be one of ${CATEGORIES.join(', ')}`);
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  // The presentation design is validated, never trusted raw from the client.
  const validatedDesign = validateDesign(design);
  // A published article must carry a publication time; default to now.
  if (status === 'published' && !publishedAt) publishedAt = new Date().toISOString();

  const slugBase = slugify(title);
  let slug = slugBase;
  let n = 2;
  while (store.find('teaArticles', (a) => a.slug === slug)) slug = `${slugBase}-${n++}`;

  const article = store.insert('teaArticles', {
    id: newId('tea'),
    slug,
    title: String(title).trim(),
    dek: String(dek ?? ''),
    body: String(body ?? ''),
    category,
    subCategory,
    location,
    heroImage,
    images: Array.isArray(images) ? images : [],
    author,
    // Ownership fact (a user id), distinct from the byline (a name). Publish
    // authority derives from THIS, never from a client-supplied claim.
    createdBy,
    source,
    sourceUrl,
    readingTime: Number.isFinite(readingTime) && readingTime > 0 ? readingTime : estimateReadingTime(body),
    design: validatedDesign,
    status,
    publishedAt,
    updatedAt: new Date().toISOString(),
    expiresAt,
    createdAt: new Date().toISOString(),
    tags: Array.isArray(tags) ? tags : [],
    entities: Array.isArray(entities) ? entities : [],
    relatedContent: Array.isArray(relatedContent) ? relatedContent : [],
    relatedPlaces: Array.isArray(relatedPlaces) ? relatedPlaces : [],
    relatedEvents: Array.isArray(relatedEvents) ? relatedEvents : []
  });
  return article;
}

export function updateArticle(id, patch) {
  const a = store.find('teaArticles', (x) => x.id === id);
  if (!a) throw new Error('article not found');
  const allowed = ['title', 'dek', 'body', 'category', 'subCategory', 'location', 'heroImage', 'images', 'author', 'source', 'sourceUrl', 'readingTime', 'tags', 'entities', 'relatedContent', 'relatedPlaces', 'relatedEvents', 'publishedAt', 'expiresAt', 'design'];
  const next = {};
  for (const k of allowed) if (k in (patch ?? {})) next[k] = patch[k];
  if (next.category && !CATEGORIES.includes(next.category)) throw new Error('invalid category');
  // A design PATCH merges over the article's current design (patch semantics),
  // so changing only the theme keeps the editor's layout/accent/overlay.
  if (next.design !== undefined) {
    next.design = validateDesign({ ...(a.design ?? DEFAULT_DESIGN), ...next.design });
  }
  if (next.body !== undefined) next.readingTime = estimateReadingTime(next.body);
  return store.update('teaArticles', id, { ...next, updatedAt: new Date().toISOString() });
}

/** The status transitions an editor may drive. Each is a real, gated move. */
export function transition(id, action) {
  const a = store.find('teaArticles', (x) => x.id === id);
  if (!a) throw new Error('article not found');
  const map = {
    'submit': { from: ['draft'], to: 'review' },
    'approve': { from: ['review'], to: 'approved' },
    'publish': { from: ['approved', 'review', 'draft'], to: 'published' },
    'schedule': { from: ['approved', 'draft'], to: 'scheduled' },
    'unpublish': { from: ['published', 'scheduled'], to: 'draft' },
    'expire': { from: ['published', 'scheduled'], to: 'expired' },
    'archive': { from: ['published', 'scheduled', 'expired', 'approved'], to: 'archived' }
  };
  const m = map[action];
  if (!m) throw new Error(`unknown action: ${action}`);
  if (!m.from.includes(a.status)) throw new Error(`cannot ${action} from ${a.status}`);
  const patch = { status: m.to, updatedAt: new Date().toISOString() };
  if (action === 'publish' && !a.publishedAt) patch.publishedAt = new Date().toISOString();
  return store.update('teaArticles', id, patch);
}

/** The public projection — never the body's unpublished state or editor fields. */
function publicView(a) {
  return {
    id: a.id, slug: a.slug, title: a.title, dek: a.dek, category: a.category,
    subCategory: a.subCategory, location: a.location, heroImage: a.heroImage,
    images: a.images, author: a.author, source: a.source, sourceUrl: a.sourceUrl,
    readingTime: a.readingTime, publishedAt: a.publishedAt, expiresAt: a.expiresAt,
    createdAt: a.createdAt, tags: a.tags, entities: a.entities,
    relatedContent: a.relatedContent, relatedPlaces: a.relatedPlaces, relatedEvents: a.relatedEvents,
    design: a.design ?? DEFAULT_DESIGN,
    // Derived by scanning the like rows — there is no stored counter to drift.
    likeCount: likeCountFor(a.id),
    body: a.body
  };
}

/** Published + unexpired articles, optionally filtered and ranked. */
export function listPublished({ category = null, location = null, limit = 20, rank = true } = {}) {
  sweep();
  let rows = store.filter('teaArticles', (a) => a.status === 'published');
  if (category) rows = rows.filter((a) => a.category === category);
  if (location) rows = rows.filter((a) => !a.location || String(a.location).toLowerCase() === String(location).toLowerCase());
  if (rank) rows = rows.slice().sort((a, b) => rankArticle(b) - rankArticle(a));
  return rows.slice(0, limit).map(publicView);
}

/**
 * Editorial ranking — explainable, not opaque weights. Freshness dominates;
 * an explicit priority (an entity/relatedContent means editorial intent) lifts;
 * a near expiry demotes. There is no stored score and no engagement count to
 * invent — Tea is editorial, not popularity-ranked.
 */
function rankArticle(a) {
  let score = 0;
  const ageMs = Date.now() - Date.parse(a.publishedAt ?? a.createdAt);
  const ageHours = Math.max(0, ageMs / 3600000);
  score += 3 * Math.pow(0.5, ageHours / 24); // halves daily
  if (a.category === 'live') score += 2;     // time-sensitive lives first
  if (a.relatedContent?.length || a.relatedPlaces?.length || a.relatedEvents?.length) score += 1;
  if (a.expiresAt && Date.parse(a.expiresAt) - Date.now() < 24 * 3600000) score -= 1;
  return score;
}

export function getBySlug(slug, { viewerId = null } = {}) {
  sweep();
  const a = store.find('teaArticles', (x) => x.slug === slug);
  if (!a) return null;
  // Public slug only resolves a published (unexpired) article; the rest is 404.
  if (a.status !== 'published') return null;
  return { ...publicView(a), likedByMe: hasLiked(a.id, viewerId) };
}

/** A draft's full row, for the Tea Desk (editor only — the route gates it).
 * Sweeps first so the desk always reflects current status (a due scheduled
 * article reads as published; a lapsed article reads as expired). */
export function getById(id) {
  sweep();
  return store.find('teaArticles', (x) => x.id === id) ?? null;
}

export function listAll({ status = null } = {}) {
  let rows = store.all('teaArticles');
  if (status) rows = rows.filter((a) => a.status === status);
  return rows.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
