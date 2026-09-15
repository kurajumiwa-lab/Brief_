// ---------------------------------------------------------------------------
// VIEW MEMORY — a record of what THIS device actually opened.
//
// The brief asked for cards that "remember you" instead of a screen that
// forgets. That is only honest if the memory is a real event, so it is stored
// as one: a timestamp written when the visitor really opened the event on this
// device. Nothing is inferred, nothing is fetched from a server-side counter,
// and nothing is claimed about what other people did.
//
// Deliberately local: Brief records `campaign_viewed` signals server-side with
// a coarse fingerprint that is NOT an identity, so the server cannot honestly
// answer "what did YOU look at". This module answers the weaker question it can
// answer truthfully — "this device opened this" — and says exactly that.
// ---------------------------------------------------------------------------

const OPEN_KEY = 'brief.eventOpens.v1';
const SEEN_KEY = 'brief.eventSeen.v1';

type Opens = Record<string, string>;
type Seen = { at: string; slugs: string[] };

const store = (): Storage | null => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};

function readJson<T>(key: string, fallback: T): T {
  const ls = store();
  if (!ls) return fallback;
  try {
    const raw = ls.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  const ls = store();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(value));
  } catch {
    // A full or blocked store must never break the screen it was decorating.
  }
}

/** Called when the visitor actually opens an event on this device. */
export function noteOpened(slug: string): void {
  if (!slug) return;
  const opens = readJson<Opens>(OPEN_KEY, {});
  opens[slug] = new Date().toISOString();
  writeJson(OPEN_KEY, opens);
}

export function openedAt(slug: string): string | null {
  return readJson<Opens>(OPEN_KEY, {})[slug] ?? null;
}

/** Whole days since a real local timestamp; null when there is nothing to say. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
}

/** The slugs this device had already seen the last time the case was open. */
export function lastSeenSlugs(): string[] {
  return readJson<Seen | null>(SEEN_KEY, null)?.slugs ?? [];
}

export function rememberSeenSlugs(slugs: string[]): void {
  writeJson(SEEN_KEY, { at: new Date().toISOString(), slugs });
}
