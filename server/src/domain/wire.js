// ---------------------------------------------------------------------------
// WIRE — live headlines from freenewsapi.ai
//
// Tea is editorial (Brief writes it). The Wire is somebody else's news,
// fetched server-side, cached, and labelled as such. Two shelves only:
//
//   kenya  country=KE, last 24h
//   world  a fixed list of major English desks, last 24h
//
// "World" is NOT a popularity rank — the API has no such sort. It is the
// newest copy from Reuters / BBC / AP / Al Jazeera / Guardian / CNN.
// If the upstream is down, we return empty lists and a reason. Never filler.
// ---------------------------------------------------------------------------

const UPSTREAM = 'https://freenewsapi.ai/v1/search';
const CACHE_MS = 8 * 60 * 1000;
const FETCH_MS = 8000;

const WORLD_HOSTS = [
  'www.reuters.com',
  'www.bbc.com',
  'apnews.com',
  'www.aljazeera.com',
  'www.theguardian.com',
  'www.cnn.com'
];

let cache = { at: 0, payload: null };

function mapArticle(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (!title || !url) return null;
  return {
    id: typeof raw.id === 'string' ? raw.id : url,
    title,
    url,
    description: typeof raw.description === 'string' ? raw.description : '',
    publishedAt: typeof raw.published_at === 'string' ? raw.published_at : null,
    sitename: typeof raw.sitename === 'string' ? raw.sitename : (raw.host || ''),
    image: typeof raw.image === 'string' ? raw.image : null,
    country: typeof raw.country === 'string' ? raw.country : null
  };
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const a of list) {
    if (!a || seen.has(a.url)) continue;
    seen.add(a.url);
    out.push(a);
  }
  return out;
}

async function search(params) {
  const u = new URL(UPSTREAM);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    const res = await fetch(u, { signal: ac.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const body = await res.json();
    const rows = Array.isArray(body?.results) ? body.results : [];
    return rows.map(mapArticle).filter(Boolean);
  } finally {
    clearTimeout(t);
  }
}

export async function getWire() {
  const now = Date.now();
  if (cache.payload && now - cache.at < CACHE_MS) return cache.payload;

  const empty = {
    source: 'freenewsapi.ai',
    fetchedAt: new Date().toISOString(),
    kenya: [],
    world: [],
    note:
      'Headlines from freenewsapi.ai, last 24 hours. Kenya is country=KE. ' +
      'World is newest copy from Reuters, BBC, AP, Al Jazeera, Guardian and CNN — not a popularity rank.',
    error: null
  };

  try {
    const [kenyaRaw, worldRaw] = await Promise.all([
      search({ country: 'KE', lang: 'en', date: '24h', sort: 'date', size: 8 }),
      search({ host: WORLD_HOSTS.join(','), lang: 'en', date: '24h', sort: 'date', size: 8 })
    ]);
    const payload = {
      ...empty,
      fetchedAt: new Date().toISOString(),
      kenya: dedupe(kenyaRaw).slice(0, 8),
      world: dedupe(worldRaw).slice(0, 8)
    };
    cache = { at: now, payload };
    return payload;
  } catch (e) {
    const payload = {
      ...empty,
      error: e?.name === 'AbortError' ? 'news wire timed out' : String(e?.message ?? e)
    };
    // Do not cache failures for long — retry next request.
    cache = { at: now - CACHE_MS + 30_000, payload };
    return payload;
  }
}
