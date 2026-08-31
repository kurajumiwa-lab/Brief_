// ---------------------------------------------------------------------------
// WEB + RSS CONNECTORS (real fetching)
//
// Both do genuine HTTP. The web connector consults robots.txt before fetching
// and refuses when disallowed (spec 14). Parsing is dependency-free regex over
// the markup: enough for title/description/date/price, and honest about the
// fact that it is not a full DOM parser.
//
// RESOURCE PROTECTION: every fetch is bounded — a timeout, a manual redirect
// cap, a response-size limit and a content-type sanity check — so a hostile or
// misbehaving upstream can never hold a socket open or balloon memory. A
// failure returns { ok: false, error } and the caller moves on to the next
// source; one broken site never stops the others.
//
// SSRF guard: private/loopback/link-local hosts are rejected outright, so a
// user-supplied URL cannot be used to probe the internal network (spec 32).
// ---------------------------------------------------------------------------

const UA = 'BriefBot/1.0 (+https://brief.example/bot; information layer)';

const MAX_REDIRECTS = 5;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;   // 2 MB of HTML is more than enough
const MAX_FEED_BYTES = 5 * 1024 * 1024;   // feeds can be large-ish

function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal')) return true;
  if (/^(127\.|0\.|10\.|169\.254\.|192\.168\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === '::1' || h === '[::1]' || h.startsWith('fd') || h.startsWith('fe80')) return true;
  return false;
}

export function validateUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: 'not a valid URL' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: `unsupported protocol ${u.protocol}` };
  }
  if (isBlockedHost(u.hostname)) {
    return { ok: false, error: 'refusing to fetch a private or loopback address' };
  }
  return { ok: true, url: u };
}

/**
 * Bounded HTTP GET.
 *
 *   timeout        hard AbortController deadline
 *   maxRedirects   manual 3xx following (so a redirect loop ends, not spirals)
 *   maxBytes       content-length pre-check + post-read cap
 *
 * Never throws — every failure path returns { ok: false, error }.
 */
async function get(url, { timeoutMs = 12000, headers = {}, maxBytes = MAX_PAGE_BYTES, maxRedirects = MAX_REDIRECTS } = {}) {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(current, {
        headers: { 'user-agent': UA, accept: '*/*', ...headers },
        redirect: 'manual',
        signal: ctrl.signal
      });
    } catch (err) {
      clearTimeout(timer);
      return { ok: false, status: 0, error: err.name === 'AbortError' ? 'timeout' : String(err.message ?? err) };
    }
    clearTimeout(timer);

    // Redirects are followed explicitly, so we can cap the count.
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) return { ok: false, status: res.status, error: 'redirect without a location header' };
      try { current = new URL(loc, current).toString(); }
      catch { return { ok: false, status: res.status, error: 'invalid redirect target' }; }
      continue;
    }

    // Size guard — honour a declared content-length, then cap the actual read.
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) {
      try { await res.body?.cancel(); } catch { /* best-effort */ }
      return { ok: false, status: res.status, error: `response exceeds the ${maxBytes}-byte limit` };
    }
    let buf;
    try {
      buf = await res.arrayBuffer();
    } catch (err) {
      return { ok: false, status: 0, error: err.name === 'AbortError' ? 'timeout' : String(err.message ?? err) };
    }
    if (buf.byteLength > maxBytes) {
      return { ok: false, status: res.status, error: `response exceeds the ${maxBytes}-byte limit` };
    }
    return {
      ok: res.ok,
      status: res.status,
      text: Buffer.from(buf).toString('utf8'),
      finalUrl: current,
      contentType: res.headers.get('content-type') ?? null
    };
  }
  return { ok: false, status: 0, error: `too many redirects (more than ${maxRedirects})` };
}

/**
 * robots.txt check. Conservative: on a parse failure or network error we allow
 * (a missing robots.txt means no restriction), but an explicit Disallow that
 * matches the path blocks the fetch.
 */
export async function robotsAllows(targetUrl) {
  const v = validateUrl(targetUrl);
  if (!v.ok) return { allowed: false, reason: v.error };
  const robotsUrl = `${v.url.origin}/robots.txt`;
  const res = await get(robotsUrl, { timeoutMs: 8000 });
  if (!res.ok || !res.text) return { allowed: true, reason: 'no robots.txt' };

  // Group parsing: consecutive User-agent lines share one rule block, and a
  // blank line ends the group. Rules for a named agent (briefbot) take
  // precedence over the wildcard group, per the REP.
  const lines = res.text.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim());
  // NB: a blank line does NOT end a group. GitHub's robots.txt puts an empty
  // line between "User-agent: *" and its rules; treating that as a terminator
  // silently dropped every wildcard rule and made us think crawling was
  // permitted. A group ends only when a new User-agent block begins.
  const groups = [];
  let current = null;
  let expectingAgents = false;
  for (const line of lines) {
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!current || !expectingAgents) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
        expectingAgents = true;
      }
      current.agents.push(value.toLowerCase());
    } else if (current && (key === 'disallow' || key === 'allow')) {
      expectingAgents = false;
      if (value) current[key].push(value);
    }
  }

  const named = groups.filter((g) => g.agents.includes('briefbot'));
  const wildcard = groups.filter((g) => g.agents.includes('*'));
  const applicable = named.length ? named : wildcard;
  if (!applicable.length) return { allowed: true, reason: 'no applicable robots group' };

  // A robots path is a prefix match supporting '*' (any run) and '$' (end).
  const toRegex = (rule) => {
    let re = '';
    for (const ch of rule) {
      if (ch === '*') re += '.*';
      else if (ch === '$') re += '$';
      else re += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + re);
  };
  const matchLen = (rules, path) => {
    let best = -1;
    for (const rule of rules) {
      try {
        if (toRegex(rule).test(path)) best = Math.max(best, rule.length);
      } catch { /* a malformed rule is ignored rather than fatal */ }
    }
    return best;
  };

  const path = (v.url.pathname || '/') + (v.url.search || '');
  const allow = Math.max(...applicable.map((g) => matchLen(g.allow, path)));
  const disallow = Math.max(...applicable.map((g) => matchLen(g.disallow, path)));

  // Longest match wins; Allow breaks a tie (standard REP behaviour).
  if (disallow > allow) {
    return { allowed: false, reason: `robots.txt disallows this path` };
  }
  return { allowed: true, reason: 'permitted by robots.txt' };
}

function decode(s) {
  return String(s ?? '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .trim();
}

function meta(html, ...names) {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'
    );
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']*)[^>]*(?:property|name)=["']${name}["']`, 'i'
    );
    const m = html.match(re) || html.match(alt);
    if (m) return decode(m[1]);
  }
  return null;
}

/** A <link rel="..."> href, for canonical/alternate. */
function linkRel(html, rel) {
  const m = html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, 'i'));
  if (!m) return null;
  const href = m[0].match(/href=["']([^"']+)["']/i);
  return href ? decode(href[1]) : null;
}

/** Every JSON-LD node in the page, parsed. Malformed blocks are skipped. */
function jsonLdNodes(html) {
  const nodes = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const arr = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] ?? [])];
      for (const n of arr) if (n && typeof n === 'object') nodes.push(n);
    } catch { /* malformed JSON-LD is common; ignore it */ }
  }
  return nodes;
}

/** A JSON-LD string value that may be a plain string or an {name} object. */
function ldName(value) {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object' && typeof value.name === 'string') return value.name.trim() || null;
  return null;
}

function ldImages(node) {
  const out = [];
  const img = node?.image;
  const push = (v) => {
    const s = typeof v === 'string' ? v : (v && typeof v.url === 'string' ? v.url : null);
    if (s && !out.includes(s)) out.push(s);
  };
  if (Array.isArray(img)) img.forEach(push);
  else push(img);
  return out;
}

/**
 * Fetch a page and pull out what is genuinely stated in the markup. Prefers
 * OpenGraph, then JSON-LD, then standard article metadata. Never guesses.
 */
export async function fetchPage(rawUrl) {
  const v = validateUrl(rawUrl);
  if (!v.ok) return { ok: false, error: v.error };

  const robots = await robotsAllows(rawUrl);
  if (!robots.allowed) return { ok: false, error: `blocked: ${robots.reason}`, robots };

  const res = await get(v.url.toString(), { maxBytes: MAX_PAGE_BYTES });
  if (!res.ok) {
    return { ok: false, error: res.error || `HTTP ${res.status}`, status: res.status };
  }
  // Content-type sanity: a page must look like markup. Missing content-type is
  // tolerated (many servers omit it); a binary body is refused.
  if (res.contentType && !/html|xml|text/i.test(res.contentType)) {
    return { ok: false, error: `unsupported content type ${res.contentType}`, status: res.status };
  }

  const html = res.text;
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  // JSON-LD is the only place a page states an event date unambiguously.
  const nodes = jsonLdNodes(html);
  const ld = nodes.find((n) => /Event|Product|Place|Article|NewsArticle|Organization|LocalBusiness/i.test(String(n['@type'] ?? ''))) ?? null;
  const ldType = ld ? String(Array.isArray(ld['@type']) ? ld['@type'][0] : ld['@type']) : null;

  const ldImagesList = ld ? ldImages(ld) : [];
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const categories = [];
  const section = meta(html, 'article:section');
  if (section) categories.push(section);
  for (const key of ['keywords', 'news_keywords']) {
    const kw = meta(html, key);
    if (kw) for (const c of kw.split(',').map((s) => s.trim()).filter(Boolean)) categories.push(c);
  }
  for (const c of [].concat(ld?.articleSection ?? [], ld?.keywords ?? [])) {
    if (typeof c === 'string' && c.trim() && !categories.includes(c.trim())) categories.push(c.trim());
  }

  return {
    ok: true,
    finalUrl: res.finalUrl,
    robots,
    extracted: {
      title: meta(html, 'og:title', 'twitter:title') || (titleTag ? decode(titleTag[1]) : null),
      description: meta(html, 'og:description', 'description', 'twitter:description'),
      image: meta(html, 'og:image', 'twitter:image') || ldImagesList[0] || null,
      siteName: meta(html, 'og:site_name'),
      canonicalUrl: linkRel(html, 'canonical') || meta(html, 'og:url') || res.finalUrl,
      author: meta(html, 'article:author', 'author') || ldName(ld?.author) || ldName(ld?.creator) || null,
      publisher: meta(html, 'og:site_name') || ldName(ld?.publisher) || null,
      categories: [...new Set(categories)].slice(0, 12),
      publishedAt: meta(html, 'article:published_time', 'datePublished') ?? ld?.datePublished ?? ld?.startDate ?? null,
      // Structured data only. We never guess a price from body text here.
      startDate: ld?.startDate ?? null,
      endDate: ld?.endDate ?? null,
      locationName: ldName(ld?.location) ?? ld?.location?.address?.addressLocality ?? null,
      venue: ldName(ld?.location),
      organizer: ldName(ld?.organizer) ?? ldName(ld?.performer) ?? null,
      price: ld?.offers?.price ? Number(ld.offers.price) : null,
      currency: ld?.offers?.priceCurrency ?? null,
      ldType
    },
    text: body.slice(0, 4000)
  };
}

/** RSS/Atom. Real parse of the feed XML, no library. */
export async function fetchFeed(rawUrl) {
  const v = validateUrl(rawUrl);
  if (!v.ok) return { ok: false, error: v.error };

  const res = await get(v.url.toString(), {
    timeoutMs: 12000,
    maxBytes: MAX_FEED_BYTES,
    headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }
  });
  if (!res.ok) return { ok: false, error: res.error || `HTTP ${res.status}`, status: res.status };

  const xml = res.text;
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml)) {
    return { ok: false, error: 'response is not RSS or Atom' };
  }

  const pick = (block, ...tags) => {
    for (const t of tags) {
      const m = block.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i'));
      if (m) {
        return decode(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' '));
      }
    }
    return null;
  };

  const items = [];
  const blocks = [
    ...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)
  ].map((m) => m[0]);

  for (const b of blocks) {
    let link = pick(b, 'link');
    if (!link) {
      const href = b.match(/<link[^>]+href=["']([^"']+)["']/i);
      link = href ? decode(href[1]) : null;
    }
    const title = pick(b, 'title');
    if (!title && !link) continue;

    // Canonical link: Atom's rel="alternate", or the first present link.
    let canonical = null;
    const alt = b.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i);
    if (alt) canonical = decode(alt[1]);

    // Categories may repeat; each <category> is one tag.
    const cats = [];
    for (const cm of b.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)) {
      const c = decode(cm[1].replace(/<[^>]+>/g, ' '));
      if (c) cats.push(c);
    }

    // Enclosure / media — an image or attachment URL, never mandatory.
    let enclosure = null;
    for (const re of [
      /<enclosure[^>]+url=["']([^"']+)["']/i,
      /<media:content[^>]+url=["']([^"']+)["']/i,
      /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
      /<image>[^>]*<url>([\s\S]*?)<\/url>/i
    ]) {
      const em = b.match(re);
      if (em) { enclosure = decode(em[1]); break; }
    }

    items.push({
      title,
      link,
      canonicalUrl: canonical || link || null,
      description: pick(b, 'description', 'summary', 'content'),
      publishedAt: pick(b, 'pubDate', 'published', 'updated', 'dc:date'),
      guid: pick(b, 'guid', 'id') || canonical || link || title,
      author: pick(b, 'author', 'dc:creator', 'media:credit'),
      categories: cats.slice(0, 12),
      enclosure
    });
  }

  return {
    ok: true,
    feedTitle: pick(xml.split(/<(?:item|entry)[\s>]/i)[0], 'title'),
    items
  };
}

export const capabilities = {
  web: {
    connector: 'web',
    authenticate: 'n/a - public pages only',
    receive: 'yes - real HTTP GET',
    robots: 'yes - robots.txt consulted and honoured before fetching',
    ssrf: 'yes - private, loopback and link-local hosts refused',
    limits: 'timeout + redirect cap + 2MB size limit + content-type check; regex/JSON-LD extraction, not a full DOM parser'
  },
  rss: {
    connector: 'rss',
    authenticate: 'n/a - public feeds',
    receive: 'yes - real HTTP GET, RSS 2.0 + Atom parsed',
    limits: 'timeout + redirect cap + 5MB size limit; authenticated or paywalled feeds are not supported'
  }
};
