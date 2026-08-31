// ---------------------------------------------------------------------------
// NORMALIZATION + OBJECT EXTRACTION
//
// The single rule this module exists to enforce (spec 7):
//   extract what is literally present; never invent a missing field.
//
// Every extractor returns null when the signal is absent. Nothing falls back to
// a default, nothing is guessed from context, and "Saturday" never becomes a
// calendar date. A sparse result is the correct answer for a sparse message.
//
// The regex vocabulary is deliberately shared with the client's own parser so a
// message reads identically whether it arrived by webhook or was pasted in.
//
// CONTENT TYPES: TYPE_SIGNALS maps language to the domain vocabulary. The ten
// kinds of content a Telegram post can become are recognised here and written
// as the object `type`:
//
//   events            -> experience
//   places            -> place
//   businesses/vendor -> business
//   offers/promotions -> offer
//   jobs              -> opportunity
//   alerts            -> alert
//   community notices -> announcement
//   articles/news     -> news
//   products/services -> product / service
//   general info      -> knowledge
//
// The gazetteer (COUNTIES / AREAS / LANDMARKS) only classifies a location that
// is literally present — it never inserts one, and never infers a place from
// context. Every classified location keeps its source snippet as evidence.
// ---------------------------------------------------------------------------

import { scanLocations, classifyLocation } from './gazetteer.js';

const MONEY_RE =
  /(?:ksh|kes|sh)\s*\.?\s*([0-9][0-9,\.]*)\s*(?:\/=|\/-)?|([0-9][0-9,]{2,})\s*(?:\/=|\/-)/i;
const PHONE_RE = /(?:\+254|0)7[0-9]{8}\b|\+254\s?7[0-9]{2}\s?[0-9]{3}\s?[0-9]{3}/;
const TIME_RANGE_RE =
  /\b([01]?[0-9]|2[0-3])(?::([0-5][0-9]))?\s*(am|pm)?\s*(?:-|–|to|till|until)\s*([01]?[0-9]|2[0-3])(?::([0-5][0-9]))?\s*(am|pm)?/i;
// A single clock time (requires am/pm so "3pm" counts but "3" alone does not).
const SINGLE_TIME_RE = /\b([01]?[0-9]|2[0-3])(?::([0-5][0-9]))?\s*(am|pm)\b/i;
const LOCATION_RE =
  /\b(?:at|venue|location|located at|along|opposite|near)\b[:\s]+([A-Z][A-Za-z0-9'\-]*(?:\s+[A-Z][A-Za-z0-9'\-]*){0,4})/;
const URL_RE = /https?:\/\/[^\s<>"')]+/i;
const DEADLINE_RE =
  /\b(?:deadline|closes|closing|apply by|last day|ends)\b[:\s]*([A-Za-z0-9 ,]{3,24})/i;
const WEEKDAY_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;
const DATE_RE =
  /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?)\b/i;
const VENDOR_COUNT_RE = /\b(\d{1,3})\s+(?:vendors?|stalls?|sellers?|traders?|exhibitors?)\b/i;
const HANDLE_RE = /@([A-Za-z0-9_]{3,32})\b/g;
// The keyword is case-insensitive ("DM", "dm", "Contact"), but the captured
// NAME must stay explicitly capitalised. Applying /i to the whole pattern would
// happily read "call me" or "contact us" as a person called Me/Us.
const CONTACT_NAME_RE =
  /\b(?:[Dd][Mm]|[Cc]ontact|[Cc]all|[Tt]ext|[Ww]hats[Aa]pp|[Rr]each)\s+([A-Z][a-z]{2,15})\b/;

// A recurring schedule, captured as text, never resolved to a made-up date.
const RECURRENCE_RE =
  /\b(every\s+(?:day|week|month|year|weekend|weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|monthly|biweekly|fortnightly|weekdays|weekends|annually)\b/i;

// Words that follow a contact verb but are not people.
const NOT_A_NAME = /^(?:Me|Us|Our|The|Him|Her|Them|Now|Today|Tomorrow|Direct)$/;

// Vendor naming patterns (spec 20). Each needs an explicit marker -- we never
// promote a random capitalised phrase to a vendor.
const VENDOR_PATTERNS = [
  /\bvendors?\s*:\s*([^\n,;.]{3,50})/gi,
  /\b([A-Z][A-Za-z0-9'&]*(?:\s+[A-Z][A-Za-z0-9'&]*){0,3})\s+will\s+be\s+(?:selling|there|trading)/g,
  /\bfind\s+(?:us|them)\s+at\s+stall\s*(\d{1,3})/gi
];

// Order matters: inferType returns the FIRST signal that matches. More urgent
// and more specific language is placed first; generic premises language last.
const TYPE_SIGNALS = [
  {
    type: 'opportunity',
    words: /\b(grant|scholarship|apply|application|funding|vacancy|hiring|job|tender|bursary)\b/i,
    label: 'application language'
  },
  {
    type: 'alert',
    words: /\b(alert|warning|outage|blackout|power cut|water shortage|road closed|road closure|recall|safety|danger|beware|scam|fraud alert|emergency|curfew|missing person|protest|demonstration)\b/i,
    label: 'alert language'
  },
  {
    type: 'experience',
    // A qualified market ("night market", "craft market", "market day") is an
    // event. A bare "market" is a permanent place and falls through to the
    // premises rule below.
    words: /\b(event|popup|pop-up|forum|summit|meetup|workshop|festival|fair|exhibition|auction|training|webinar|tournament|(?:night|day|craft|creator|farmers?|flea|street|food|fashion|weekend|christmas|holiday)\s+market|market\s+day)\b/i,
    label: 'event language'
  },
  {
    type: 'offer',
    words: /\b(discount|promo(?:tion)?|flash sale|clearance sale|special offer|special price|% off|percent off|buy one get one|free delivery|voucher|coupon|giveaway|half price|markdown|reduced price|deal of the day|black friday)\b/i,
    label: 'promotion language'
  },
  {
    type: 'announcement',
    words: /\b(announcement|general meeting|annual general meeting|\bagm\b|funeral|condolence|harambee|community meeting|residents meeting|members? are invited|invites? all|neighbourhood meeting|fellowship|prayer meeting)\b/i,
    label: 'community announcement language'
  },
  {
    type: 'news',
    words: /\b(breaking|headlines?|press release|newsletter|bulletin|news report|news update|coverage|editorial|column|exclusive|report says|daily nation|standard newspaper|nation media)\b/i,
    label: 'news language'
  },
  {
    type: 'business',
    words: /\b(business|\bltd\b|limited|company|vendor|supplier|brand|restaurant|cafe|café|salon|barbershop|boutique|pharmacy|clinic|butchery|supermarket|hardware|dealers?|wholesale|retail|outlet|gym|hotel|guest house|car wash|spa|bakery|bookshop|stationers|agrovet|chemist|optician|tailor)\b/i,
    label: 'business language'
  },
  {
    type: 'service',
    words: /\b(service|repair|installation|booking|book a|consultation|inspection|delivery|plumber|fundi)\b/i,
    label: 'service language'
  },
  {
    type: 'product',
    words: /\b(for sale|selling|stock|in stock|price|buy|brand new|second hand|pieces|units)\b/i,
    label: 'sale language'
  },
  {
    type: 'knowledge',
    words: /\b(guide|how to|steps|requirements|explainer|notice|information|info|tips|learn about)\b/i,
    label: 'informational language'
  },
  {
    // Bare 'market' lands here (a permanent trading place); the qualified
    // forms were already claimed as events by the rule above.
    type: 'place',
    words: /\b(shop|stall|market|centre|center|hub|office|premises|branch)\b/i,
    label: 'premises language'
  }
];

const CATEGORY_WORDS = [
  'fashion', 'food', 'beauty', 'art', 'music', 'gaming', 'wellness',
  'streetwear', 'crafts', 'produce', 'tech', 'books', 'furniture'
];

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function cleanMoney(raw) {
  const n = Number(String(raw).replace(/[,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Build an ISO date string, or null when any part is out of range. */
function isoDate(year, month, day) {
  const y = Number(year), mo = Number(month), d = Number(day);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
  if (!Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  if (!Number.isFinite(d) || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Parse a FULL date — day + month + YEAR — into a canonical ISO date.
 * A day+month with no year returns null (we never invent the year). Supports
 * "15 September 2026", "September 15, 2026", "2026-09-15" and "15/09/2026".
 */
export function parseFullDate(text) {
  let m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i);
  if (m) return isoDate(m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], m[1]);
  m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i);
  if (m) return isoDate(m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], m[2]);
  m = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return isoDate(m[1], m[2], m[3]);
  m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return isoDate(m[3], m[2], m[1]);
  return null;
}

function extractTitle(text) {
  const line = text
    .split(/\n|(?<=[.!])\s+/)
    .map((l) => l.trim())
    .find((l) => l.length >= 8 && l.length <= 90 && /[a-z]/i.test(l));
  if (!line) return null;
  return line.replace(/^[^A-Za-z0-9]+/, '').slice(0, 80);
}

function inferType(text) {
  for (const s of TYPE_SIGNALS) {
    const hit = text.match(s.words);
    if (hit) return { type: s.type, why: `${s.label} ("${hit[0]}")` };
  }
  return null;
}

function to24h(hour, min, mer) {
  let h = Number(hour);
  if (mer) {
    const m = mer.toLowerCase();
    if (m === 'pm' && h < 12) h += 12;
    if (m === 'am' && h === 12) h = 0;
  }
  return `${String(h).padStart(2, '0')}:${min ?? '00'}`;
}

/**
 * Extract structured fields from free text.
 *
 * Returns { fields, evidence, confidence }. `evidence` records the exact
 * substring each value came from so a reviewer can audit the parser rather
 * than trust it (spec 9: extractionConfidence is tracked separately from
 * object trust and verification).
 */
export function extractFields(text) {
  const fields = {};
  const evidence = [];
  const note = (field, value, snippet) => {
    fields[field] = value;
    evidence.push({ field, value: String(value), evidence: snippet });
  };

  const title = extractTitle(text);
  if (title) note('title', title, title);

  const typed = inferType(text);
  if (typed) note('type', typed.type, typed.why);

  const money = text.match(MONEY_RE);
  if (money) {
    const amount = cleanMoney(money[1] ?? money[2]);
    if (amount !== null) {
      note('price', amount, money[0].trim());
      note('currency', 'KES', money[0].trim());
    }
  }

  const phone = text.match(PHONE_RE);
  if (phone) note('contactPhone', phone[0].trim(), phone[0].trim());

  // A range gives both a start and an end time; a lone clock time gives only
  // a start. Neither is ever combined with a weekday to invent a date.
  const time = text.match(TIME_RANGE_RE);
  if (time) {
    const start = to24h(time[1], time[2], time[3] || time[6]);
    const end = to24h(time[4], time[5], time[6]);
    note('timeRange', `${start}-${end}`, time[0].trim());
    note('startTime', start, time[0].trim());
    note('endTime', end, time[0].trim());
  } else {
    const single = text.match(SINGLE_TIME_RE);
    if (single) note('startTime', to24h(single[1], single[2], single[3]), single[0].trim());
  }

  const loc = text.match(LOCATION_RE);
  if (loc) note('locationName', loc[1].trim(), loc[0].trim());

  // Gazetteer: classify a location that is literally present. Never invented.
  const gaz = scanLocations(text);
  const byKind = (kind) => gaz.find((g) => g.kind === kind);
  const county = byKind('county');
  const area = byKind('area');
  const landmark = byKind('landmark');
  if (county) note('county', county.name, county.snippet);
  if (area) note('area', area.name, area.snippet);
  if (landmark) note('landmark', landmark.name, landmark.snippet);
  if (gaz.length) {
    fields.locationEvidence = gaz.map((g) => ({ name: g.name, kind: g.kind }));
    evidence.push({ field: 'locationEvidence', value: JSON.stringify(fields.locationEvidence), evidence: gaz.map((g) => g.name).join(', ') });
    // Confidence reflects how specifically a KNOWN name matched.
    const lc = landmark ? 0.9 : area ? 0.75 : 0.8;
    note('locationConfidence', lc, gaz.map((g) => g.name).join(', '));
  }

  const url = text.match(URL_RE);
  if (url) note('url', url[0], url[0]);

  const deadline = text.match(DEADLINE_RE);
  if (deadline) {
    const dl = deadline[1].trim();
    note('deadline', dl, deadline[0].trim());
    const dlDate = parseFullDate(dl);
    if (dlDate) note('deadlineCanonical', dlDate, dl);
  }

  // Day-of-week WITHOUT a date is recorded as a day only. We never resolve
  // "Saturday" to a calendar date -- that would be inventing information.
  const day = text.match(WEEKDAY_RE);
  if (day) note('dayOfWeek', day[1].toLowerCase(), day[0]);

  const date = text.match(DATE_RE);
  if (date) note('dateText', date[1], date[0]);

  // A FULL date (with year) becomes a canonical ISO date; day+month stays text.
  const fullDate = parseFullDate(text);
  if (fullDate) note('dateCanonical', fullDate, fullDate);

  const recurrence = text.match(RECURRENCE_RE);
  if (recurrence) note('recurrence', recurrence[0].toLowerCase(), recurrence[0]);

  // Compose a canonical event timestamp ONLY when both a full date and a time
  // are present. A date without a time, or a time without a date, is kept as
  // its parts — combining a weekday with a time would invent a date.
  if (fields.dateCanonical && fields.startTime) {
    note('eventStart', `${fields.dateCanonical}T${fields.startTime}:00`, `${fields.dateCanonical} ${fields.startTime}`);
    if (fields.endTime) {
      note('eventEnd', `${fields.dateCanonical}T${fields.endTime}:00`, `${fields.dateCanonical} ${fields.endTime}`);
    }
  }

  const vendors = text.match(VENDOR_COUNT_RE);
  if (vendors) note('vendorCount', Number(vendors[1]), vendors[0].trim());

  const contact = text.match(CONTACT_NAME_RE);
  if (contact && !NOT_A_NAME.test(contact[1])) {
    note('contactName', contact[1], contact[0].trim());
  }

  const handles = [...text.matchAll(HANDLE_RE)].map((m) => m[1]);
  if (handles.length) note('handles', handles, handles.map((h) => `@${h}`).join(' '));

  const cats = CATEGORY_WORDS.filter((c) =>
    new RegExp(`\\b${c}\\b`, 'i').test(text)
  );
  if (cats.length) note('categories', cats, cats.join(', '));

  // Confidence is a pure function of how much was genuinely found, capped so a
  // parser can never report certainty it has not earned.
  const weights = {
    title: 0.2, type: 0.2, price: 0.1, locationName: 0.15,
    timeRange: 0.1, vendorCount: 0.1, contactPhone: 0.1,
    dateText: 0.1, categories: 0.05,
    county: 0.05, area: 0.05, landmark: 0.05,
    deadline: 0.05, recurrence: 0.05
  };
  let confidence = 0;
  for (const [k, w] of Object.entries(weights)) if (fields[k] !== undefined) confidence += w;
  confidence = Math.min(1, Number(confidence.toFixed(2)));

  return { fields, evidence, confidence };
}

/** Vendor names stated explicitly enough to act on (spec 20). */
export function extractVendors(text) {
  const out = [];
  for (const re of VENDOR_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const raw = (m[1] || '').trim();
      if (!raw) continue;
      if (/^\d+$/.test(raw)) continue; // a stall number is not a vendor name
      for (const piece of raw.split(/\s*(?:,|and|&)\s*/i)) {
        const name = piece.trim();
        if (name.length >= 3 && name.length <= 50 && /[A-Za-z]/.test(name)) {
          if (!out.some((v) => v.toLowerCase() === name.toLowerCase())) out.push(name);
        }
      }
    }
  }
  return out;
}

// An admission fee is not a product. "Entry KES 300" describes the cost of
// getting in, and turning it into a purchasable item would put a fake product
// in the graph -- exactly what spec 21/37 forbid.
const FEE_WORDS =
  /^(?:entry|entrance|gate|admission|ticket|tickets|cover|fee|fees|charge|charges|donation|deposit|budget|total|balance|from|only|just|price|cost)$/i;

/** Product lines: "Custom hoodies KES 2500" (spec 21). */
export function extractProducts(text) {
  const out = [];
  const re =
    /([A-Za-z][A-Za-z0-9 '\-]{2,40}?)\s*[-–:]?\s*(?:ksh|kes|sh)\s*\.?\s*([0-9][0-9,\.]*)/gi;
  for (const m of text.matchAll(re)) {
    let name = m[1].trim().replace(/^(?:and|the|a)\s+/i, '');
    // Keep only the trailing noun phrase: "Runs 4PM-10PM. Custom hoodies" must
    // not become one long pseudo-product.
    const lastSentence = name.split(/[.!?\n]/).pop().trim();
    if (lastSentence.length >= 3) name = lastSentence;
    const price = cleanMoney(m[2]);
    if (name.length < 3 || price === null) continue;
    if (FEE_WORDS.test(name)) continue;
    // A trailing fee word ("... entry") is the same thing with a prefix.
    const lastWord = name.split(/\s+/).pop();
    if (FEE_WORDS.test(lastWord) && name.split(/\s+/).length <= 2) continue;
    if (!out.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      out.push({ name, price, currency: 'KES' });
    }
  }
  return out;
}

/**
 * Is there enough here to be worth a Brief object at all?
 * Pure conversation must not manufacture a record (spec 7/37).
 */
export function isObjectWorthy(fields) {
  if (!fields.title) return false;
  const signals = [
    'type', 'price', 'locationName', 'timeRange',
    'vendorCount', 'contactPhone', 'dateText', 'url'
  ].filter((k) => fields[k] !== undefined).length;
  return signals >= 2;
}

// Re-export the gazetteer helpers so tests and callers have one entry point.
export { scanLocations, classifyLocation };
