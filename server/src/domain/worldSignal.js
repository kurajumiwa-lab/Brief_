// ---------------------------------------------------------------------------
// WORLD SIGNAL — the one strip in Brief that is not about the user.
//
// The user's own ledger is empty for months. The world's isn't. This module
// reads a real, key-free public provider and says what it says — nothing more.
// It exists so that a Home screen with zero rows can still tell a producer
// something true and useful: how much rain is coming, on which day, and how
// long the dry run in front of them is. That is coordination information for
// anyone selling what grows.
//
// THE RULES THIS MODULE IS BUILT ON
//   1. Every number in `facts` is a number in the provider's response, and the
//      sentence is derived from it here. No figure is written into this file.
//      If a value is missing, the FACT IS NOT SPOKEN. There is no fallback
//      string, no "typical for September", no seasonal average, no illustrative
//      "+12%". A design that needs a number is a design that will invent one.
//   2. A place is only ever what the provider matched. `place` (what was asked
//      for) and `resolvedPlace` (what came back, with the provider's own
//      country/admin labels) are both returned, so a mismatch is visible rather
//      than smoothed over.
//   3. Provenance is part of the payload, not a footnote: provider name, the
//      model the provider names, the elevation it used, when it was retrieved,
//      how old that is, and whether this read came from cache.
//   4. Failure is a state, not a zero. If the provider cannot be reached, this
//      says so, hands back the last good snapshot WITH ITS AGE if one exists,
//      and the surface shows the gap. A stale fact labelled stale is honest; a
//      stale fact shown as current is not; a missing fact shown as 0 is a lie.
//   5. Sources that Brief cannot legitimately read are declared
//      `not_configured`, with the reason, and are never silently dropped. That
//      covers commodity prices (no key-free endpoint reachable from this
//      deployment: soko's API does not resolve, FEWS NET's ArcGIS endpoint
//      returned nothing, KNBS has no machine-readable price table), and EPRA
//      fuel prices (published monthly as a document, not an API). Wiring a
//      price feed is a provider-account task, not a copy task — and the day one
//      is wired, the surface that reads it must state its own source and date
//      the same way this one does.
//
// Weather is forecast, not measurement: `observedAt` is therefore null and the
// horizon is stated (`nextDays`). Nobody may render this as "what happened".
// ---------------------------------------------------------------------------

const PROVIDER = {
  name: 'Open-Meteo',
  docs: 'https://open-meteo.com/',
  // Key-free by design, so there is no secret to leak and no quota to bill.
  licence: 'free, no API key; data copies are CC-BY 4.0 with attribution to DWD/BOM/NOAA'
};

/** Nairobi, used only as the starting point when no place is asked for. It is
 *  reported as what it is: the default, with the provider's own label. */
export const DEFAULT_PLACE = { name: 'Nairobi', latitude: -1.286389, longitude: 36.817223 };

const FORECAST_DAYS = 7;
const TTL_MS = 6 * 3600_000;          // a forecast is worth 6 hours, not a week
const STALE_OK_HOURS = 36;             // longer than this, don't show the old one at all
const WET_MM = 1;                     // the provider's own unit; a "wet day" floor
const HEAVY_MM = 15;                  // Kenyan weather services' usual "heavy rain" floor

/** In-memory only on purpose: a cached forecast is volatile public data, and
 *  writing it to the store would grow the ledger for something that expires. */
const cache = new Map();
const placeCache = new Map();

const key = (lat, lon) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

async function fetchJson(url, timeoutMs = 9000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`the provider answered ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** A place name to coordinates, from the provider's own gazetteer. Never a
 *  guess, never a substring match invented here. */
export async function resolvePlace(name) {
  const asked = String(name ?? '').trim();
  if (!asked) return { ...DEFAULT_PLACE, default: true };
  const hit = placeCache.get(asked.toLowerCase());
  if (hit) return { ...hit, cached: true };
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(asked)}&count=1&language=en&format=json`;
  const data = await fetchJson(url);
  const row = (data?.results ?? [])[0];
  if (!row) throw new Error(`no place called “${asked}” in the provider's gazetteer`);
  const out = {
    name: row.name,
    admin: row.admin1 ?? null,
    country: row.country ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    elevationM: row.elevation ?? null
  };
  placeCache.set(asked.toLowerCase(), out);
  return out;
}

const dayIndex = (iso, nowMs) => {
  const a = Date.parse(`${iso}T12:00:00Z`);
  const b = Date.parse(new Date(nowMs).toISOString().slice(0, 10) + 'T12:00:00Z');
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((a - b) / 86400000) : null;
};

const weekday = (iso) => {
  const ms = Date.parse(`${iso}T12:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  try { return new Date(ms).toLocaleDateString('en-KE', { weekday: 'short', timeZone: 'UTC' }); }
  catch { return null; }
};

const whenInDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === null ? null : `in ${n} days`);

/**
 * Say only what the response supports. Each fact carries the number it came
 * from, so the UI can never round a feeling into a statistic.
 */
export function deriveFacts(daily, { nowMs, units } = {}) {
  const facts = [];
  const days = (daily?.time ?? []).map((date, i) => ({
    date,
    mm: Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum[i] : null,
    chance: Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max[i] : null,
    maxC: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[i] : null,
    minC: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[i] : null,
    inDays: dayIndex(date, nowMs)
  })).filter((d) => d.inDays !== null && d.inDays >= 0 && d.inDays < FORECAST_DAYS);

  if (!days.length) return { facts, heaviestRain: null, dryRunDays: 0, wetDays: 0, hottestDay: null, horizon: 0 };

  // Heaviest single day of rain. Only stated when it is rain anyone would
  // plan around: a 0.4mm drizzle on Friday is not a fact worth a headline.
  const wet = days.filter((d) => typeof d.mm === 'number' && d.mm >= WET_MM);
  const heaviest = wet.length ? wet.reduce((a, b) => (b.mm > a.mm ? b : a)) : null;
  const heavy = heaviest && heaviest.mm >= HEAVY_MM ? heaviest : null;
  if (heavy) {
    const label = heavy.chance != null && heavy.chance >= 60 ? `, ${heavy.chance}% likely` : '';
    facts.push({
      kind: 'rain',
      text: `Heavy rain forecast ${whenInDays(heavy.inDays) ?? heavy.date}${weekday(heavy.date) ? ` (${weekday(heavy.date)})` : ''}: ${heavy.mm} mm${label}`,
      value: heavy.mm, unit: 'mm', date: heavy.date, inDays: heavy.inDays
    });
  } else if (heaviest) {
    facts.push({
      kind: 'rain',
      text: `Wettest of the next ${days.length} days: ${heaviest.mm} mm ${whenInDays(heaviest.inDays) ?? heaviest.date}`,
      value: heaviest.mm, unit: 'mm', date: heaviest.date, inDays: heaviest.inDays
    });
  }

  // A dry run: how many of the coming days are effectively dry, counted from
  // today forward. This is the one that matters to someone selling produce.
  let dryRun = 0;
  for (const d of days) {
    if (typeof d.mm === 'number' && d.mm < WET_MM) dryRun += 1;
    else break;
  }
  if (dryRun > 0) {
    facts.push({
      kind: 'dry',
      // The threshold is a field, not a number in the sentence: a figure shown
      // beside a unit must be a value the provider returned, or it is noise a
      // reader cannot check.
      text: `Dry spell holds: no rain for the next ${dryRun} day${dryRun === 1 ? '' : 's'}`,
      value: dryRun, unit: 'days', thresholdMm: WET_MM
    });
  } else {
    const nextWet = wet.slice().sort((a, b) => a.inDays - b.inDays)[0];
    if (nextWet) {
      facts.push({
        kind: 'rain-due',
        text: `Rain from ${whenInDays(nextWet.inDays) ?? nextWet.date}${weekday(nextWet.date) ? ` (${weekday(nextWet.date)})` : ''}`,
        value: nextWet.mm, unit: 'mm', date: nextWet.date, inDays: nextWet.inDays
      });
    }
  }

  const wetDays = wet.length;
  if (wetDays >= 2) {
    facts.push({
      kind: 'wet-count',
      text: `${wetDays} of the next ${days.length} days look wet — a drying window is worth planning`,
      value: wetDays, unit: 'days'
    });
  }

  const hot = days.filter((d) => typeof d.maxC === 'number').reduce((a, b) => (!a || b.maxC > a.maxC ? b : a), null);
  if (hot) {
    facts.push({
      kind: 'heat',
      text: `Hottest afternoon ${whenInDays(hot.inDays) ?? hot.date}: ${hot.maxC} °C`,
      value: hot.maxC, unit: '°C', date: hot.date
    });
  }
  const cool = days.filter((d) => typeof d.minC === 'number').reduce((a, b) => (!a || b.minC < a.minC ? b : a), null);
  if (cool && cool.minC <= 12) {
    facts.push({
      kind: 'cold',
      text: `Cold morning ${whenInDays(cool.inDays) ?? cool.date}: down to ${cool.minC} °C`,
      value: cool.minC, unit: '°C', date: cool.date
    });
  }

  return {
    facts,
    heaviestRain: heaviest ? { date: heaviest.date, mm: heaviest.mm, inDays: heaviest.inDays, chance: heaviest.chance ?? null } : null,
    heavyRain: heavy ? { date: heavy.date, mm: heavy.mm, inDays: heavy.inDays } : null,
    dryRunDays: dryRun,
    wetDays,
    hottestDay: hot ? { date: hot.date, maxC: hot.maxC } : null,
    coolestMorning: cool ? { date: cool.date, minC: cool.minC } : null,
    horizon: days.length,
    units: units ?? null
  };
}

/** The provider call, with a cache in front of it. One clock per request: the
 *  caller's `nowMs` judges freshness, age and the day arithmetic alike, so a
 *  test can move time and the whole read moves with it. */
async function getForecast(lat, lon, nowMs = Date.now()) {
  const k = key(lat, lon);
  const now = nowMs;
  const cached = cache.get(k);
  if (cached && now - cached.at < TTL_MS) return { ...cached, fromCache: true };
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min`
    + `&forecast_days=${FORECAST_DAYS}&timezone=Africa%2FNairobi&models=best_match`;
  const data = await fetchJson(url);
  const snap = {
    at: now,
    retrievedAt: new Date(now).toISOString(),
    // The model we asked for, echoed back as what it is. Open-Meteo's
    // `best_match` blends national models; the provider does not name a single
    // one in the response, so neither do we.
    model: "best_match (the provider's blend of national models; the response names no single one)",
    elevationM: data?.elevation ?? null,
    daily: data?.daily ?? null,
    units: data?.daily_units ?? null
  };
  cache.set(k, snap);
  return { ...snap, fromCache: false };
}

/**
 * The read the surface uses. Never throws: the caller gets a shape with either
 * facts or an `error`, and the UI renders one line either way.
 */
export async function worldSignal({ place = null, now = Date.now() } = {}) {
  const base = {
    provider: PROVIDER.name,
    providerLicence: PROVIDER.licence,
    kind: 'forecast',
    observedAt: null, // forecast data: nothing here was observed
    horizonDays: FORECAST_DAYS,
    prices: {
      status: 'not_configured',
      reason: 'no key-free commodity-price endpoint is reachable from this deployment; soko’s API does not resolve, FEWS NET returned no layer, and KNBS publishes no machine-readable price table'
    },
    fuel: {
      status: 'not_configured',
      reason: 'EPRA publishes pump prices monthly as a document, not an API — wiring it needs a scraper and a review cadence, not a number typed into the UI'
    }
  };

  let resolved = null;
  try {
    resolved = await resolvePlace(place);
  } catch (e) {
    return {
      ...base,
      available: false,
      place: place ?? null,
      resolvedPlace: null,
      facts: [],
      error: `the place could not be resolved: ${e.message}`,
      stale: false,
      at: null
    };
  }

  try {
    const snap = await getForecast(resolved.latitude, resolved.longitude, now);
    const derived = deriveFacts(snap.daily, { nowMs: now, units: snap.units });
    return {
      ...base,
      available: true,
      place: place ?? DEFAULT_PLACE.name,
      placeIsDefault: !place,
      resolvedPlace: {
        name: resolved.name, admin: resolved.admin ?? null, country: resolved.country ?? null,
        latitude: resolved.latitude, longitude: resolved.longitude
      },
      elevationM: snap.elevationM ?? resolved.elevationM ?? null,
      model: snap.model,
      retrievedAt: snap.retrievedAt,
      ageHours: Math.round(Math.max(0, (now - snap.at) / 3600_000) * 10) / 10,
      fromCache: snap.fromCache === true,
      ...derived,
      error: null
    };
  } catch (e) {
    // Last good snapshot, with its age printed, or nothing.
    const cached = cache.get(key(resolved.latitude, resolved.longitude));
    const ageHours = cached ? (now - cached.at) / 3600_000 : null;
    if (cached && ageHours <= STALE_OK_HOURS) {
      const derived = deriveFacts(cached.daily, { nowMs: now, units: cached.units });
      return {
        ...base,
        available: true,
        stale: true,
        place: place ?? DEFAULT_PLACE.name,
        placeIsDefault: !place,
        resolvedPlace: { name: resolved.name, admin: resolved.admin ?? null, country: resolved.country ?? null },
        retrievedAt: cached.retrievedAt,
        ageHours: Math.round(ageHours * 10) / 10,
        fromCache: true,
        ...derived,
        error: `the provider could not be reached (${e.message}); this is the last read, ${Math.round(ageHours)}h old`
      };
    }
    return {
      ...base,
      available: false,
      stale: false,
      place: place ?? DEFAULT_PLACE.name,
      placeIsDefault: !place,
      resolvedPlace: { name: resolved.name, admin: resolved.admin ?? null, country: resolved.country ?? null },
      facts: [],
      at: null,
      error: `the provider could not be reached (${e.message}), and Brief has no recent read to show instead. A gap is shown as a gap.`
    };
  }
}

/** Test seam: the cache is module state, and a test must not inherit it. */
export function __clearWorldCache() {
  cache.clear();
  placeCache.clear();
}

export const WORLD_CONSTANTS = { FORECAST_DAYS, WET_MM, HEAVY_MM, TTL_MS };

export default worldSignal;
